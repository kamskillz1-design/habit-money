-- HabitMoney Coach — unified schema
-- Run ONCE in the Supabase SQL Editor.
-- Re-run: drop schema public cascade is destructive; prefer IF NOT EXISTS + skip trigger recreate errors,
-- or reset the project. This file uses IF NOT EXISTS where Postgres allows it.
-- Tables are EMPTY. Old Base44 rows are not imported here.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (auth.users companion)
-- Mirrors User + UserProfile fields the UI/auth layer reads.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  profile_photo text,
  preferred_language text default 'en',
  timezone text default 'UTC',
  default_currency text default 'EUR',
  coaching_style text default 'practical'
    check (coaching_style is null or coaching_style in ('gentle', 'practical', 'motivating', 'minimal')),
  notification_frequency text default 'essential_only'
    check (notification_frequency is null or notification_frequency in ('none', 'essential_only', 'daily', 'weekly', 'personalised')),
  quiet_hours_start text,
  quiet_hours_end text,
  weekly_review_day text default 'Sunday',
  onboarding_completed boolean default false,
  account_status text default 'active'
    check (account_status is null or account_status in ('active', 'paused', 'pending_deletion', 'deleted', 'suspended')),
  financial_education_disclaimer_accepted_at timestamptz,
  terms_accepted_at timestamptz,
  privacy_policy_accepted_at timestamptz,
  last_login_at timestamptz,
  plan text default 'free'
    check (plan is null or plan in ('free', 'plus', 'household', 'premium')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.user_profiles (id, user_id, email, full_name)
  values (
    new.id,
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- UserProfile entity (1:1 with auth user; façade repo("UserProfile"))
-- ---------------------------------------------------------------------------
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  full_name text,
  email text,
  profile_photo text,
  preferred_language text default 'en',
  timezone text default 'UTC',
  default_currency text default 'EUR',
  coaching_style text default 'practical'
    check (coaching_style is null or coaching_style in ('gentle', 'practical', 'motivating', 'minimal')),
  notification_frequency text default 'essential_only'
    check (notification_frequency is null or notification_frequency in ('none', 'essential_only', 'daily', 'weekly', 'personalised')),
  quiet_hours_start text,
  quiet_hours_end text,
  weekly_review_day text default 'Sunday',
  onboarding_completed boolean default false,
  account_status text default 'active'
    check (account_status is null or account_status in ('active', 'paused', 'pending_deletion', 'deleted', 'suspended')),
  financial_education_disclaimer_accepted_at timestamptz,
  terms_accepted_at timestamptz,
  privacy_policy_accepted_at timestamptz,
  last_login_at timestamptz,
  plan text default 'free'
    check (plan is null or plan in ('free', 'plus', 'household', 'premium')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Households first (referenced by many tables)
-- ---------------------------------------------------------------------------
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  default_currency text default 'EUR',
  timezone text,
  active boolean default true,
  sharing_description text,
  member_user_ids uuid[] default '{}',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_memberships (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text default 'member' check (role is null or role in ('owner', 'member', 'viewer')),
  status text default 'invited' check (status is null or status in ('invited', 'active', 'removed', 'declined')),
  can_view_shared_transactions boolean default false,
  can_add_shared_transactions boolean default false,
  can_manage_shared_budget boolean default false,
  can_manage_shared_goals boolean default false,
  invited_at timestamptz,
  joined_at timestamptz,
  removed_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Financial profile, accounts, categories, transactions, recurring
-- ---------------------------------------------------------------------------
create table if not exists public.financial_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  monthly_income_target integer,
  income_frequency text
    check (income_frequency is null or income_frequency in ('weekly', 'biweekly', 'monthly', 'irregular', 'prefer_not_to_say')),
  essential_expense_target integer,
  current_cash_estimate integer,
  emergency_fund_target integer,
  primary_financial_priority text
    check (primary_financial_priority is null or primary_financial_priority in (
      'reduce_spending', 'build_emergency_fund', 'save_for_goal', 'manage_bills', 'reduce_debt', 'understand_habits', 'other'
    )),
  primary_goal_id uuid,
  preferred_budget_method text
    check (preferred_budget_method is null or preferred_budget_method in (
      'category_budget', 'zero_based', '50_30_20', 'flexible', 'no_budget'
    )),
  debt_tracking_enabled boolean default false,
  bank_connection_enabled boolean default false,
  onboarding_step integer default 0,
  data_confidence_level text default 'low'
    check (data_confidence_level is null or data_confidence_level in ('low', 'medium', 'high')),
  safe_to_spend_enabled boolean default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  name text not null,
  type text not null check (type in (
    'cash', 'current_account', 'savings_account', 'credit_card', 'loan', 'investment_reference', 'other'
  )),
  currency text default 'EUR',
  institution_name text,
  opening_balance integer,
  current_balance integer,
  last_balance_update_at timestamptz,
  source text default 'manual' check (source is null or source in ('manual', 'CSV_import', 'open_banking', 'demo')),
  external_provider text,
  external_account_id text,
  connection_status text default 'not_connected'
    check (connection_status is null or connection_status in (
      'not_connected', 'connected', 'needs_reauth', 'sync_error', 'disconnected'
    )),
  is_shared boolean default false,
  include_in_cashflow boolean default true,
  include_in_net_worth boolean default true,
  active boolean default true,
  archived boolean default false,
  member_user_ids uuid[] default '{}',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  name text not null,
  category_type text not null check (category_type in (
    'income', 'essential_expense', 'discretionary_expense', 'savings', 'debt_payment', 'transfer', 'other'
  )),
  icon text,
  color text,
  is_essential boolean default false,
  is_temptation_category boolean default false,
  default_budget_amount integer,
  active boolean default true,
  archived boolean default false,
  display_order integer,
  is_system boolean default false,
  member_user_ids uuid[] default '{}',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  source text not null check (source in ('CSV_import', 'open_banking', 'demo')),
  source_file_name text,
  file_size integer,
  imported_at timestamptz,
  status text default 'uploaded' check (status is null or status in (
    'uploaded', 'mapping_required', 'validating', 'review_required', 'importing', 'completed', 'failed', 'cancelled'
  )),
  total_rows integer,
  accepted_rows integer,
  duplicate_rows integer,
  rejected_rows integer,
  review_required_rows integer,
  mapping_configuration jsonb,
  error_report_reference text,
  completed_at timestamptz,
  error_message text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  name text not null,
  category_id uuid references public.categories (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  amount integer not null,
  direction text not null check (direction in ('income', 'expense', 'savings_contribution', 'debt_payment')),
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'custom')),
  next_due_date date not null,
  last_processed_date date,
  billing_day integer,
  merchant_name text,
  is_subscription boolean default false,
  reminder_days_before integer default 3,
  status text default 'active' check (status is null or status in ('active', 'paused', 'cancelled', 'ended')),
  notes text,
  active boolean default true,
  archived boolean default false,
  member_user_ids uuid[] default '{}',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  account_id uuid not null references public.accounts (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  transaction_date date not null,
  posted_date date,
  amount integer not null,
  direction text not null check (direction in (
    'income', 'expense', 'transfer_in', 'transfer_out', 'savings_contribution', 'debt_payment', 'refund'
  )),
  merchant_name text,
  merchant_normalized text,
  description text,
  notes text,
  source text default 'manual' check (source is null or source in (
    'manual', 'CSV_import', 'open_banking', 'recurring_generated', 'demo'
  )),
  external_transaction_id text,
  import_batch_id uuid references public.import_batches (id) on delete set null,
  idempotency_key text,
  recurring_item_id uuid references public.recurring_items (id) on delete set null,
  is_recurring boolean default false,
  is_transfer boolean default false,
  is_refund boolean default false,
  is_excluded_from_budget boolean default false,
  is_excluded_from_insights boolean default false,
  is_shared boolean default false,
  attachment_reference text,
  confidence_score double precision,
  reviewed_at timestamptz,
  active boolean default true,
  archived boolean default false,
  member_user_ids uuid[] default '{}',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Budget
-- ---------------------------------------------------------------------------
create table if not exists public.budget_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  period_start date not null,
  period_end date not null,
  month_label text,
  income_planned integer,
  income_actual integer,
  total_expense_budget integer,
  total_expense_actual integer,
  total_savings_target integer,
  total_savings_actual integer,
  budget_method text check (budget_method is null or budget_method in (
    'category_budget', 'zero_based', '50_30_20', 'flexible', 'no_budget'
  )),
  status text default 'active' check (status is null or status in ('draft', 'active', 'closed', 'archived')),
  completed_at timestamptz,
  member_user_ids uuid[] default '{}',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budget_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  budget_period_id uuid not null references public.budget_periods (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  planned_amount integer not null,
  actual_amount integer,
  variance_amount integer,
  alert_threshold_percentage integer default 80,
  alert_sent_80_at timestamptz,
  alert_sent_100_at timestamptz,
  notes text,
  member_user_ids uuid[] default '{}',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Goals
-- ---------------------------------------------------------------------------
create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  name text not null,
  description text,
  target_amount integer not null,
  current_amount integer default 0,
  currency text default 'EUR',
  start_date date,
  target_date date,
  priority text default 'medium' check (priority is null or priority in ('low', 'medium', 'high', 'urgent')),
  goal_type text default 'other' check (goal_type is null or goal_type in (
    'emergency_fund', 'travel', 'home', 'education', 'purchase', 'debt_reduction', 'buffer', 'other'
  )),
  image text,
  status text default 'active' check (status is null or status in ('active', 'paused', 'completed', 'cancelled', 'archived')),
  suggested_weekly_contribution integer,
  suggested_monthly_contribution integer,
  auto_contribution_enabled boolean default false,
  is_shared boolean default false,
  completed_at timestamptz,
  archived boolean default false,
  member_user_ids uuid[] default '{}',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  goal_id uuid not null references public.savings_goals (id) on delete cascade,
  transaction_id uuid references public.transactions (id) on delete set null,
  contribution_date date not null,
  amount integer not null,
  source text default 'manual' check (source is null or source in (
    'manual', 'transaction_linked', 'recurring', 'challenge_reward', 'imported', 'adjustment'
  )),
  note text,
  created_by_user_id uuid references public.profiles (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.financial_profiles
  drop constraint if exists financial_profiles_primary_goal_id_fkey;
alter table public.financial_profiles
  add constraint financial_profiles_primary_goal_id_fkey
  foreign key (primary_goal_id) references public.savings_goals (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Coaching
-- ---------------------------------------------------------------------------
create table if not exists public.challenge_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  challenge_type text not null check (challenge_type in (
    'no_spend_day', 'no_spend_weekend', 'save_amount', 'expense_logging_streak',
    'home_cooking', 'subscription_review', 'wait_24_hours', 'budget_check_in',
    'emergency_fund_starter', 'custom'
  )),
  duration_days integer default 1,
  target_type text check (target_type is null or target_type in (
    'days_logged', 'amount_saved', 'days_completed', 'count', 'none'
  )),
  default_target_value integer,
  difficulty text default 'easy' check (difficulty is null or difficulty in ('easy', 'medium', 'hard')),
  category_focus text,
  rules text,
  positive_feedback_text text,
  completion_reward_points integer default 10,
  active boolean default true,
  is_system_template boolean default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  challenge_template_id uuid references public.challenge_templates (id) on delete set null,
  title text not null,
  description text,
  challenge_type text not null check (challenge_type in (
    'no_spend_day', 'no_spend_weekend', 'save_amount', 'expense_logging_streak',
    'home_cooking', 'subscription_review', 'wait_24_hours', 'budget_check_in',
    'emergency_fund_starter', 'custom'
  )),
  start_date date not null,
  end_date date,
  target_value integer,
  current_progress integer default 0,
  unit text default 'days',
  status text default 'active' check (status is null or status in (
    'not_started', 'active', 'completed', 'skipped', 'expired', 'cancelled'
  )),
  completion_percentage integer default 0,
  reward_points integer,
  selected_category_id uuid references public.categories (id) on delete set null,
  reflection_note text,
  completed_at timestamptz,
  skipped_at timestamptz,
  skip_reason text,
  created_from_nudge_id uuid,
  member_user_ids uuid[] default '{}',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  check_in_date date not null,
  spending_confidence text check (spending_confidence is null or spending_confidence in (
    'very_low', 'low', 'neutral', 'high', 'very_high'
  )),
  mood_optional text,
  spent_intentionally boolean,
  completed_challenge_action boolean default false,
  note text,
  selected_focus_for_tomorrow text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nudges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  nudge_type text not null check (nudge_type in (
    'transaction_logging', 'budget_awareness', 'spending_pattern', 'goal_progress',
    'upcoming_bill', 'challenge_progress', 'weekly_review', 'subscription_review',
    'positive_reinforcement', 'data_quality', 'custom'
  )),
  title text not null,
  message text not null,
  explanation text,
  recommended_action text,
  action_url text,
  priority text default 'normal' check (priority is null or priority in ('low', 'normal', 'high')),
  scheduled_at timestamptz,
  displayed_at timestamptz,
  acted_at timestamptz,
  dismissed_at timestamptz,
  dismissed_reason text,
  status text default 'displayed' check (status is null or status in (
    'scheduled', 'displayed', 'acted_on', 'dismissed', 'expired', 'disabled'
  )),
  related_entity_type text,
  related_entity_id text,
  unique_deduplication_key text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  achievement_type text not null check (achievement_type in (
    'first_transaction', 'first_budget', 'first_goal', 'first_contribution',
    'first_challenge', 'challenge_streak', 'savings_milestone', 'weekly_review_streak',
    'no_spend_streak', 'budget_check_in_streak', 'data_cleanup', 'custom'
  )),
  title text not null,
  description text,
  earned_at timestamptz,
  progress_value integer,
  target_value integer,
  badge_icon text,
  related_entity_type text,
  related_entity_id text,
  is_visible boolean default true,
  member_user_ids uuid[] default '{}',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  points_change integer not null,
  reason text not null,
  related_entity_type text,
  related_entity_id text,
  balance_after integer,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  period_start date not null,
  period_end date not null,
  total_income integer,
  total_spending integer,
  total_savings integer,
  planned_budget_amount integer,
  actual_budget_amount integer,
  largest_category text,
  spending_change_from_prior_period integer,
  goal_progress_summary text,
  challenge_summary text,
  positive_win text,
  reflection_prompt text,
  user_reflection text,
  next_week_focus text,
  completed_at timestamptz,
  generated_at timestamptz,
  status text default 'generated' check (status is null or status in ('generated', 'viewed', 'completed', 'skipped')),
  member_user_ids uuid[] default '{}',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  insight_type text not null check (insight_type in (
    'spending_change', 'category_pattern', 'recurring_bill', 'budget_variance',
    'goal_momentum', 'savings_opportunity', 'data_quality', 'positive_progress', 'custom'
  )),
  title text not null,
  message text not null,
  explanation text,
  confidence_level text check (confidence_level is null or confidence_level in ('low', 'medium', 'high')),
  period_start date,
  period_end date,
  related_category_id uuid references public.categories (id) on delete set null,
  related_goal_id uuid references public.savings_goals (id) on delete set null,
  related_transaction_ids_summary text,
  status text default 'active' check (status is null or status in ('active', 'viewed', 'dismissed', 'unhelpful')),
  viewed_at timestamptz,
  dismissed_at timestamptz,
  user_feedback text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Scenarios
-- ---------------------------------------------------------------------------
create table if not exists public.scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  name text not null,
  scenario_type text not null check (scenario_type in (
    'savings_growth', 'weekly_saving', 'spending_reduction', 'subscription_cancellation',
    'emergency_fund', 'debt_payoff', 'custom'
  )),
  start_date date,
  duration_months integer,
  current_balance integer,
  recurring_contribution_amount integer,
  contribution_frequency text default 'monthly'
    check (contribution_frequency is null or contribution_frequency in ('weekly', 'biweekly', 'monthly', 'yearly')),
  one_time_contribution_amount integer,
  assumed_annual_rate_percentage double precision default 0,
  annual_inflation_percentage double precision default 0,
  include_inflation boolean default false,
  use_zero_return_baseline boolean default true,
  debt_balance integer,
  debt_interest_rate_percentage double precision,
  extra_debt_payment_amount integer,
  baseline_result jsonb,
  projected_result jsonb,
  assumptions_text text,
  disclaimer_acknowledged_at timestamptz,
  archived boolean default false,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scenario_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  scenario_id uuid not null references public.scenarios (id) on delete cascade,
  month_number integer not null,
  date date,
  contribution_amount integer,
  estimated_growth_amount integer,
  inflation_adjusted_value integer,
  remaining_debt_balance integer,
  cumulative_contributions integer,
  projected_balance integer,
  zero_return_balance integer,
  assumptions_version text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Privacy / audit / integrations
-- ---------------------------------------------------------------------------
create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  consent_type text not null check (consent_type in (
    'terms_of_service', 'privacy_policy', 'financial_education_disclaimer',
    'essential_service_email', 'product_updates_email', 'marketing_email',
    'push_notifications', 'analytics_optional', 'open_banking_connection', 'household_sharing'
  )),
  status text default 'granted' check (status is null or status in ('granted', 'withdrawn', 'not_required')),
  policy_version text,
  consent_text text,
  granted_at timestamptz,
  withdrawn_at timestamptz,
  source text,
  ip_hash text,
  user_agent_summary text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  request_type text not null check (request_type in (
    'data_access', 'data_export', 'correction', 'anonymisation', 'deletion', 'account_closure', 'consent_withdrawal'
  )),
  status text default 'submitted' check (status is null or status in (
    'submitted', 'verification_required', 'verified', 'approved', 'rejected', 'processing', 'completed', 'cancelled'
  )),
  verification_status text default 'pending' check (verification_status is null or verification_status in ('pending', 'verified', 'failed')),
  requested_at timestamptz,
  reviewed_by_admin_id uuid references public.profiles (id),
  reviewed_at timestamptz,
  completed_at timestamptz,
  legal_hold boolean default false,
  request_notes text,
  admin_notes text,
  result_reference text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.data_export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  export_type text not null check (export_type in (
    'transactions', 'budgets', 'goals', 'challenges', 'scenarios', 'full_personal_data', 'household_shared_data'
  )),
  requested_at timestamptz,
  status text default 'requested' check (status is null or status in (
    'requested', 'processing', 'completed', 'expired', 'failed', 'cancelled'
  )),
  filters jsonb,
  secure_file_reference text,
  expires_at timestamptz,
  completed_at timestamptz,
  downloaded_at timestamptz,
  error_message text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  actor_user_id uuid references public.profiles (id),
  action text not null,
  entity_type text not null,
  entity_id text,
  safe_before_summary text,
  safe_after_summary text,
  occurred_at timestamptz,
  session_reference text,
  ip_hash text,
  user_agent_summary text,
  request_reference text,
  reason text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  integration_type text not null check (integration_type in (
    'CSV_import', 'open_banking', 'email_notifications', 'push_notifications',
    'calendar', 'payment_subscription', 'webhook', 'other'
  )),
  provider_name text,
  connection_status text default 'disconnected' check (connection_status is null or connection_status in (
    'disconnected', 'connecting', 'connected', 'needs_reauth', 'sync_error', 'disabled'
  )),
  connected_at timestamptz,
  last_sync_at timestamptz,
  last_successful_sync_at timestamptz,
  last_error_at timestamptz,
  last_error_message_safe text,
  configuration_safe jsonb,
  consent_record_id uuid references public.consent_records (id) on delete set null,
  active boolean default false,
  disconnected_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  message text not null,
  notification_type text,
  priority text default 'normal' check (priority is null or priority in ('low', 'normal', 'high')),
  related_entity_type text,
  related_entity_id text,
  action_url text,
  scheduled_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  dismissed_at timestamptz,
  channel text default 'in_app' check (channel is null or channel in ('in_app', 'email', 'push')),
  delivery_status text default 'delivered' check (delivery_status is null or delivery_status in (
    'queued', 'sent', 'delivered', 'failed', 'suppressed'
  )),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  integration_connection_id uuid references public.integration_connections (id) on delete set null,
  provider_name text,
  external_event_id text,
  event_type text,
  received_at timestamptz,
  processed_at timestamptz,
  processing_status text default 'received' check (processing_status is null or processing_status in (
    'received', 'processing', 'processed', 'ignored', 'failed', 'dead_letter'
  )),
  retry_count integer default 0,
  payload_hash text,
  error_message_safe text,
  related_entity_type text,
  related_entity_id text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at triggers for all tables that have the column
do $$
declare
  t text;
begin
  foreach t in array array[
    'user_profiles','households','household_memberships','financial_profiles','accounts','categories',
    'import_batches','recurring_items','transactions','budget_periods','budget_allocations',
    'savings_goals','goal_contributions','challenge_templates','user_challenges','daily_check_ins',
    'nudges','achievements','reward_ledger','weekly_reviews','insights','scenarios','scenario_results',
    'consent_records','privacy_requests','data_export_requests','audit_logs','integration_connections',
    'notifications','webhook_events'
  ]
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute procedure public.set_updated_at()',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- Policy helper: owner is user_id (or owner_user_id / created_by) OR member of member_user_ids.
-- Use (select auth.uid()) so the planner treats it as a single InitPlan value.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_memberships enable row level security;
alter table public.financial_profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.import_batches enable row level security;
alter table public.recurring_items enable row level security;
alter table public.transactions enable row level security;
alter table public.budget_periods enable row level security;
alter table public.budget_allocations enable row level security;
alter table public.savings_goals enable row level security;
alter table public.goal_contributions enable row level security;
alter table public.challenge_templates enable row level security;
alter table public.user_challenges enable row level security;
alter table public.daily_check_ins enable row level security;
alter table public.nudges enable row level security;
alter table public.achievements enable row level security;
alter table public.reward_ledger enable row level security;
alter table public.weekly_reviews enable row level security;
alter table public.insights enable row level security;
alter table public.scenarios enable row level security;
alter table public.scenario_results enable row level security;
alter table public.consent_records enable row level security;
alter table public.privacy_requests enable row level security;
alter table public.data_export_requests enable row level security;
alter table public.audit_logs enable row level security;
alter table public.integration_connections enable row level security;
alter table public.notifications enable row level security;
alter table public.webhook_events enable row level security;

-- profiles
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- user_profiles
drop policy if exists user_profiles_select_own on public.user_profiles;
create policy user_profiles_select_own on public.user_profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists user_profiles_insert_own on public.user_profiles;
create policy user_profiles_insert_own on public.user_profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists user_profiles_update_own on public.user_profiles;
create policy user_profiles_update_own on public.user_profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists user_profiles_delete_own on public.user_profiles;
create policy user_profiles_delete_own on public.user_profiles
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- households
drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select to authenticated
  using (
    owner_user_id = (select auth.uid())
    or (select auth.uid()) = any (member_user_ids)
  );

drop policy if exists households_insert on public.households;
create policy households_insert on public.households
  for insert to authenticated
  with check (owner_user_id = (select auth.uid()));

drop policy if exists households_update on public.households;
create policy households_update on public.households
  for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

drop policy if exists households_delete on public.households;
create policy households_delete on public.households
  for delete to authenticated
  using (owner_user_id = (select auth.uid()));

-- memberships: member or household owner
drop policy if exists memberships_select on public.household_memberships;
create policy memberships_select on public.household_memberships
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.households h
      where h.id = household_id and h.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists memberships_insert on public.household_memberships;
create policy memberships_insert on public.household_memberships
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.households h
      where h.id = household_id and h.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists memberships_update on public.household_memberships;
create policy memberships_update on public.household_memberships
  for update to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.households h
      where h.id = household_id and h.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists memberships_delete on public.household_memberships;
create policy memberships_delete on public.household_memberships
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.households h
      where h.id = household_id and h.owner_user_id = (select auth.uid())
    )
  );

-- Generic owner-or-member policy factory via SQL for user-owned tables
do $$
declare
  t text;
  owner_col text;
begin
  foreach t in array array[
    'financial_profiles','accounts','categories','import_batches','recurring_items','transactions',
    'budget_periods','budget_allocations','savings_goals','goal_contributions','user_challenges',
    'daily_check_ins','nudges','achievements','reward_ledger','weekly_reviews','insights',
    'scenarios','scenario_results','consent_records','privacy_requests','data_export_requests',
    'audit_logs','integration_connections','notifications'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);

    if t in ('accounts','categories','recurring_items','transactions','budget_periods','budget_allocations','savings_goals','user_challenges','achievements','weekly_reviews') then
      execute format(
        'create policy %I_select on public.%I for select to authenticated using (user_id = (select auth.uid()) or (select auth.uid()) = any (member_user_ids))',
        t, t
      );
    else
      execute format(
        'create policy %I_select on public.%I for select to authenticated using (user_id = (select auth.uid()))',
        t, t
      );
    end if;

    execute format(
      'create policy %I_insert on public.%I for insert to authenticated with check (user_id = (select auth.uid()))',
      t, t
    );
    execute format(
      'create policy %I_update on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t, t
    );
    execute format(
      'create policy %I_delete on public.%I for delete to authenticated using (user_id = (select auth.uid()))',
      t, t
    );
  end loop;
end $$;

-- challenge templates: readable by all authenticated (system library)
drop policy if exists challenge_templates_select on public.challenge_templates;
create policy challenge_templates_select on public.challenge_templates
  for select to authenticated
  using (true);

drop policy if exists challenge_templates_write on public.challenge_templates;
create policy challenge_templates_write on public.challenge_templates
  for all to authenticated
  using (created_by = (select auth.uid()) or created_by is null)
  with check (created_by = (select auth.uid()) or created_by is null);

-- webhook_events: owner only (Base44 was admin-only; off-platform we scope to user_id)
drop policy if exists webhook_events_select on public.webhook_events;
create policy webhook_events_select on public.webhook_events
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists webhook_events_insert on public.webhook_events;
create policy webhook_events_insert on public.webhook_events
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on table public.challenge_templates to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- anon has no public-read financial data
revoke all on table public.transactions from anon;
revoke all on table public.accounts from anon;
revoke all on table public.financial_profiles from anon;
revoke all on table public.user_profiles from anon;
revoke all on table public.profiles from anon;

-- ---------------------------------------------------------------------------
-- Storage (commented — create the bucket in the Dashboard first)
-- Bucket name used by CSV import: imports
-- ---------------------------------------------------------------------------
-- insert into storage.buckets (id, name, public)
-- values ('imports', 'imports', true)
-- on conflict (id) do nothing;
--
-- create policy "imports_public_read"
--   on storage.objects for select
--   using (bucket_id = 'imports');
--
-- create policy "imports_authenticated_upload"
--   on storage.objects for insert to authenticated
--   with check (bucket_id = 'imports' and owner = auth.uid());
--
-- create policy "imports_authenticated_update_own"
--   on storage.objects for update to authenticated
--   using (bucket_id = 'imports' and owner = auth.uid());
--
-- create policy "imports_authenticated_delete_own"
--   on storage.objects for delete to authenticated
--   using (bucket_id = 'imports' and owner = auth.uid());

-- Household invite needs to resolve another user by email, and invitees must
-- patch households.member_user_ids on accept (Base44 used a service role).
drop policy if exists profiles_select_email_lookup on public.profiles;
create policy profiles_select_email_lookup on public.profiles
  for select to authenticated
  using (true);

drop policy if exists households_update_invitee on public.households;
create policy households_update_invitee on public.households
  for update to authenticated
  using (
    exists (
      select 1 from public.household_memberships m
      where m.household_id = id
        and m.user_id = (select auth.uid())
        and m.status in ('invited', 'active')
    )
  )
  with check (
    exists (
      select 1 from public.household_memberships m
      where m.household_id = id
        and m.user_id = (select auth.uid())
        and m.status in ('invited', 'active')
    )
  );

drop policy if exists households_select_via_membership on public.households;
create policy households_select_via_membership on public.households
  for select to authenticated
  using (
    exists (
      select 1 from public.household_memberships m
      where m.household_id = id
        and m.user_id = (select auth.uid())
        and m.status in ('invited', 'active')
    )
  );
