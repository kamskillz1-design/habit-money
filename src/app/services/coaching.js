// Behavioural coaching: challenges, check-ins, nudges, achievements, rewards, weekly reviews.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { repo } from "@/adapters/base44/entities";
import { useAuth } from "@/lib/AuthContext";
import { writeAudit } from "./audit";
import { CHALLENGE_LIBRARY } from "@/domain/constants";
import { validateText } from "@/domain/validation";

export function useChallenges() {
  return useQuery({ queryKey: ["challenges"], queryFn: () => repo("UserChallenge").filter({}, "-created_date", 100) });
}

export function useAchievements() {
  return useQuery({ queryKey: ["achievements"], queryFn: () => repo("Achievement").filter({}, "-earned_at", 200) });
}

export function useRewardLedger() {
  return useQuery({ queryKey: ["rewardLedger"], queryFn: () => repo("RewardLedger").filter({}, "-created_date", 500) });
}

export function useNudges() {
  return useQuery({ queryKey: ["nudges"], queryFn: () => repo("Nudge").filter({}, "-created_date", 50) });
}

export function useWeeklyReviews() {
  return useQuery({ queryKey: ["weeklyReviews"], queryFn: () => repo("WeeklyReview").filter({}, "-period_start", 60) });
}

export function useCheckIn(dateStr) {
  return useQuery({
    queryKey: ["checkIn", dateStr],
    queryFn: async () => (await repo("DailyCheckIn").filter({ check_in_date: dateStr }, undefined, 5))[0] || null
  });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function useStartChallenge() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ libraryId, custom }) => {
      let title, description, challenge_type, duration_days, target_value, unit, difficulty, reward_points;
      if (custom) {
        const titleV = validateText(custom.title, { required: true, maxLength: 80 });
        const descV = validateText(custom.description, { maxLength: 500 });
        if (!titleV.ok) throw { code: "validation_error", errorKey: titleV.errorKey };
        title = titleV.value;
        description = descV.value;
        challenge_type = "custom";
        duration_days = 7;
        target_value = 1;
        unit = "completions";
        difficulty = "medium";
        reward_points = 10;
      } else {
        const tpl = CHALLENGE_LIBRARY.find((c) => c.id === libraryId);
        if (!tpl) throw { code: "validation_error", errorKey: "validation.enumInvalid" };
        title = tpl.titleKey;
        description = tpl.descKey;
        challenge_type = tpl.type;
        duration_days = tpl.duration_days;
        target_value = tpl.target_value;
        unit = tpl.unit;
        difficulty = tpl.difficulty;
        reward_points = tpl.points;
      }
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + duration_days);
      const created = await repo("UserChallenge").create({
        user_id: user.id,
        title,
        description,
        challenge_type,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        target_value,
        unit,
        status: "active",
        reward_points,
        current_progress: 0,
        completion_percentage: 0
      });
      await writeAudit({ userId: user.id, action: "challenge_started", entityType: "UserChallenge", entityId: created.id, after: { challenge_type } });
      return created;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["challenges"] })
  });
}

// Idempotent completion: reward points and achievements are only created once per challenge.
export function useCompleteChallenge() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (challenge) => {
      const now = new Date().toISOString();
      const updated = await repo("UserChallenge").update(challenge.id, {
        status: "completed",
        completed_at: now,
        completion_percentage: 100,
        current_progress: challenge.target_value
      });
      const existingLedger = await repo("RewardLedger").filter({ user_id: user.id, related_entity_type: "UserChallenge", related_entity_id: challenge.id }, undefined, 5);
      if (existingLedger.length === 0) {
        const ledger = await repo("RewardLedger").filter({}, "-created_date", 1);
        const balance = (ledger[0]?.balance_after || 0) + (challenge.reward_points || 10);
        await repo("RewardLedger").create({ user_id: user.id, points_change: challenge.reward_points || 10, reason: "challenge_completed", related_entity_type: "UserChallenge", related_entity_id: challenge.id, balance_after: balance });
        const existingFirst = await repo("Achievement").filter({ user_id: user.id, achievement_type: "first_challenge" }, undefined, 5);
        if (existingFirst.length === 0) {
          await repo("Achievement").create({ user_id: user.id, achievement_type: "first_challenge", title: "first_challenge", description: "Completed a first challenge", earned_at: now, badge_icon: "Award", related_entity_type: "UserChallenge", related_entity_id: challenge.id });
        } else {
          await repo("Achievement").create({ user_id: user.id, achievement_type: "challenge_streak", title: "challenge_streak", description: "Completed another challenge", earned_at: now, badge_icon: "Flame", related_entity_type: "UserChallenge", related_entity_id: challenge.id });
        }
      }
      await writeAudit({ userId: user.id, action: "challenge_completed", entityType: "UserChallenge", entityId: challenge.id });
      return updated;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["challenges"] });
      qc.invalidateQueries({ queryKey: ["achievements"] });
      qc.invalidateQueries({ queryKey: ["rewardLedger"] });
    }
  });
}

export function useUpdateChallengeProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, current_progress, target_value }) => {
      const pct = target_value > 0 ? Math.min(100, Math.round((current_progress / target_value) * 100)) : 0;
      return repo("UserChallenge").update(id, { current_progress, completion_percentage: pct });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["challenges"] })
  });
}

export function useSkipChallenge() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }) => {
      const reasonV = validateText(reason, { maxLength: 300 });
      const updated = await repo("UserChallenge").update(id, { status: "skipped", skipped_at: new Date().toISOString(), skip_reason: reasonV.value || undefined });
      await writeAudit({ userId: user.id, action: "challenge_skipped", entityType: "UserChallenge", entityId: id, reason: reasonV.value });
      return updated;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["challenges"] })
  });
}

export function useSubmitCheckIn() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fields) => {
      const date = todayStr();
      const existing = (await repo("DailyCheckIn").filter({ check_in_date: date }, undefined, 5))[0];
      const data = { ...fields, user_id: user.id, check_in_date: date };
      if (existing) return repo("DailyCheckIn").update(existing.id, data);
      return repo("DailyCheckIn").create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checkIn"] });
      qc.invalidateQueries({ queryKey: ["challenges"] });
    }
  });
}

export function useDismissNudge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => repo("Nudge").update(id, { status, dismissed_at: status === "dismissed" ? new Date().toISOString() : undefined }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nudges"] })
  });
}

// Saves a generated weekly review; avoids duplicates for the same period.
export function useSaveWeeklyReview() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (review) => {
      const existing = (await repo("WeeklyReview").filter({ period_start: review.period_start }, undefined, 5))[0];
      const data = { ...review, user_id: user.id };
      const saved = existing ? await repo("WeeklyReview").update(existing.id, data) : await repo("WeeklyReview").create(data);
      // Streak achievement: awarded once, only after at least two completed reviews.
      if (review.status === "completed") {
        const completed = await repo("WeeklyReview").filter({ status: "completed" }, undefined, 50);
        if (completed.length >= 2) {
          const hasStreak = (await repo("Achievement").filter({ user_id: user.id, achievement_type: "weekly_review_streak" }, undefined, 5)).length > 0;
          if (!hasStreak) {
            await repo("Achievement").create({ user_id: user.id, achievement_type: "weekly_review_streak", title: "weekly_review_streak", description: "Completed two weekly reviews", earned_at: new Date().toISOString(), badge_icon: "CalendarCheck" });
          }
        }
      }
      await writeAudit({ userId: user.id, action: "weekly_review_saved", entityType: "WeeklyReview", entityId: saved.id });
      return saved;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weeklyReviews"] });
      qc.invalidateQueries({ queryKey: ["achievements"] });
    }
  });
}