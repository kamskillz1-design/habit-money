import React from "react";
import { Navigate } from "react-router-dom";
import { useUserProfile } from "@/app/services/profile";
import AppShell from "./AppShell";

// Gate: authenticated users complete onboarding (terms + preferences) before the main app.
export default function RequireOnboarding() {
  const { data: profile, isLoading } = useUserProfile();
  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" role="status" />
      </div>
    );
  }
  if (!profile || !profile.onboarding_completed) {
    return <Navigate to="/onboarding" replace />;
  }
  return <AppShell />;
}