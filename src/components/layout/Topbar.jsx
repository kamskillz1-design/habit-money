import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/AuthContext";
import { useUserProfile } from "@/app/services/profile";
import { useNudges, useDismissNudge } from "@/app/services/coaching";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import LanguageSwitcher from "@/components/shared/LanguageSwitcher";
import { Search, Bell, LogOut, Settings as SettingsIcon, Sparkles, X } from "lucide-react";

export default function Topbar() {
  const { t, language } = useI18n();
  const { user, logout } = useAuth();
  const { data: profile } = useUserProfile();
  const { data: nudges } = useNudges();
  const dismiss = useDismissNudge();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const activeNudges = (nudges || []).filter((n) => n.status === "displayed" || n.status === "scheduled").slice(0, 6);
  const name = profile?.full_name || user?.full_name || user?.email?.split("@")[0] || "";

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-16 items-center gap-3 px-4 md:px-8">
        <form
          className="flex-1 max-w-md"
          onSubmit={(e) => { e.preventDefault(); if (q.trim()) navigate(`/spending?q=${encodeURIComponent(q.trim())}`); }}
          role="search"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("common.search")}
              aria-label={t("common.search")}
              className="w-full rounded-xl border border-input bg-card pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
        </form>
        <div className="ml-auto flex items-center gap-2">
          <Popover>
            <PopoverTrigger className="relative rounded-xl p-2 hover:bg-muted transition-colors" aria-label={t("today.dailyNudge")}>
              <Bell className="h-5 w-5 text-muted-foreground" aria-hidden />
              {activeNudges.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" />}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <p className="mb-2 text-sm font-semibold">{t("today.dailyNudge")}</p>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {activeNudges.length === 0 && <p className="text-sm text-muted-foreground">{t("today.noNudge")}</p>}
                {activeNudges.map((n) => (
                  <div key={n.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{n.title.startsWith("challenge.") || n.title.startsWith("nudge.") ? t(n.title) : n.title}</p>
                      <button onClick={() => dismiss.mutate({ id: n.id, status: "dismissed" })} aria-label={t("insights.dismiss")} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                    <p className="mt-1 text-muted-foreground text-xs leading-relaxed">{n.message?.startsWith("challenge.") || n.message?.startsWith("nudge.") ? t(n.message) : n.message}</p>
                    {n.action_url && (
                      <button className="mt-2 text-xs font-medium text-accent hover:underline" onClick={() => navigate(n.action_url)}>
                        {n.explanation ? t("common.details") : t("common.review")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <LanguageSwitcher compact />
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors" aria-label={t("auth.account")}>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                {name ? name[0].toUpperCase() : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
              </span>
              <span className="hidden md:inline max-w-[140px] truncate">{name}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-3 py-2">
                <p className="text-sm font-medium truncate">{name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                {profile?.plan && <p className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">{profile.plan}</p>}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <SettingsIcon className="h-4 w-4 mr-2" aria-hidden /> {t("nav.settings")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/privacy")}>
                <LogOut className="h-4 w-4 mr-2" aria-hidden /> {t("nav.privacy")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout("/login")} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4 mr-2" aria-hidden /> {t("auth.signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}