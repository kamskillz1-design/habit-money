// Decimal-safe money handling: all money is stored and calculated as integer cents (minor units).

export function toCents(input) {
  if (typeof input === "number" && Number.isInteger(input)) return input;
  if (input === null || input === undefined || input === "") return NaN;
  let s = String(input).replace(/[€$£\s]/g, "");
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) s = s.replace(/\./g, "").replace(",", ".");
  else if (hasComma) s = s.replace(",", ".");
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

export function centsToNumber(cents) {
  return (cents || 0) / 100;
}

export function formatMoney(cents, currency = "EUR", locale) {
  const loc = locale || (typeof navigator !== "undefined" ? navigator.language : "en");
  return new Intl.NumberFormat(loc, { style: "currency", currency: currency || "EUR" }).format((cents || 0) / 100);
}

export function sumCents(list, pick = (x) => x) {
  return (list || []).reduce((acc, item) => acc + (pick(item) || 0), 0);
}

export function formatDate(dateStr, locale) {
  if (!dateStr) return "";
  const d = typeof dateStr === "string" ? new Date(dateStr + (dateStr.length === 10 ? "T00:00:00" : "")) : dateStr;
  return new Intl.DateTimeFormat(locale || "en", { day: "numeric", month: "short", year: "numeric" }).format(d);
}