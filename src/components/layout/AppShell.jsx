import React from "react";
import { Outlet } from "react-router-dom";
import { useI18n } from "@/i18n";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MobileNav from "./MobileNav";
import DisclaimerBanner from "@/components/shared/DisclaimerBanner";

// Authenticated application shell: sidebar on desktop, bottom nav on mobile.
export default function AppShell() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-64">
        <Topbar />
        <main className="mx-auto max-w-6xl px-4 md:px-8 pt-6 pb-28 lg:pb-12">
          <Outlet />
        </main>
        <footer className="px-4 md:px-8 pb-28 lg:pb-10">
          <DisclaimerBanner compact />
          <p className="mt-2 text-center text-[11px] text-muted-foreground">{t("app.name")} · {t("app.tagline")}</p>
        </footer>
      </div>
      <MobileNav />
    </div>
  );
}