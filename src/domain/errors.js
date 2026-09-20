// Stable, machine-readable error codes. Only these codes cross boundaries; the presentation layer translates.

export const ERROR_CODES = {
  VALIDATION: "validation_error",
  AUTH_REQUIRED: "auth_required",
  FORBIDDEN: "forbidden",
  NOT_FOUND: "not_found",
  CONFLICT: "conflict",
  DEPENDENCY: "dependency_error",
  SERVER: "server_error"
};

export function okResult(data) {
  return { ok: true, ...(data || {}) };
}

export function errorResult(code, message) {
  return { ok: false, error: message || code, code };
}