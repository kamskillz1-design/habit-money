// Profile & consent application service.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { repo } from "@/adapters/base44/entities";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { writeAudit } from "./audit";
import { pickFields } from "@/domain/validation";

const PROFILE_FIELDS = ["full_name", "preferred_language", "timezone", "default_currency", "coaching_style", "notification_frequency", "quiet_hours_start", "quiet_hours_end", "weekly_review_day", "onboarding_completed", "account_status", "last_login_at", "profile_photo"];

export function useUserProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => (await repo("UserProfile").filter({}, "-created_date", 5))[0] || null,
    enabled: !!user?.id
  });
}

export function useFinancialProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["financialProfile", user?.id],
    queryFn: async () => (await repo("FinancialProfile").filter({}, "-created_date", 5))[0] || null,
    enabled: !!user?.id
  });
}

export function useSaveUserProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fields) => {
      const existing = (await repo("UserProfile").filter({}, "-created_date", 5))[0];
      const data = { ...pickFields(fields, PROFILE_FIELDS), user_id: user.id };
      if (existing) return repo("UserProfile").update(existing.id, data);
      return repo("UserProfile").create(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["userProfile"] })
  });
}

export function useSaveFinancialProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fields) => {
      const existing = (await repo("FinancialProfile").filter({}, "-created_date", 5))[0];
      const data = { ...fields, user_id: user.id };
      if (existing) return repo("FinancialProfile").update(existing.id, data);
      return repo("FinancialProfile").create(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financialProfile"] })
  });
}

export function useAcceptTerms() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ language }) => {
      if (!user?.id) throw new Error("Not signed in");
      const now = new Date().toISOString();
      const row = {
        id: user.id,
        user_id: user.id,
        email: user.email || null,
        full_name: user.full_name || null,
        preferred_language: language || "es",
        terms_accepted_at: now,
        privacy_policy_accepted_at: now,
        financial_education_disclaimer_accepted_at: now,
        onboarding_completed: false,
        account_status: "active",
      };

      await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email || null,
          full_name: user.full_name || null,
          preferred_language: language || "es",
          terms_accepted_at: now,
          privacy_policy_accepted_at: now,
          financial_education_disclaimer_accepted_at: now,
          onboarding_completed: false,
          account_status: "active",
        },
        { onConflict: "id" }
      );

      const { data, error } = await supabase
        .from("user_profiles")
        .upsert(row, { onConflict: "user_id" })
        .select("*")
        .maybeSingle();
      if (error) throw error;

      try {
        await repo("ConsentRecord").bulkCreate(
          ["terms_of_service", "privacy_policy", "financial_education_disclaimer"].map((type) => ({
            user_id: user.id,
            consent_type: type,
            status: "granted",
            granted_at: now,
            source: "onboarding",
          }))
        );
      } catch (e) {
        console.warn("consent_write_failed", e?.message || e);
      }
      await writeAudit({
        userId: user.id,
        action: "terms_accepted",
        entityType: "UserProfile",
        entityId: data?.id || user.id,
        after: { accepted: true },
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["userProfile"] });
      qc.invalidateQueries({ queryKey: ["consents"] });
    },
  });
}
