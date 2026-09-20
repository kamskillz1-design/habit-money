import React, { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useTransactions, useCategories, useAccounts, useArchiveTransaction } from "@/app/services/finance";
import { useLoadDemoData } from "@/app/services/demo";
import TransactionDialog from "@/components/spending/TransactionDialog";
import ImportDialog from "@/components/spending/ImportDialog";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import EmptyState from "@/components/shared/EmptyState";
import DisclaimerBanner from "@/components/shared/DisclaimerBanner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney, formatDate, sumCents } from "@/domain/money";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis } from "recharts";
import { Plus, Download, Upload, Repeat, ArrowLeftRight, Undo2, Archive, Pencil, Copy, Receipt, PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils";

const PERIODS = { month: 0, last_month: -1, d90: -90, all: null };

export default function Spending() {
  const { t, language } = useI18n();
  const [params, setParams] = useSearchParams();
  const { data: transactions } = useTransactions();
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const archive = useArchiveTransaction();
  const demo = useLoadDemoData();

  const [dialog, setDialog] = useState({ open: false, initial: null, direction: "expense" });
  const [importOpen, setImportOpen] = useState(false);
  const [range, setRange] = useState("month");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [q, setQ] = useState(params.get("q") || "");
  const [limit, setLimit] = useState(20);

  const currency = "EUR";
  const loc = language === "es" ? "es-ES" : language;
  const fmt = (c) => formatMoney(c, currency, loc);
  const catById = useMemo(() => Object.fromEntries((categories || []).map((c) => [c.id, c])), [categories]);

  useEffect(() => {
    const add = params.get("add");
    if (add) {
      setDialog({ open: true, initial: null, direction: add === "income" ? "income" : "expense" });
      params.delete("add");
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let list = (transactions || []).filter((x) => !x.archived);
    const monthOffset = PERIODS[range];
    if (monthOffset === 0 || monthOffset === -1) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1).toISOString().slice(0, 10);
      const end = monthOffset === 0 ? new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10) : new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
      list = list.filter((x) => x.transaction_date >= start && x.transaction_date <= end);
    } else if (monthOffset === -90) {
      const start = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
      list = list.filter((x) => x.transaction_date >= start);
    }
    if (directionFilter !== "all") list = list.filter((x) => x.direction === directionFilter);
    if (categoryFilter !== "all") list = list.filter((x) => x.category_id === categoryFilter);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((x) => (x.merchant_name || "").toLowerCase().includes(needle) || (x.notes || "").toLowerCase().includes(needle) || (catById[x.category_id]?.name || "").toLowerCase().includes(needle));
    }
    const sorters = {
      newest: (a, b) => b.transaction_date.localeCompare(a.transaction_date),
      oldest: (a, b) => a.transaction_date.localeCompare(b.transaction_date),
      highest: (a, b) => b.amount - a.amount,
      lowest: (a, b) => a.amount - b.amount
    };
    return [...list].sort(sorters[sort]);
  }, [transactions, range, directionFilter, categoryFilter, q, sort, catById]);

  const totals = useMemo(() => {
    const eligible = filtered.filter((x) => !x.is_excluded_from_budget);
    return {
      income: sumCents(eligible.filter((x) => x.direction === "income"), (x) => x.amount),
      expenses: sumCents(eligible.filter((x) => x.direction === "expense"), (x) => x.amount),
      savings: sumCents(eligible.filter((x) => x.direction === "savings_contribution"), (x) => x.amount),
      transfers: sumCents(filtered.filter((x) => x.is_transfer), (x) => x.amount)
    };
  }, [filtered]);

  const byCategory = useMemo(() => {
    const map = {};
    filtered.filter((x) => x.direction === "expense" && !x.is_excluded_from_insights).forEach((x) => {
      const name = catById[x.category_id]?.name || t("category.other");
      map[name] = (map[name] || 0) + x.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered, catById, t]);

  const trend = useMemo(() => {
    const map = {};
    filtered.filter((x) => x.direction === "expense" && !x.is_excluded_from_insights).forEach((x) => {
      map[x.transaction_date] = (map[x.transaction_date] || 0) + x.amount;
    });
    return Object.entries(map).sort().map(([date, value]) => ({ date: date.slice(5), value: value / 100 }));
  }, [filtered]);

  const exportCsv = () => {
    const rows = [["date", "merchant", "category", "direction", "amount", "notes"]];
    filtered.forEach((x) => rows.push([x.transaction_date, x.merchant_name || "", catById[x.category_id]?.name || "", x.direction, (x.amount / 100).toFixed(2), (x.notes || "").replace(/[\n",]/g, " ")]));
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sign = (x) => (x.direction === "income" || x.direction === "refund" || x.direction === "transfer_in" ? "+" : x.direction === "expense" || x.direction === "transfer_out" || x.direction === "savings_contribution" || x.direction === "debt_payment" ? "−" : "");

  return (
    <div>
      <PageHeader
        title={t("spending.title")}
        subtitle={t("app.tagline")}
        action={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-1.5" aria-hidden />{t("import.title")}</Button>
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1.5" aria-hidden />{t("spending.exportCsv")}</Button>
            <Button onClick={() => setDialog({ open: true, initial: null, direction: "expense" })}><Plus className="h-4 w-4 mr-1.5" aria-hidden />{t("spending.addTransaction")}</Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="month">{t("common.thisMonth")}</SelectItem>
            <SelectItem value="last_month">{new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toLocaleDateString("en", { month: "long" })}</SelectItem>
            <SelectItem value="d90">90 {t("common.details")}</SelectItem>
            <SelectItem value="all">{t("common.all")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={directionFilter} onValueChange={setDirectionFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            {["income", "expense", "savings_contribution", "debt_payment", "refund"].map((d) => <SelectItem key={d} value={d}>{t("direction." + d)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            {(categories || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">{t("spending.sortNewest")}</SelectItem>
            <SelectItem value="oldest">{t("spending.sortOldest")}</SelectItem>
            <SelectItem value="highest">{t("spending.sortHighest")}</SelectItem>
            <SelectItem value="lowest">{t("spending.sortLowest")}</SelectItem>
          </SelectContent>
        </Select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("common.search")}
          aria-label={t("common.search")}
          className="flex-1 min-w-[160px] rounded-xl border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
      </div>

      {(transactions || []).length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={t("empty.transactions")}
          action={<Button variant="outline" onClick={() => demo.mutate()} disabled={demo.isPending}>{t("settings.demoData")}</Button>}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard label={t("spending.income")} value={fmt(totals.income)} icon={Plus} />
            <StatCard label={t("spending.expenses")} value={fmt(totals.expenses)} icon={Receipt} />
            <StatCard label={t("spending.savings")} value={fmt(totals.savings)} icon={PiggyBank} />
            <StatCard label={t("spending.netChange")} value={fmt(totals.income - totals.expenses - totals.savings)} tone={(totals.income - totals.expenses - totals.savings) >= 0 ? "accent" : "default"} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 mb-6">
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-sm font-semibold mb-2">{t("spending.byCategory")}</p>
              {byCategory.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">{t("common.empty")}</p> : (
                <div className="h-56">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={byCategory.slice(0, 6)} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                        {byCategory.slice(0, 6).map((_, i) => <Cell key={i} fill={["#1d4ed8", "#0d9488", "#b45309", "#7c3aed", "#15803d", "#64748b"][i]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="space-y-1">
                {byCategory.slice(0, 4).map((c, i) => (
                  <div key={c.name} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: ["#1d4ed8", "#0d9488", "#b45309", "#7c3aed"][i] }} />
                    <span className="truncate">{c.name}</span>
                    <span className="ml-auto font-medium tabular-nums">{fmt(c.value)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-sm font-semibold mb-2">{t("spending.trend")}</p>
              {trend.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">{t("common.empty")}</p> : (
                <div className="h-56">
                  <ResponsiveContainer>
                    <LineChart data={trend}>
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v + "€"} width={50} />
                      <Tooltip formatter={(v) => fmt(Math.round(v * 100))} />
                      <Line type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-card overflow-hidden">
            {filtered.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">{t("spending.noTransactions")}</p>
            ) : (
              <ul className="divide-y">
                {filtered.slice(0, limit).map((x) => (
                  <li key={x.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{x.merchant_name || t("direction." + x.direction)}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDate(x.transaction_date, loc)}</span>
                        {catById[x.category_id] && <span className="rounded-full bg-muted px-1.5 py-0.5">{catById[x.category_id].name}</span>}
                        {x.is_transfer && <span className="inline-flex items-center gap-0.5"><ArrowLeftRight className="h-3 w-3" aria-hidden />{t("spending.transfer")}</span>}
                        {x.is_recurring && <span className="inline-flex items-center gap-0.5"><Repeat className="h-3 w-3" aria-hidden />{t("spending.recurring")}</span>}
                        {x.is_refund && <span className="inline-flex items-center gap-0.5"><Undo2 className="h-3 w-3" aria-hidden />{t("spending.refund")}</span>}
                        {(x.is_excluded_from_budget || x.is_excluded_from_insights) && <span>{t("spending.excluded")}</span>}
                      </p>
                    </div>
                    <p className={cn("text-sm font-semibold tabular-nums shrink-0", sign(x) === "+" ? "text-chart-3" : sign(x) === "−" ? "text-foreground" : "text-muted-foreground")}>
                      {sign(x)}{fmt(x.amount)}
                    </p>
                    <div className="flex shrink-0 gap-1">
                      <button aria-label={t("common.edit")} onClick={() => setDialog({ open: true, initial: x, direction: x.direction })} className="rounded-lg p-1.5 hover:bg-muted"><Pencil className="h-3.5 w-3.5" aria-hidden /></button>
                      <button aria-label={t("spending.duplicate")} onClick={() => setDialog({ open: true, initial: { ...x, id: null }, direction: x.direction })} className="rounded-lg p-1.5 hover:bg-muted"><Copy className="h-3.5 w-3.5" aria-hidden /></button>
                      <button aria-label={t("common.archive")} onClick={() => archive.mutate({ id: x.id, archived: true })} className="rounded-lg p-1.5 hover:bg-muted"><Archive className="h-3.5 w-3.5" aria-hidden /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {filtered.length > limit && (
              <div className="p-3 text-center">
                <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + 20)}>{t("spending.showMore")}</Button>
              </div>
            )}
          </div>
          <DisclaimerBanner compact className="mt-6" />
        </>
      )}

      <TransactionDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        initial={dialog.initial}
        direction={dialog.direction}
        accounts={accounts}
        categories={categories}
      />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}