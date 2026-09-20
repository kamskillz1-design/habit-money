import { supabase } from "@/api/supabaseClient";

/** Merge auth.users + public.profiles (+ user_profiles fallback) into the shape pages already read. */
export async function loadMergedUser(sessionUser) {
  if (!sessionUser?.id) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", sessionUser.id)
    .maybeSingle();

  let extra = profile;
  if (!extra) {
    const { data: up } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", sessionUser.id)
      .maybeSingle();
    extra = up;
  }

  return {
    id: sessionUser.id,
    email: sessionUser.email || extra?.email || "",
    full_name: extra?.full_name || sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || "",
    role: extra?.role || "user",
    profile_photo: extra?.profile_photo || sessionUser.user_metadata?.avatar_url || "",
    preferred_language: extra?.preferred_language || "en",
    timezone: extra?.timezone || "UTC",
    default_currency: extra?.default_currency || "EUR",
    coaching_style: extra?.coaching_style || "practical",
    onboarding_completed: extra?.onboarding_completed ?? false,
    plan: extra?.plan || "free",
    account_status: extra?.account_status || "active",
    notification_frequency: extra?.notification_frequency,
    weekly_review_day: extra?.weekly_review_day,
  };
}

export function appOrigin() {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}
