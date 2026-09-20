// Profile & consent application service. UI never touches the SDK.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { repo } from "@/adapters/base44/entities";
import { useAuth } from "@/lib/AuthContext";
import { writeAudit } from "./audit";
import { pickFields } from "@/domain/validation";

// Only user-writable profile fields — plan and audit fields are server-controlled.
const PROFILE_FIELDS = ["full_name", "preferred_language", "timezone", "default_currency", "coaching_style", "notification_frequency", "quiet_hours_start", "quiet_hours_end", "weekly_review_day", "onboarding_completed", "account_status", "last_login_at", "profile_photo"];

const CONSENT_TIMESTAMP_FIELDS = {
  terms_of_service: "terms_accepted_at",
  privacy_policy: "privacy_policy_accepted_at",
  financial_education_disclaimer: "financial_education_disclaimer_accepted_at"
};

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

// Terms + privacy + educational disclaimer acceptance: recorded on the profile, in consent history, and in the audit log.
export function useAcceptTerms() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ language }) => {
      const now = new Date().toISOString();
      const existing = (await repo("UserProfile").filter({}, "-created_date", 5))[0];
      const profileData = {
        user_id: user.id,
        preferred_language: language,
        terms_accepted_at: now,
        privacy_policy_accepted_at: now,
        financial_education_disclaimer_accepted_at: now,
        onboarding_completed: false,
        account_status: "active"
      };
      const profile = existing ? await repo("UserProfile").update(existing.id, profileData) : await repo("UserProfile").create(profileData);
      await repo("ConsentRecord").bulkCreate(
        ["terms_of_service", "privacy_policy", "financial_education_disclaimer"].map((type) => ({
          user_id: user.id,
          consent_type: type,
          status: "granted",
          granted_at: now,
          source: "onboarding"
        }))
      );
      await writeAudit({ userId: user.id, action: "terms_accepted", entityType: "UserProfile", entityId: profile.id, after: { accepted: true } });
      return profile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["userProfile"] });
      qc.invalidateQueries({ queryKey: ["consents"] });
    }
  });
}