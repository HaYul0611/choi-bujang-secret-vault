-- 학습용 Supabase 테이블 스키마 (2단계)
create table if not exists public.notes (
  id bigint generated always as identity primary key,
  owner_id uuid null,
  title text not null,
  content text not null,
  created_at timestamptz default now()
);

-- RLS (Row Level Security) 활성화
-- anon 및 authenticated 역할에 별도 읽기 정책을 부여하지 않아 외부 직접 접근을 차단합니다.
alter table public.notes enable row level security;

-- 가상 메모 4건 초기 데이터 삽입
insert into public.notes (title, content) values
  ('과제', '실습용 가상 과제 기록'),
  ('포트폴리오', '실습용 가상 포트폴리오 기록'),
  ('아침 리추얼', '실습용 가상 리추얼 기록'),
  ('훈련 행정 자료', '실습용 가상 행정 기록');
