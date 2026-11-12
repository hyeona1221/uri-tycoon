-- 우리집 자산관리(주) 데이터베이스 설정
-- Supabase > SQL Editor > New query 에 전체를 붙여넣고 Run 을 누르세요.
-- 맨 아래 "허용할 이메일" 두 줄만 두 분 이메일로 바꿔주세요.

-- 1) 허용된 사용자 목록 -------------------------------------------------
create table if not exists public.members (
  email text primary key
);

-- 2) 변동비 (품의서) ------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  cat text not null,               -- food, dine, baby, choa, home, car, med, self, gift, etc
  place text not null default '',
  amount integer not null check (amount > 0),
  method text not null default '카드',  -- 카드 / 지역화폐 / 현금
  memo text not null default '',
  created_by text default (auth.jwt() ->> 'email'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists expenses_date_idx on public.expenses (date);

-- 3) 고정비 항목 (받은 돈에서 내야 할 것) ----------------------------------
create table if not exists public.fixed_items (
  id text primary key,
  name text not null,
  due text not null default '',
  amount integer not null,
  sort integer not null default 0,
  active boolean not null default true
);

-- 4) 월별 기록: 받은 돈, 고정비 결재 도장 ---------------------------------
create table if not exists public.months (
  ym text primary key,             -- 예: 2026-12
  received integer not null default 0,
  paid jsonb not null default '{}'::jsonb,   -- {"lgu": true, "claude": true, ...}
  updated_at timestamptz not null default now()
);

-- 5) 무지출 데이 ----------------------------------------------------------
create table if not exists public.no_spend (
  date date primary key,
  created_at timestamptz not null default now()
);

-- 6) 보안: 목록에 있는 이메일로 로그인한 사람만 읽고 쓰기 ------------------
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m where m.email = (auth.jwt() ->> 'email'));
$$;

alter table public.members     enable row level security;
alter table public.expenses    enable row level security;
alter table public.fixed_items enable row level security;
alter table public.months      enable row level security;
alter table public.no_spend    enable row level security;

drop policy if exists "members read self" on public.members;
create policy "members read self" on public.members for select to authenticated using (public.is_member());

do $$
declare t text;
begin
  foreach t in array array['expenses','fixed_items','months','no_spend'] loop
    execute format('drop policy if exists "member all" on public.%I', t);
    execute format('create policy "member all" on public.%I for all to authenticated using (public.is_member()) with check (public.is_member())', t);
  end loop;
end $$;

-- 7) 실시간 동기화 켜기 (폰과 PC 동시 반영) ---------------------------------
do $$
declare t text;
begin
  foreach t in array array['expenses','fixed_items','months','no_spend'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- 8) 고정비 8개 기본값 -----------------------------------------------------
insert into public.fixed_items (id, name, due, amount, sort) values
  ('lgu',     'LG U+',         '8~10일',  10180, 1),
  ('claude',  'Claude',        '9일',     29940, 2),
  ('house',   '주택청약',       '15일',    20000, 3),
  ('samsung', '삼성생명',       '15일',    19140, 4),
  ('mobing',  'MOBING 알뜰폰',  '26~28일',  2900, 5),
  ('elec',    '전기료',         '월말',     3000, 6),
  ('hana',    '하나은행 적금',   '',       300000, 7),
  ('phone',   '휴대폰 보험',     '',        10400, 8)
on conflict (id) do nothing;

-- 9) 허용할 이메일: 아래 두 줄을 두 분이 로그인할 이메일로 바꾸세요 ----------
insert into public.members (email) values
  ('wife@example.com'),
  ('husband@example.com')
on conflict do nothing;
