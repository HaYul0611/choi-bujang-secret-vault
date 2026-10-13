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

-- 8단계: 자료마다 갈 수 있는 구역을 나눕니다
-- 강사 권한 명부. 요청 본문의 role을 믿지 않고 서버가 이 표와 검증된 userId를 대조합니다.
create table if not exists public.instructors (
  user_id uuid primary key,
  created_at timestamptz default now()
);

alter table public.instructors enable row level security;

-- 강사 공지 구역. 메모(notes)와 분리된 별도 자원입니다.
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid null,
  title text not null,
  body text not null,
  created_at timestamptz default now()
);

alter table public.announcements enable row level security;

-- 가상 강사 공지 2건 초기 데이터 적재
insert into public.announcements (title, body) values
  ('공지', '실습용 가상 강사 공지 기록'),
  ('일정 안내', '실습용 가상 일정 공지 기록');

-- notes와 동일하게 PostgREST 직접 접근을 전면 회수합니다.
-- 서버 함수의 서비스 롤 키만 접근하고 소유자·강사 권한을 코드에서 재확인합니다.
revoke all on public.instructors from anon, authenticated, public;
revoke all on public.announcements from anon, authenticated, public;
