export interface ApiEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  requestId?: string;
  fieldErrors?: Record<string, string[]>;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;

  constructor(message: string, status: number, code: string, requestId?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function statusMessage(status: number, operation: string): string {
  const action = operation.replace(/[.!?]+$/, "") || "complete this request";
  switch (status) {
    case 400:
      return `The information for ${action} is invalid. Check the fields and try again.`;
    case 401:
      return `Sign in is required to ${action}. Please sign in again.`;
    case 403:
      return `Your account is not allowed to ${action}.`;
    case 404:
      return `The item needed to ${action} could not be found. Refresh and try again.`;
    case 405:
      return `This action is not available here. Refresh the page and try again.`;
    case 408:
      return `The request to ${action} timed out. Check your connection and try again.`;
    case 409:
      return `The item changed before we could ${action}. Refresh and try again.`;
    case 410:
      return `This ${action} is no longer available.`;
    case 413:
      return `The information sent to ${action} is too large. Remove some details and try again.`;
    case 415:
      return `The submitted information format is not supported. Refresh the page and try again.`;
    case 422:
      return `Some information for ${action} needs correction. Check the fields and try again.`;
    case 423:
      return `The Toto is currently reserved, so we could not ${action}.`;
    case 429:
      return `Too many attempts to ${action}. Wait a moment and try again.`;
    case 502:
    case 503:
    case 504:
      return `The service is temporarily unavailable while trying to ${action}. Please try again shortly.`;
    case 501:
      return `This action is not supported by the current service.`;
    default:
      return `We couldn't ${action} (HTTP ${status}). Please try again.`;
  }
}

export async function fetchApi<T = unknown>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  operation: string
): Promise<ApiEnvelope<T>> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiRequestError(`The request to ${operation} was cancelled. Try again.`, 0, "REQUEST_CANCELLED");
    }
    throw new ApiRequestError(
      `A network connection error stopped us from trying to ${operation}. Check your connection and try again.`,
      0,
      "NETWORK_ERROR"
    );
  }

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    const message = response.ok
      ? `The server returned an unreadable response while trying to ${operation}. Please refresh and try again.`
      : statusMessage(response.status, operation);
    throw new ApiRequestError(message, response.status, "INVALID_SERVER_RESPONSE");
  }

  if (!payload || typeof payload !== "object") {
    throw new ApiRequestError(
      `The server returned an invalid response while trying to ${operation}. Please refresh and try again.`,
      response.status,
      "INVALID_SERVER_RESPONSE"
    );
  }

  if (!response.ok || payload.success === false) {
    throw new ApiRequestError(
      typeof payload.error === "string" && payload.error.trim()
        ? payload.error
        : statusMessage(response.status, operation),
      response.status,
      payload.code || `HTTP_${response.status}`,
      payload.requestId
    );
  }

  if (payload.success !== true) {
    throw new ApiRequestError(
      `The server response was incomplete while trying to ${operation}. Please refresh and try again.`,
      response.status,
      "INVALID_SERVER_RESPONSE",
      payload.requestId
    );
  }

  return payload;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
