import { repo } from "@/adapters/base44/entities";
import { requireUser } from "@/adapters/base44/auth";

const MAX_ROWS = 2000;
const DIRECTIONS = ["income", "expense", "savings_contribution", "debt_payment", "refund"];

function splitCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const counts = { ",": 0, ";": 0, "\t": 0 };
  for (const ch of firstLine) if (counts[ch] !== undefined) counts[ch]++;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const delimiter = sorted[0][1] > 0 ? sorted[0][0] : ",";
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function parseAmountCents(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  s = s.replace(/[^\d,.\-]/g, "");
  if (s.startsWith("-")) { negative = true; s = s.slice(1); }
  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(/,/g, ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, "");
    else s = s.replace(/,/g, ".");
  } else if (lastDot > -1) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  }
  const n = Number(s);
  if (!isFinite(n) || s === "") return null;
  const cents = Math.round(Math.abs(n) * 100);
  return negative ? -cents : cents;
}

function parseDate(raw) {
  const s = String(raw || "").trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    let d = m[1], mo = m[2], y = m[3];
    if (y.length === 2) y = "20" + y;
    if (Number(mo) > 12 && Number(d) <= 12) { const tmp = d; d = mo; mo = tmp; }
    if (Number(d) > 31 || Number(mo) > 12) return null;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function directionFromCell(raw, fallback) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return fallback;
  if (/(ingres|abon|deposit|nomina|nómina|sarrera|credit|crédito)/.test(s)) return "income";
  if (/(gasto|gast|expense|debit|cargo|pago)/.test(s)) return "expense";
  if (/(transferen|transfer)/.test(s)) return "transfer_out";
  if (/(ahorr|saving|aurrezki)/.test(s)) return "savings_contribution";
  return fallback;
}

function suggestMapping(headers) {
  const patterns = {
    date: /(fecha|date|data|d[ií]a)/,
    amount: /(importe|amount|cantidad|valor|mont|euros?|eur|€|\$)/,
    description: /(desc|concept|detalle|asunto|referencia)/,
    merchant: /(merchant|comercio|tienda|denda|establec)/,
    category: /(categ|rubro)/
  };
  const mapping = {};
  for (const key of Object.keys(patterns)) {
    mapping[key] = "none";
    for (let i = 0; i < headers.length; i++) {
      if (patterns[key].test((headers[i] || "").toLowerCase())) { mapping[key] = String(i); break; }
    }
  }
  return mapping;
}

export async function importCsv(body = {}) {
  const user = await requireUser();
  if (!body.file_url) return { ok: false, code: "validation_error" };

  const fileRes = await fetch(body.file_url);
  if (!fileRes.ok) return { ok: false, code: "file_error" };
  const text = await fileRes.text();
  if (text.length > 5 * 1024 * 1024) return { ok: false, code: "file_too_large" };
  const rows = splitCsv(text);
  if (!rows || rows.length < 2) return { ok: false, code: "no_rows" };
  const headers = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1, MAX_ROWS + 1);

  if (body.mode === "preview") {
    return {
      ok: true,
      headers,
      row_count: dataRows.length,
      sample_rows: dataRows.slice(0, 8),
      suggested_mapping: suggestMapping(headers)
    };
  }

  if (body.mode === "commit") {
    const mapping = body.mapping || {};
    if (mapping.date == null || mapping.date === "none" || mapping.amount == null || mapping.amount === "none") {
      return { ok: false, code: "validation_error" };
    }
    const col = (v) => (v == null || v === "none" ? null : Number(v));
    const dateCol = col(mapping.date), amountCol = col(mapping.amount);
    const descCol = col(mapping.description), merchantCol = col(mapping.merchant);
    const categoryCol = col(mapping.category), directionCol = col(mapping.direction);

    const accounts = await repo("Account").filter({ user_id: user.id }, undefined, 50);
    const account = accounts.find((a) => a.id === body.account_id) || accounts[0];
    if (!account) return { ok: false, code: "no_account" };

    const categories = await repo("Category").filter({}, undefined, 200);
    const catByLower = {};
    for (const c of categories) catByLower[String(c.name || "").trim().toLowerCase()] = c.id;

    const defaultDirection = DIRECTIONS.includes(body.default_direction) ? body.default_direction : "expense";
    const seen = {};
    const transactions = [];
    let accepted = 0, duplicates = 0, rejected = 0;

    for (const row of dataRows) {
      const date = parseDate(row[dateCol]);
      const cents = parseAmountCents(row[amountCol]);
      if (!date || cents === null || cents === 0) { rejected++; continue; }
      const description = descCol != null ? String(row[descCol] || "").trim().slice(0, 200) : "";
      const merchant = merchantCol != null ? String(row[merchantCol] || "").trim().slice(0, 120) : "";
      const catRaw = categoryCol != null ? String(row[categoryCol] || "").trim().toLowerCase() : "";
      const direction = directionCol != null ? directionFromCell(row[directionCol], defaultDirection) : defaultDirection;
      const key = `${date}|${cents}|${merchant || description}|${direction}`;
      if (seen[key]) { duplicates++; continue; }
      seen[key] = true;
      const tx = {
        user_id: user.id,
        account_id: account.id,
        transaction_date: date,
        amount: Math.abs(cents),
        direction,
        description: description || undefined,
        merchant_name: merchant || undefined,
        source: "CSV_import",
        active: true,
        archived: false
      };
      const catId = catByLower[catRaw];
      if (catId) tx.category_id = catId;
      transactions.push(tx);
      accepted++;
    }

    if (transactions.length === 0) return { ok: false, code: "no_rows" };

    const now = new Date().toISOString();
    const batch = await repo("ImportBatch").create({
      user_id: user.id,
      source: "CSV_import",
      source_file_name: body.file_name || "import.csv",
      imported_at: now,
      status: "importing",
      total_rows: dataRows.length
    });
    for (let i = 0; i < transactions.length; i += 400) {
      const chunk = transactions.slice(i, i + 400).map((tx, j) => ({
        ...tx,
        import_batch_id: batch.id,
        idempotency_key: `csv-${batch.id}-${i + j}`
      }));
      await repo("Transaction").bulkCreate(chunk);
    }
    await repo("ImportBatch").update(batch.id, {
      status: "completed",
      accepted_rows: accepted,
      duplicate_rows: duplicates,
      rejected_rows: rejected,
      completed_at: new Date().toISOString()
    });
    await repo("AuditLog").create({
      user_id: user.id, actor_user_id: user.id, action: "csv_import_completed",
      entity_type: "ImportBatch", entity_id: batch.id, occurred_at: now,
      safe_after_summary: JSON.stringify({ accepted, duplicates, rejected })
    });
    return {
      ok: true, batch_id: batch.id,
      total_rows: dataRows.length, accepted_rows: accepted,
      duplicate_rows: duplicates, rejected_rows: rejected
    };
  }

  return { ok: false, code: "validation_error" };
}
