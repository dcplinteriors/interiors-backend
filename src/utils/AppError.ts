/**
 * Operational error carrying an HTTP status code. Thrown by services/controllers
 * and translated to a response by the error-handling middleware.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly isOperational = true,
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace?.(this, this.constructor);
  }
}
