-- 학습용 Supabase 테이블 스키마 (3단계)
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid null,
  title text not null,
  body text not null,
  created_at timestamptz default now()
);

-- RLS 활성화
alter table public.notes enable row level security;

-- 가상 메모 4건 초기 데이터 적재
insert into public.notes (title, body) values
  ('과제', '실습용 가상 과제 기록'),
  ('포트폴리오', '실습용 가상 포트폴리오 기록'),
  ('아침 리추얼', '실습용 가상 리추얼 기록'),
  ('훈련 행정 자료', '실습용 가상 행정 기록');
