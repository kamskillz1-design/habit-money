import React from "react";
import { useI18n } from "@/i18n";
import PageHeader from "@/components/shared/PageHeader";
import DisclaimerBanner from "@/components/shared/DisclaimerBanner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LifeBuoy } from "lucide-react";

const GUIDES = [
  ["help.gettingStarted", "help.gettingStartedBody"],
  ["help.addingTransactions", "help.addingTransactionsBody"],
  ["help.budget", "help.budgetBody"],
  ["help.goals", "help.goalsBody"],
  ["help.challenges", "help.challengesBody"],
  ["help.scenarios", "help.scenariosBody"],
  ["help.bills", "help.billsBody"],
  ["help.privacy", "help.privacyBody"],
  ["help.household", "help.householdBody"],
  ["help.integrations", "help.integrationsBody"],
  ["help.notAdvice", "help.notAdviceBody"]
];

export default function Help() {
  const { t } = useI18n();
  return (
    <div className="max-w-3xl">
      <PageHeader title={t("help.title")} subtitle={t("app.tagline")} />
      <Accordion type="single" collapsible className="rounded-2xl border bg-card px-4">
        {GUIDES.map(([titleKey, bodyKey]) => (
          <AccordionItem key={titleKey} value={titleKey}>
            <AccordionTrigger className="text-sm font-semibold text-left">
              <span className="flex items-center gap-2"><LifeBuoy className="h-4 w-4 text-accent" aria-hidden />{t(titleKey)}</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed">{t(bodyKey)}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <DisclaimerBanner className="mt-6" />
    </div>
  );
}