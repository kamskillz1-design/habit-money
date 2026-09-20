// Auth adapter. Same exports as before; backed by Supabase.
import { supabase } from "@/api/supabaseClient";
import { loadMergedUser } from "@/api/authUser";

export async function getCurrentUser() {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return null;
    return await loadMergedUser(data.user);
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user || !user.id) {
    throw { code: "auth_required", error: "Authentication required" };
  }
  return user;
}

export function signOut(redirectUrl) {
  supabase.auth.signOut().finally(() => {
    if (typeof window !== "undefined") {
      window.location.href = redirectUrl || "/";
    }
  });
}

export function hasRole(user, role) {
  return !!user && user.role === role;
}
