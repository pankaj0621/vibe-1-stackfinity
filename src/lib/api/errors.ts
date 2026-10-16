import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { MongoServerError } from "mongodb";
import { ZodError } from "zod";
import {
  AppError,
  ClashError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  VehicleBusyError,
} from "@/lib/errors/app-error";

type ApiErrorOptions = {
  operation: string;
};

type ErrorLike = {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  codeName?: unknown;
  stack?: unknown;
};

function readableOperation(operation: string): string {
  const cleaned = operation
    .replace(/^(?:failed to|could not|unable to)\s+/i, "")
    .replace(/\s+(?:has\s+)?failed$/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
  return cleaned ? cleaned[0].toLowerCase() + cleaned.slice(1) : "complete this request";
}

function codeForStatus(status: number): string {
  switch (status) {
    case 400: return "VALIDATION_ERROR";
    case 401: return "AUTHENTICATION_REQUIRED";
    case 403: return "PERMISSION_DENIED";
    case 404: return "NOT_FOUND";
    case 405: return "METHOD_NOT_ALLOWED";
    case 408: return "REQUEST_TIMEOUT";
    case 409: return "RESOURCE_CONFLICT";
    case 410: return "RESOURCE_GONE";
    case 413: return "PAYLOAD_TOO_LARGE";
    case 415: return "UNSUPPORTED_MEDIA_TYPE";
    case 422: return "VALIDATION_ERROR";
    case 423: return "RESOURCE_LOCKED";
    case 429: return "RATE_LIMITED";
    case 501: return "NOT_IMPLEMENTED";
    case 502: return "BAD_GATEWAY";
    case 503: return "SERVICE_UNAVAILABLE";
    case 504: return "GATEWAY_TIMEOUT";
    default: return status >= 500 ? "APPLICATION_SERVER_ERROR" : `HTTP_${status}`;
  }
}

function codeForAppError(error: AppError): string {
  if (error instanceof ClashError) return "BOOKING_SLOT_CONFLICT";
  if (error instanceof VehicleBusyError) return "VEHICLE_BUSY";
  if (error instanceof UnauthorizedError) return "AUTHENTICATION_REQUIRED";
  if (error instanceof ForbiddenError) return "PERMISSION_DENIED";
  if (error instanceof NotFoundError) return "NOT_FOUND";
  if (error instanceof ValidationError) return "VALIDATION_ERROR";
  if (error instanceof ConflictError) return "RESOURCE_CONFLICT";
  return codeForStatus(error.statusCode);
}

function redactLogValue(value: string): string {
  return value
    .replace(/mongodb(?:\+srv)?:\/\/[^\s@]+@/gi, "mongodb+srv://[credentials-redacted]@")
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/gi, "$1[redacted]")
    .replace(/([?&](?:api[_-]?key|key|token|access[_-]?token|password|secret)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/((?:password|passwd|secret|token|authorization)\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
    .slice(0, 500);
}

function validationFields(error: ZodError): Record<string, string[]> {
  return error.issues.reduce<Record<string, string[]>>((fields, issue) => {
    const key = issue.path.length ? issue.path.map(String).join(".") : "_form";
    (fields[key] ||= []).push(issue.message);
    return fields;
  }, {});
}

export function logServerError(operation: string, error: unknown, requestId = randomUUID()): string {
  const metadata = getErrorMetadata(error);
  const errorName = typeof metadata.name === "string" ? metadata.name : "UnknownError";
  const errorMessage = typeof metadata.message === "string" ? metadata.message : "";
  const errorCode = metadata.code;
  const errorStack = typeof metadata.stack === "string" ? metadata.stack : "";

  console.error("[server:error]", {
    requestId,
    operation: readableOperation(operation),
    errorName,
    errorCode:
      typeof errorCode === "number" || typeof errorCode === "string"
        ? redactLogValue(String(errorCode))
        : undefined,
    errorMessage: redactLogValue(errorMessage),
    ...(errorStack ? { stack: redactLogValue(errorStack) } : {}),
  });
  return requestId;
}

function getErrorMetadata(error: unknown): ErrorLike {
  if (error && typeof error === "object") return error as ErrorLike;
  return { name: "UnknownError", message: String(error) };
}

export function apiErrorResponse(error: unknown, options: ApiErrorOptions): NextResponse {
  const requestId = randomUUID();
  const operation = readableOperation(options.operation);
  const metadata = getErrorMetadata(error);
  const errorName = typeof metadata.name === "string" ? metadata.name : "UnknownError";
  const errorMessage = typeof metadata.message === "string" ? metadata.message : "";
  const errorCode = metadata.code;

  let status = 500;
  let code = "INTERNAL_SERVER_ERROR";
  let message = `We couldn't ${operation} because of a server error. Please try again. Reference: ${requestId}.`;
  let fieldErrors: Record<string, string[]> | undefined;

  if (error instanceof ZodError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = error.issues[0]?.message || "Please check the submitted information.";
    fieldErrors = validationFields(error);
  } else if (error instanceof SyntaxError) {
    status = 400;
    code = "INVALID_REQUEST_BODY";
    message = "The request could not be read. Refresh the page and try again.";
  } else if (error instanceof AppError) {
    status = error.statusCode >= 400 && error.statusCode <= 599 ? error.statusCode : 500;
    code = status >= 500 ? "APPLICATION_SERVER_ERROR" : codeForAppError(error);
    if (status < 500) message = error.message;
  } else if (
    (error instanceof MongoServerError && error.code === 11000) ||
    errorCode === 11000 ||
    errorCode === 11001
  ) {
    status = 409;
    code = "DUPLICATE_RECORD";
    message = "A record with these details already exists. Check the information and try again.";
  } else if (
    errorName === "MongoParseError" ||
    errorName === "MongoInvalidArgumentError"
  ) {
    status = 500;
    code = "DATABASE_CONFIGURATION_ERROR";
    message = "Database connection settings are invalid. Ask an administrator to check the database configuration.";
  } else if (
    /(?:MONGODB_URI|SESSION_SECRET|AUTH_SECRET).*(?:required|must be set|must contain|invalid)/i.test(errorMessage)
  ) {
    status = 500;
    code = "SERVER_CONFIGURATION_ERROR";
    message = "A required server setting is missing or invalid. Ask an administrator to check the deployment configuration.";
  } else if (
    errorCode === 18 ||
    /authentication failed|authenticationfailed|bad auth|could not authenticate/i.test(errorMessage)
  ) {
    status = 503;
    code = "DATABASE_AUTHENTICATION_FAILED";
    message = "The database rejected its saved credentials. An administrator needs to check the MongoDB username and password.";
  } else if (
    /Mongo(?:ServerSelection|Network|NetworkTimeout|Socket|TopologyClosed|OperationTimeout|Timeout).*Error/.test(errorName) ||
    /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET/.test(errorCode === undefined ? "" : String(errorCode))
  ) {
    status = 503;
    code = "DATABASE_UNAVAILABLE";
    message = "The database could not be reached. Check the connection and Atlas network access, then try again.";
  }

  if (status >= 500 && !(error instanceof ZodError) && !(error instanceof SyntaxError)) {
    logServerError(operation, error, requestId);
  }

  return NextResponse.json(
    {
      success: false,
      error: message,
      code,
      requestId,
      ...(fieldErrors ? { fieldErrors } : {}),
    },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export function apiHttpErrorResponse(
  message: string,
  status: number,
  options: ApiErrorOptions
): NextResponse {
  return apiErrorResponse(new AppError(message, status), options);
}
