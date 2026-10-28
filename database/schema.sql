-- AI Mock Interview Practice System
-- Run this once in Supabase SQL Editor. The Express server uses the service role key
-- only on the server after validating the user's JWT and ownership of every record.

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  password_hash text not null,
  display_name text not null check (char_length(display_name) between 2 and 60),
  created_at timestamptz not null default now()
);

create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  role_title text not null check (char_length(role_title) between 2 and 80),
  experience_level text not null check (experience_level in ('beginner', 'intermediate', 'advanced')),
  focus_area text not null check (focus_area in ('behavioral', 'technical', 'mixed')),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.interview_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  question_number smallint not null check (question_number between 1 and 12),
  question_text text not null,
  answer_text text not null default '' check (char_length(answer_text) <= 5000),
  self_rating smallint check (self_rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, question_number)
);

create index if not exists interview_sessions_user_started_idx
  on public.interview_sessions(user_id, started_at desc);
create index if not exists interview_answers_session_idx
  on public.interview_answers(session_id, question_number);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists interview_answers_updated_at on public.interview_answers;
create trigger interview_answers_updated_at before update on public.interview_answers
for each row execute function public.set_updated_at();

alter table public.app_users enable row level security;
alter table public.interview_sessions enable row level security;
alter table public.interview_answers enable row level security;
-- No anon/authenticated policies are created. Browser clients cannot query these tables;
-- all access goes through the authenticated Express API. The service key bypasses RLS
-- and must remain private on the server.
