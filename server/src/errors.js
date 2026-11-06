/** An error that is safe to show to the user. */
export class AppError extends Error {
  constructor(status, code, message, hint = '', fields = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.hint = hint;
    this.fields = fields;
  }
}

export const notFound = () =>
  new AppError(404, 'NOT_FOUND', 'We could not find that request.', 'It may have been removed, or you may not have access to it.');

export const forbidden = (message = 'You do not have permission to do that.', hint = 'Sign in with the right account or ask your manager.') =>
  new AppError(403, 'FORBIDDEN', message, hint);

export const conflict = (code, message, hint) => new AppError(409, code, message, hint);

export function validationError(fields, message = 'Some details need fixing before we can continue.') {
  return new AppError(400, 'VALIDATION_FAILED', message, 'Check the highlighted fields and try again.', fields);
}
