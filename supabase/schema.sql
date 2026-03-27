create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  settings jsonb not null default '{"pomodoro_minutes": 25, "break_minutes": 5, "daily_focus_goal_minutes": 240, "review_day": "sunday"}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'paused', 'done', 'abandoned')),
  deadline timestamptz,
  position integer not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  raw_text text not null,
  parsed_date timestamptz,
  parsed_priority text,
  parsed_tags text[] not null default '{}',
  project_id uuid references public.projects(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'clarified', 'deleted')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'normal' check (priority in ('critical', 'important', 'normal', 'low')),
  estimated_duration integer,
  energy text check (energy in ('high', 'medium', 'low')),
  context text,
  project_id uuid references public.projects(id) on delete set null,
  deadline timestamptz,
  scheduled_date date,
  scheduled_time_start time,
  scheduled_time_end time,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'cancelled')),
  position integer not null default 0,
  total_focus_minutes integer not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  position integer not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  content text,
  project_id uuid references public.projects(id) on delete set null,
  tags text[] not null default '{}',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  frequency text not null default 'daily' check (frequency in ('daily', 'weekly_3', 'weekly_5', 'custom')),
  frequency_target integer not null default 7,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  position integer not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  completed_date date not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(habit_id, completed_date)
);

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes integer,
  completed boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  tasks_completed integer not null default 0,
  total_focus_minutes integer not null default 0,
  habits_completion_rate real not null default 0,
  planning_accuracy real not null default 0,
  priorities_next_week jsonb not null default '[]'::jsonb,
  notes text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, week_start)
);

create table if not exists public.sync_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  table_name text not null,
  record_id uuid not null,
  operation text not null check (operation in ('insert', 'update', 'delete')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'failed', 'done')),
  retry_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_user_status_date on public.tasks(user_id, status, scheduled_date);
create index if not exists idx_tasks_user_project on public.tasks(user_id, project_id);
create index if not exists idx_inbox_user_status on public.inbox_items(user_id, status);
create index if not exists idx_focus_user_date on public.focus_sessions(user_id, started_at);
create index if not exists idx_habit_comp on public.habit_completions(habit_id, completed_date);
create index if not exists idx_projects_user_status on public.projects(user_id, status);
create index if not exists idx_sync_queue_status on public.sync_queue(user_id, status);

alter table public.profiles enable row level security;
alter table public.inbox_items enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;
alter table public.notes enable row level security;
alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.reviews enable row level security;
alter table public.sync_queue enable row level security;

drop policy if exists profiles_own on public.profiles;
drop policy if exists inbox_own on public.inbox_items;
drop policy if exists projects_own on public.projects;
drop policy if exists tasks_own on public.tasks;
drop policy if exists subtasks_own on public.subtasks;
drop policy if exists notes_own on public.notes;
drop policy if exists habits_own on public.habits;
drop policy if exists habit_comp_own on public.habit_completions;
drop policy if exists focus_own on public.focus_sessions;
drop policy if exists reviews_own on public.reviews;
drop policy if exists sync_own on public.sync_queue;

create policy profiles_own on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy inbox_own on public.inbox_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy projects_own on public.projects for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy tasks_own on public.tasks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy subtasks_own on public.subtasks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notes_own on public.notes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy habits_own on public.habits for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy habit_comp_own on public.habit_completions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy focus_own on public.focus_sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reviews_own on public.reviews for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sync_own on public.sync_queue for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists profiles_set_updated_at on public.profiles;
drop trigger if exists inbox_items_set_updated_at on public.inbox_items;
drop trigger if exists projects_set_updated_at on public.projects;
drop trigger if exists tasks_set_updated_at on public.tasks;
drop trigger if exists subtasks_set_updated_at on public.subtasks;
drop trigger if exists notes_set_updated_at on public.notes;
drop trigger if exists habits_set_updated_at on public.habits;
drop trigger if exists habit_completions_set_updated_at on public.habit_completions;
drop trigger if exists focus_sessions_set_updated_at on public.focus_sessions;
drop trigger if exists reviews_set_updated_at on public.reviews;
drop trigger if exists sync_queue_set_updated_at on public.sync_queue;

create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger inbox_items_set_updated_at before update on public.inbox_items for each row execute procedure public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects for each row execute procedure public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks for each row execute procedure public.set_updated_at();
create trigger subtasks_set_updated_at before update on public.subtasks for each row execute procedure public.set_updated_at();
create trigger notes_set_updated_at before update on public.notes for each row execute procedure public.set_updated_at();
create trigger habits_set_updated_at before update on public.habits for each row execute procedure public.set_updated_at();
create trigger habit_completions_set_updated_at before update on public.habit_completions for each row execute procedure public.set_updated_at();
create trigger focus_sessions_set_updated_at before update on public.focus_sessions for each row execute procedure public.set_updated_at();
create trigger reviews_set_updated_at before update on public.reviews for each row execute procedure public.set_updated_at();
create trigger sync_queue_set_updated_at before update on public.sync_queue for each row execute procedure public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

do $$
begin
  begin
    alter publication supabase_realtime add table public.profiles, public.inbox_items, public.projects, public.tasks, public.subtasks, public.notes, public.habits, public.habit_completions, public.focus_sessions, public.reviews;
  exception
    when duplicate_object then
      null;
  end;
end;
$$;
