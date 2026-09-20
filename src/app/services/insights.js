// Explainable insight rendering support: dismissal state persists per insight key.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { repo } from "@/adapters/base44/entities";
import { useAuth } from "@/lib/AuthContext";

export function useDismissedInsights() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["dismissedInsights"],
    queryFn: () => repo("Insight").filter({ status: "dismissed" }, "-created_date", 200),
    enabled: !!user?.id
  });
}

export function useDismissInsight() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ insight, status }) => {
      const data = {
        user_id: user.id,
        insight_type: insight.type,
        title: insight.key,
        message: insight.key,
        explanation: insight.key,
        status: status === "unhelpful" ? "unhelpful" : "dismissed",
        dismissed_at: new Date().toISOString(),
        related_category_id: insight.related_category_id,
        related_goal_id: insight.related_goal_id,
        user_feedback: status
      };
      // One dismissal record per insight key.
      const existing = await repo("Insight").filter({ title: insight.key, user_id: user.id }, undefined, 5);
      if (existing.length > 0) return existing[0];
      return repo("Insight").create(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dismissedInsights"] })
  });
}