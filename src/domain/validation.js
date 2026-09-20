// Boundary validation. Returns { ok, errorKey, params } — errorKey is an i18n key, never a translated string.

export function validateAmountCents(input, { min = 1, max = 100000000000 } = {}) {
  const cents = typeof input === "number" ? input : NaN;
  if (!Number.isInteger(cents)) return { ok: false, errorKey: "validation.amountInvalid" };
  if (cents < min || cents > max) return { ok: false, errorKey: "validation.amountRange" };
  return { ok: true, value: cents };
}

export function validateDate(input) {
  if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return { ok: false, errorKey: "validation.dateInvalid" };
  const d = new Date(input + "T00:00:00");
  if (Number.isNaN(d.getTime())) return { ok: false, errorKey: "validation.dateInvalid" };
  return { ok: true, value: input };
}

export function validateEnum(input, allowed) {
  if (!allowed.includes(input)) return { ok: false, errorKey: "validation.enumInvalid" };
  return { ok: true, value: input };
}

export function validateText(input, { maxLength = 500, required = false } = {}) {
  const s = typeof input === "string" ? input.trim() : "";
  if (required && !s) return { ok: false, errorKey: "validation.required" };
  if (s.length > maxLength) return { ok: false, errorKey: "validation.tooLong", params: { max: maxLength } };
  // Strip control characters; rendering escapes everything else.
  const clean = s.replace(/[\u0000-\u001F\u007F]/g, "");
  return { ok: true, value: clean };
}

export function validateId(input) {
  if (!input || typeof input !== "string") return { ok: false, errorKey: "validation.required" };
  return { ok: true, value: input };
}

// Explicit writable-field selection prevents mass assignment.
export function pickFields(payload, allowedFields) {
  const out = {};
  for (const f of allowedFields) if (payload[f] !== undefined) out[f] = payload[f];
  return out;
}

export function firstError(validations) {
  for (const v of validations) if (v && v.ok === false) return v;
  return null;
}