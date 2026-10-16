export class AppError extends Error {
  public statusCode: number;
  public details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ClashError extends AppError {
  constructor(message = "Time slot is unavailable. Toto is already reserved for this period.", details?: unknown) {
    super(message, 409, details);
    this.name = "ClashError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict.", details?: unknown) {
    super(message, 409, details);
    this.name = "ConflictError";
  }
}

export class VehicleBusyError extends AppError {
  constructor(message = "Toto is currently on an active trip or reserved. Please complete or release the current trip first.", details?: unknown) {
    super(message, 423, details); // 423 Locked
    this.name = "VehicleBusyError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required.", details?: unknown) {
    super(message, 401, details);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.", details?: unknown) {
    super(message, 403, details);
    this.name = "ForbiddenError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed.", details?: unknown) {
    super(message, 400, details);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found.", details?: unknown) {
    super(message, 404, details);
    this.name = "NotFoundError";
  }
}
