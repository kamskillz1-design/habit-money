import React, { useState } from "react";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/AuthContext";
import { useHouseholds, useHouseholdMemberships, useCreateHousehold, useHouseholdAction } from "@/app/services/household";
import PageHeader from "@/components/shared/PageHeader";
import DisclaimerBanner from "@/components/shared/DisclaimerBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, UserPlus, LogOut, Check, X, Home } from "lucide-react";

const PERMISSION_KEYS = ["can_view_shared_transactions", "can_add_shared_transactions", "can_manage_shared_budget", "can_manage_shared_goals"];

// Household sharing screen: create a household, invite members by email, manage per-member
// sharing permissions, and accept/decline invitations addressed to the current user.
export default function Household() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data: households } = useHouseholds();
  const { data: memberships } = useHouseholdMemberships();
  const createHousehold = useCreateHousehold();
  const action = useHouseholdAction();

  const [name, setName] = useState("");
  const [invite, setInvite] = useState({ email: "", role: "member" });
  const [msg, setMsg] = useState(null); // { ok, key }

  const household = (households || [])[0] || null;
  const isOwner = household && household.owner_user_id === user.id;
  const myInvites = (memberships || []).filter((m) => m.user_id === user.id && m.status === "invited");
  const members = (memberships || []).filter((m) => m.household_id === household?.id && ["invited", "active"].includes(m.status));

  const run = async (payload, successKey) => {
    setMsg(null);
    const res = await action.mutateAsync(payload);
    if (res?.ok) {
      setMsg({ ok: true, key: successKey || "common.done" });
    } else {
      const code = res?.code === "plan_limit" ? "plan_limit"
        : res?.code === "user_not_found" ? "household.userNotFound"
        : "common.error";
      setMsg({ ok: false, key: code });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("settings.household")} subtitle={t("app.tagline")} />
      <p className="max-w-2xl text-sm text-muted-foreground">{t("household.shareNote")}</p>
      {msg && (
        <p className={`text-sm font-medium ${msg.ok ? "text-chart-3" : "text-destructive"}`} role="status">{t(msg.key)}</p>
      )}

      {myInvites.length > 0 && (
        <section className="rounded-2xl border bg-card p-4">
          <p className="mb-3 text-sm font-semibold">{t("household.pending")}</p>
          <ul className="space-y-2">
            {myInvites.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
                <span className="text-sm">{t("household.invite")} · {t("household." + (m.role === "viewer" ? "viewer" : "member"))}</span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => run({ action: "accept", membership_id: m.id }, "common.done")}><Check className="h-3.5 w-3.5 mr-1" aria-hidden />{t("household.accept")}</Button>
                  <Button size="sm" variant="outline" onClick={() => run({ action: "decline", membership_id: m.id }, "common.done")}><X className="h-3.5 w-3.5 mr-1" aria-hidden />{t("household.decline")}</Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!household ? (
        <section className="rounded-2xl border bg-card p-6 max-w-lg">
          <p className="mb-3 text-sm text-muted-foreground">{t("household.none")}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label className="text-xs">{t("household.name")}</Label>
              <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("household.name")} />
            </div>
            <Button
              disabled={!name.trim() || createHousehold.isPending}
              onClick={async () => { await createHousehold.mutateAsync({ name: name.trim() }); setName(""); }}
            >
              <Home className="h-4 w-4 mr-1.5" aria-hidden />{createHousehold.isPending ? t("common.loading") : t("household.create")}
            </Button>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border bg-card p-4">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-accent" aria-hidden />
            <p className="font-display text-xl font-semibold">{household.name}</p>
          </div>

          {isOwner && (
            <div className="mb-5 rounded-xl border p-3">
              <p className="mb-2 text-sm font-semibold">{t("household.invite")}</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Label className="text-xs">{t("household.email")}</Label>
                  <Input className="mt-1" type="email" value={invite.email} onChange={(e) => setInvite((s) => ({ ...s, email: e.target.value }))} placeholder="nombre@ejemplo.com" />
                </div>
                <div className="w-full sm:w-40">
                  <Label className="text-xs">{t("household.role")}</Label>
                  <Select value={invite.role} onValueChange={(v) => setInvite((s) => ({ ...s, role: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">{t("household.member")}</SelectItem>
                      <SelectItem value="viewer">{t("household.viewer")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  disabled={!invite.email.trim() || action.isPending}
                  onClick={() => run({ action: "invite", household_id: household.id, email: invite.email.trim(), role: invite.role }, "household.inviteSent").then(() => setInvite({ email: "", role: invite.role }))}
                >
                  <UserPlus className="h-4 w-4 mr-1.5" aria-hidden />{action.isPending ? t("common.loading") : t("household.invite")}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t("household.planRequired")}</p>
            </div>
          )}

          <p className="mb-2 text-sm font-semibold">{t("household.members")}</p>
          <ul className="space-y-2">
            {members.map((m) => {
              const roleLabel = m.role === "owner" ? t("household.owner") : m.role === "viewer" ? t("household.viewer") : t("household.member");
              return (
                <li key={m.id} className="rounded-xl border px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{roleLabel}</span>
                    {m.status === "invited" && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t("household.pending")}</span>}
                    {m.user_id === user.id && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{t("auth.account")}</span>}
                    <div className="ml-auto flex gap-1">
                      {isOwner && m.role !== "owner" && m.status === "active" && (
                        <Button size="sm" variant="outline" onClick={() => run({ action: "remove_member", membership_id: m.id })}>
                          <X className="h-3.5 w-3.5 mr-1" aria-hidden />{t("household.remove")}
                        </Button>
                      )}
                      {!isOwner && m.user_id === user.id && m.status === "active" && (
                        <Button size="sm" variant="outline" onClick={() => run({ action: "leave", membership_id: m.id })}>
                          <LogOut className="h-3.5 w-3.5 mr-1" aria-hidden />{t("household.leave")}
                        </Button>
                      )}
                    </div>
                  </div>
                  {isOwner && m.status === "active" && m.role !== "owner" && (
                    <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {PERMISSION_KEYS.map((key) => (
                        <label key={key} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-1.5 text-xs">
                          {t("household." + ({
                            can_view_shared_transactions: "viewShared",
                            can_add_shared_transactions: "addShared",
                            can_manage_shared_budget: "manageBudget",
                            can_manage_shared_goals: "manageGoals"
                          }[key]))}
                          <Switch
                            checked={!!m[key]}
                            disabled={action.isPending}
                            onCheckedChange={(v) => run({ action: "update_permissions", membership_id: m.id, [key]: v })}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <DisclaimerBanner />
    </div>
  );
}