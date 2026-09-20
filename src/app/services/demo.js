// Loads the realistic example dataset through the protected backend function (idempotent per user).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeFunction } from "@/adapters/base44/functions";
import { useI18n } from "@/i18n";

export function useLoadDemoData() {
  const qc = useQueryClient();
  const { language } = useI18n();
  return useMutation({
    mutationFn: () => invokeFunction("loadDemoData", { language }),
    onSuccess: () => qc.invalidateQueries()
  });
}