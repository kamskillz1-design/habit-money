// Entity CRUD façade. Same function names the services already import.
// Backed by Supabase; entity names stay PascalCase Base44 names.
import { supabase } from "@/api/supabaseClient";

export const ENTITY_TABLES = {
  Account: "accounts",
  Achievement: "achievements",
  AuditLog: "audit_logs",
  BudgetAllocation: "budget_allocations",
  BudgetPeriod: "budget_periods",
  Category: "categories",
  ChallengeTemplate: "challenge_templates",
  ConsentRecord: "consent_records",
  DailyCheckIn: "daily_check_ins",
  DataExportRequest: "data_export_requests",
  FinancialProfile: "financial_profiles",
  GoalContribution: "goal_contributions",
  Household: "households",
  HouseholdMembership: "household_memberships",
  ImportBatch: "import_batches",
  Insight: "insights",
  IntegrationConnection: "integration_connections",
  Notification: "notifications",
  Nudge: "nudges",
  PrivacyRequest: "privacy_requests",
  RecurringItem: "recurring_items",
  RewardLedger: "reward_ledger",
  SavingsGoal: "savings_goals",
  Scenario: "scenarios",
  ScenarioResult: "scenario_results",
  Transaction: "transactions",
  User: "profiles",
  UserChallenge: "user_challenges",
  UserProfile: "user_profiles",
  WebhookEvent: "webhook_events",
  WeeklyReview: "weekly_reviews",
};

const SORT_ALIASES = {
  created_date: "created_at",
  updated_date: "updated_at",
  created_by_id: "created_by",
};

const WRITE_ALIASES = {
  created_date: "created_at",
  updated_date: "updated_at",
  created_by_id: "created_by",
};

function tableFor(entityName) {
  const table = ENTITY_TABLES[entityName];
  if (!table) throw new Error(`Unknown entity: ${entityName}`);
  return table;
}

function mapSortKey(key) {
  if (!key) return { column: "created_at", ascending: false };
  let raw = key;
  let ascending = true;
  if (raw.startsWith("-")) {
    ascending = false;
    raw = raw.slice(1);
  }
  return { column: SORT_ALIASES[raw] || raw, ascending };
}

function stripUndefined(obj) {
  const out = {};
  if (!obj) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function toDbPayload(data) {
  const src = stripUndefined(data);
  const out = {};
  for (const [k, v] of Object.entries(src)) {
    const col = WRITE_ALIASES[k] || k;
    out[col] = v;
  }
  return out;
}

function fromDbRow(row) {
  if (!row) return row;
  return {
    ...row,
    created_date: row.created_at ?? row.created_date,
    updated_date: row.updated_at ?? row.updated_date,
    created_by_id: row.created_by ?? row.created_by_id,
  };
}

function applyFilters(query, raw) {
  const filters = stripUndefined(raw);
  for (const [key, value] of Object.entries(filters)) {
    const col = WRITE_ALIASES[key] || key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (Array.isArray(value.$in)) {
        query = query.in(col, value.$in);
        continue;
      }
      if (value.$eq !== undefined) {
        query = query.eq(col, value.$eq);
        continue;
      }
      if (value.$ne !== undefined) {
        query = query.neq(col, value.$ne);
        continue;
      }
      if (value.$gte !== undefined) query = query.gte(col, value.$gte);
      if (value.$lte !== undefined) query = query.lte(col, value.$lte);
      if (value.$gt !== undefined) query = query.gt(col, value.$gt);
      if (value.$lt !== undefined) query = query.lt(col, value.$lt);
      continue;
    }
    query = query.eq(col, value);
  }
  return query;
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

function assertOk(error, context) {
  if (error) {
    const err = new Error(error.message || context);
    err.code = error.code;
    err.details = error.details;
    throw err;
  }
}

export function repo(entityName) {
  const table = tableFor(entityName);

  return {
    async list(sort, limit) {
      return this.filter({}, sort, limit);
    },

    async filter(query, sort, limit) {
      const { column, ascending } = mapSortKey(sort);
      let q = supabase.from(table).select("*");
      q = applyFilters(q, query);
      q = q.order(column, { ascending, nullsFirst: false });
      if (limit != null) q = q.limit(limit);
      const { data, error } = await q;
      assertOk(error, `filter ${entityName}`);
      return (data || []).map(fromDbRow);
    },

    async get(id) {
      const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
      assertOk(error, `get ${entityName}`);
      return fromDbRow(data);
    },

    async create(data) {
      const payload = toDbPayload(data);
      if (!payload.created_by) {
        const uid = await currentUserId();
        if (uid) payload.created_by = uid;
      }
      const { data: row, error } = await supabase.from(table).insert(payload).select("*").single();
      assertOk(error, `create ${entityName}`);
      return fromDbRow(row);
    },

    async bulkCreate(arr) {
      const uid = await currentUserId();
      const rows = (arr || []).map((item) => {
        const payload = toDbPayload(item);
        if (!payload.created_by && uid) payload.created_by = uid;
        return payload;
      });
      if (!rows.length) return [];
      const { data, error } = await supabase.from(table).insert(rows).select("*");
      assertOk(error, `bulkCreate ${entityName}`);
      return (data || []).map(fromDbRow);
    },

    async update(id, data) {
      const payload = toDbPayload(data);
      delete payload.id;
      const { data: row, error } = await supabase.from(table).update(payload).eq("id", id).select("*").single();
      assertOk(error, `update ${entityName}`);
      return fromDbRow(row);
    },

    async updateMany(query, ops) {
      const set = ops?.$set ? toDbPayload(ops.$set) : toDbPayload(ops || {});
      let q = supabase.from(table).update(set);
      q = applyFilters(q, query);
      const { data, error } = await q.select("id");
      assertOk(error, `updateMany ${entityName}`);
      return { updated: (data || []).length, ids: (data || []).map((r) => r.id) };
    },

    async deleteMany(query) {
      let q = supabase.from(table).delete();
      q = applyFilters(q, query);
      const { data, error } = await q.select("id");
      assertOk(error, `deleteMany ${entityName}`);
      return { deleted: (data || []).length, ids: (data || []).map((r) => r.id) };
    },
  };
}
