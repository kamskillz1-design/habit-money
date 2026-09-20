import { repo } from "@/adapters/base44/entities";
import { requireUser } from "@/adapters/base44/auth";
import { supabase } from "@/api/supabaseClient";

const MEMBER_ROLES = ["member", "viewer"];
const HOUSEHOLD_PLANS = ["household", "premium"];
const MAX_MEMBERS = 5;

export async function manageHousehold(body = {}) {
  const user = await requireUser();
  const now = new Date().toISOString();
  const action = body.action;

  if (action === "invite") {
    const { household_id, email, role } = body;
    if (!household_id || !email) return { ok: false, code: "validation_error" };
    const household = await repo("Household").get(household_id);
    if (!household || household.owner_user_id !== user.id) return { ok: false, code: "not_allowed" };
    const profiles = await repo("UserProfile").filter({ user_id: user.id }, undefined, 5);
    const plan = profiles[0]?.plan || "free";
    if (!HOUSEHOLD_PLANS.includes(plan)) return { ok: false, code: "plan_limit" };
    const existing = await repo("HouseholdMembership").filter({ household_id }, undefined, 50);
    const active = existing.filter((m) => m.status === "invited" || m.status === "active");
    if (active.length >= MAX_MEMBERS) return { ok: false, code: "plan_limit" };
    const targetEmail = String(email).trim().toLowerCase();
    const { data: invitedRows } = await supabase.from("profiles").select("id, email").eq("email", targetEmail).limit(5);
    if (!invitedRows || invitedRows.length === 0) return { ok: false, code: "user_not_found" };
    const invitedId = invitedRows[0].id;
    if (invitedId === user.id) return { ok: false, code: "validation_error" };
    if (active.some((m) => m.user_id === invitedId)) return { ok: false, code: "validation_error" };
    await repo("HouseholdMembership").create({
      household_id, user_id: invitedId,
      role: MEMBER_ROLES.includes(role) ? role : "member",
      status: "invited", invited_at: now,
      can_view_shared_transactions: true,
      can_add_shared_transactions: false,
      can_manage_shared_budget: false,
      can_manage_shared_goals: false
    });
    await repo("AuditLog").create({
      user_id: user.id, actor_user_id: user.id, action: "household_member_invited",
      entity_type: "HouseholdMembership", entity_id: household_id, occurred_at: now,
      safe_after_summary: JSON.stringify({ role })
    });
    return { ok: true };
  }

  if (action === "accept" || action === "decline") {
    const membership = await repo("HouseholdMembership").get(body.membership_id);
    if (!membership || membership.user_id !== user.id) return { ok: false, code: "not_allowed" };
    if (membership.status !== "invited") return { ok: false, code: "validation_error" };
    if (action === "accept") {
      await repo("HouseholdMembership").update(membership.id, { status: "active", joined_at: now });
      const household = await repo("Household").get(membership.household_id);
      if (household) {
        const ids = new Set(household.member_user_ids || []);
        ids.add(user.id);
        await repo("Household").update(household.id, { member_user_ids: Array.from(ids) });
      }
    } else {
      await repo("HouseholdMembership").update(membership.id, { status: "declined" });
    }
    await repo("AuditLog").create({
      user_id: user.id, actor_user_id: user.id,
      action: action === "accept" ? "household_invite_accepted" : "household_invite_declined",
      entity_type: "HouseholdMembership", entity_id: membership.id, occurred_at: now
    });
    return { ok: true };
  }

  if (action === "remove_member" || action === "leave") {
    const membership = await repo("HouseholdMembership").get(body.membership_id);
    if (!membership) return { ok: false, code: "not_allowed" };
    const household = await repo("Household").get(membership.household_id);
    if (action === "remove_member") {
      if (!household || household.owner_user_id !== user.id) return { ok: false, code: "not_allowed" };
    } else if (membership.user_id !== user.id) {
      return { ok: false, code: "not_allowed" };
    }
    await repo("HouseholdMembership").update(membership.id, { status: "removed", removed_at: now });
    if (household) {
      const ids = (household.member_user_ids || []).filter((id) => id !== membership.user_id);
      await repo("Household").update(household.id, { member_user_ids: ids });
    }
    await repo("AuditLog").create({
      user_id: user.id, actor_user_id: user.id,
      action: action === "remove_member" ? "household_member_removed" : "household_left",
      entity_type: "HouseholdMembership", entity_id: membership.id, occurred_at: now
    });
    return { ok: true };
  }

  if (action === "update_permissions") {
    const membership = await repo("HouseholdMembership").get(body.membership_id);
    if (!membership) return { ok: false, code: "not_allowed" };
    const household = await repo("Household").get(membership.household_id);
    if (!household || household.owner_user_id !== user.id) return { ok: false, code: "not_allowed" };
    const fields = {};
    for (const key of ["can_view_shared_transactions", "can_add_shared_transactions", "can_manage_shared_budget", "can_manage_shared_goals"]) {
      if (typeof body[key] === "boolean") fields[key] = body[key];
    }
    if (Object.keys(fields).length > 0) {
      await repo("HouseholdMembership").update(membership.id, fields);
      await repo("AuditLog").create({
        user_id: user.id, actor_user_id: user.id, action: "household_permissions_updated",
        entity_type: "HouseholdMembership", entity_id: membership.id, occurred_at: now,
        safe_after_summary: JSON.stringify(fields)
      });
    }
    return { ok: true };
  }

  return { ok: false, code: "validation_error" };
}
