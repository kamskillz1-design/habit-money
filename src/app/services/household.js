// Household sharing. Creation and reads go through the entity adapter; membership changes
// (invite/accept/decline/remove/leave) go through the protected manageHousehold function.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { repo } from "@/adapters/base44/entities";
import { invokeFunction } from "@/adapters/base44/functions";
import { useAuth } from "@/lib/AuthContext";
import { writeAudit } from "./audit";

export function useHouseholds() {
  return useQuery({ queryKey: ["households"], queryFn: () => repo("Household").filter({}, "-created_date", 20) });
}

export function useHouseholdMemberships() {
  return useQuery({ queryKey: ["householdMemberships"], queryFn: () => repo("HouseholdMembership").filter({}, "-created_date", 100) });
}

export function useCreateHousehold() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name }) => {
      const now = new Date().toISOString();
      const household = await repo("Household").create({
        owner_user_id: user.id,
        name,
        member_user_ids: [user.id],
        default_currency: "EUR",
        active: true
      });
      await repo("HouseholdMembership").create({
        household_id: household.id,
        user_id: user.id,
        role: "owner",
        status: "active",
        invited_at: now,
        joined_at: now,
        can_view_shared_transactions: true,
        can_add_shared_transactions: true,
        can_manage_shared_budget: true,
        can_manage_shared_goals: true
      });
      await writeAudit({ userId: user.id, action: "household_created", entityType: "Household", entityId: household.id, after: { name } });
      return household;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["households"] });
      qc.invalidateQueries({ queryKey: ["householdMemberships"] });
    }
  });
}

export function useHouseholdAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => invokeFunction("manageHousehold", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["households"] });
      qc.invalidateQueries({ queryKey: ["householdMemberships"] });
    }
  });
}

// Marks a record as shared with the active household by adding its member ids to member_user_ids.
// Row-level security then shows the record to those members — nothing else is exposed.
export function useShareWithHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ entity, id }) => {
      const households = await repo("Household").filter({}, "-created_date", 5);
      const household = households[0];
      if (!household || !household.member_user_ids || household.member_user_ids.length === 0) return null;
      return repo(entity).update(id, { is_shared: true, member_user_ids: household.member_user_ids });
    },
    onSuccess: () => qc.invalidateQueries()
  });
}