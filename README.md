# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 포함된 메모 네 건은 가상 자료입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 학생이 하는 일: 세 걸음

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 **Deploy** 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 **본인 계정의 Public 저장소**인지 확인한 뒤 Deploy를 누릅니다.
3. 배포가 끝나면 화면에 나온 `https://…vercel.app` 주소를 방어전 1단계 카드에 붙여넣고 제출합니다. 저장소 주소나 설정 파일은 적지 않습니다.

배포가 끝나면 `/`에서 점령된 가상 자료실을 볼 수 있습니다. `/data.json`에는 같은 가상 메모가 공개됩니다. 이 공개 상태를 확인하는 것이 1단계의 출발점입니다. 1단계 접수와 심판 판정은 포털에서 확인합니다.

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`을 배포합니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 이전 제출 묶음 방식의 자리표시자입니다. 1단계에서는 학생이 편집하지 않습니다. 2단계 이후 코딩 도구가 필요한 설정과 보호 기능을 단계별로 작성합니다. `npm run bundle`과 `bundle-notes.json`도 1단계의 세 걸음에는 포함되지 않습니다.

로컬에서 가상 화면만 확인할 때는 `npm run build -- --local`을 사용합니다. 로컬 실행은 Vercel 배포나 심판 접수를 증명하지 않습니다. 저장소의 `src/attack-check.mjs`는 실제 배포가 된 뒤 `/data.json`을 비로그인으로 요청해 공개 가상 메모의 확인 표시를 읽습니다.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 2단계부터는 자료 보호를 구현할 때 `public/data.json`을 복사하는 1단계 빌드 흐름도 함께 바꿔야 합니다. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.


## 2단계: 자료를 코드 밖으로 옮깁니다

### 1. 현재 작동하는 기능과 다시 실행하는 방법
- 가상 메모 4건을 정적 파일(data.json)에서 제거하고 학습용 Supabase DB(notes 테이블)로 이전했습니다.
- 프론트엔드(public/index.html)는 Vercel 서버리스 함수(/api/notes)를 호출하여 메모를 불러옵니다.
- 서버 함수는 SUPABASE_URL과 SUPABASE_SECRET_KEY를 서버 환경변수에서 읽어 DB를 조회하며 브라우저나 응답에 키를 노출하지 않습니다.
- 로컬 빌드: npm run build -- --local

### 2. 가상 메모 문장 검색 확인 절차
- GitHub 최신 파일 검색: 저장소 최신 파일(data.json, public/data.json)에서 기존 가상 메모 문장("실습용 가상 과제 기록" 등)을 검색하면 검출되지 않습니다.
- 배포 파일(/data.json) 검색: 배포 URL의 /data.json 요청 시 정적 메모가 생성되지 않거나 0건입니다.

### 3. 과거 노출의 한계 및 공개 API의 남은 약점
- 과거 노출 미해소의 한계: 최신 Git 커밋과 최신 배포에서 가상 메모를 제거했으나, 과거의 공개 Git 커밋과 이전 Vercel 배포 URL이 남아 있는 한 과거 노출은 해소되지 않았습니다.
- 공개 API의 남은 약점: 서버 함수(/api/notes)는 현재 누구나 호출할 수 있는 공개 주소(Public Endpoint)입니다. 인증/인가가 없어 누구나 직접 요청하여 메모를 읽을 수 있는 약점이 여전히 존재합니다.

## 3단계: 진짜 로그인을 붙입니다

### 1. 현재 작동하는 기능과 다시 실행하는 방법
- Supabase Auth를 연동하여 이메일/비밀번호 로그인 및 로그아웃 기능을 구현했습니다.
- 서버 API(`/api/notes`, `/api/notes/:id`)는 `src/verify-login.mjs`를 통해 클라이언트의 Bearer JWT 토큰을 검증합니다.
- 토큰이 없거나 유효하지 않은 요청은 `401 Unauthorized` JSON 응답으로 차단됩니다.
- 로그인한 사용자는 메모를 목록 조회, 단건 조회, 추가, 수정, 삭제(CRUD)할 수 있습니다.
- 로컬 빌드: `npm run build -- --local`

### 2. 남은 허점 (4단계 해결 완료)
- 3단계에서는 사용자의 신원(로그인 여부)만 확인할 뿐, 개별 메모의 소유자(owner_id) 일치 여부를 검사하지 않아 타인 메모 접근 위험이 있었습니다.

## 4단계: 로그인해도 내 자료만 보이게 합니다

### 1. 현재 작동하는 기능과 다시 실행하는 방법
- 메모 CRUD API(`/api/notes`, `/api/notes/:id`)에서 JWT 토큰의 사용자 ID와 DB의 `owner_id`를 검증하여 엄격한 메모 격리를 구현했습니다.
- 타인 소유의 메모에 대한 단건 조회, 수정, 삭제 요청 및 소유자 변경 시도는 `403 Forbidden` JSON 오류로 차단됩니다.
- Supabase DB 레벨에서 RLS(Row Level Security)를 활성화하고, `anon` 역할의 권한을 전면 회수(`REVOKE ALL`)한 뒤 `authenticated` 역할에 대해 `auth.uid() = owner_id` 조건의 최소 CRUD 권한만 부여했습니다.
- 로컬 빌드: `npm run build -- --local`

## 5단계: 자료 요청을 서버 한 곳으로 모읍니다

### 1. 현재 작동하는 기능과 다시 실행하는 방법
- 클라이언트의 메모 CRUD 요청 통로를 Vercel 서버 함수(`/api/notes`, `/api/notes/:id`)로 일원화하고 프론트엔드 모듈화(`style.css`, `app.js`) 및 인메모리 SWR 캐싱을 적용했습니다.
- Supabase DB `notes` 테이블에서 `PUBLIC`, `anon`, `authenticated`의 직접 접근 권한을 전면 회수(`REVOKE ALL`)하여 Data API(PostgREST) 직접 조회를 원천 차단했습니다.
- 서버 함수는 관리자 전용 서비스 롤 키(`SUPABASE_SECRET_KEY`)와 로그인/소유자 검증을 통해 본인 메모의 안전한 CRUD를 보존합니다.
- 로컬 빌드: `npm run build -- --local`

## 6단계: 등록한 기기만 자료실에 들어옵니다

### 1. 현재 작동하는 기능과 다시 실행하는 방법
- 보호 서비스 ID(`notes`)와 읽기 경로(`GET /api/notes`)를 `aleph.config.json`에 연결했습니다.
- 학생 판정기(`src/decider.mjs`)에 등록 기기 검증 규칙(`device_registered`)을 구현하여 엔진이 확인한 등록 기기(`deviceRegistered: true`)와 사용자 바인딩 요청만 허용하고, 미등록 기기(`device_not_registered`) 및 확인 실패 요청은 거부하도록 구성했습니다.
- 등록된 기기에서 기존 배포 주소로 접속 시 기존 시험 계정의 정상 읽기가 안전하게 유지됩니다.
- 판정기 시험: `node scripts/decider-test.mjs`
- 로컬 빌드: `npm run build -- --local`

## 7단계: 평소와 다른 접속은 다시 확인합니다

### 1. 현재 작동하는 기능과 다시 실행하는 방법
- 판정기 입력에서 엔진이 검증해 넘긴 공인 가상 접속 신호(`source === 'judge_fixture'`)만 선별하여 위조 클라이언트 헤더가 정상 정보로 승격되는 것을 차단했습니다.
- 평소와 다른 시각(`hour < 6 || hour >= 23`), 처음 보는 네트워크(`network === 'unusual'`), 대량 자료 읽기 사건(`count >= 10`)이 겹칠 때 지역 하나만으로 영구 차단하지 않고 추가 확인(`step_up`, 이유 코드: `step_up_required`)을 요구하는 규칙을 판정기에 구현했습니다.
- 재인증이 완료된 요청(`stepUp.verified === true`)은 정상 허용(`allow`)으로 재판정되며, 기존 미등록 기기 차단 규칙(`device_registered`)은 최우선 순위로 보존됩니다.
- 가상 사건 시험: `node scripts/fixture-7.mjs` 및 `node scripts/decider-test.mjs`
- 로컬 빌드: `npm run build -- --local`

## 8단계: 자료마다 갈 수 있는 구역을 나눕니다

### 1. 현재 작동하는 기능과 다시 실행하는 방법
- 메모(`notes`)와 강사 공지(`announcements`)를 서로 다른 자원 ID·경로로 분리하고 `aleph.config.json`의 `resources`와 `allowedRoutes`에 각 구역의 소유 기준·쓰기 권한을 선언했습니다.
- 판정기(`src/decider.mjs`)에 구역 판별 규칙(`zone_resource_scope`)을 추가하여 엔진이 정규화한 `route`가 고정 허용 목록(`/notes`, `/notes/:id`, `/announcements`, `/announcements/:id`)에 맞고 선언 서비스와 경로 구역이 일치할 때만 허용합니다. 알 수 없는 자원, 구역 혼선, `:id` 깊이에 숨긴 기능 경로(예: `/notes/:id/export`)는 거부합니다.
- 공지 자료 API(`api/announcements/index.js`, `api/announcements/[id].js`)는 요청 본문의 `role`이나 `author_id`를 믿지 않고, 검증된 `userId`를 DB 강사 명부(`instructors`)와 대조하여 강사만 공지 쓰기를 허용하고 작성자 본인만 수정·삭제하도록 재확인합니다. 일반 학생의 공지 수정·삭제는 `403 Forbidden`으로 차단됩니다.
- 기존 6단계 미등록 기기 차단과 7단계 복합 이상 접속 추가 확인 규칙은 최우선 순위로 보존됩니다.
- DB 스키마: `schema.sql`에 `announcements`·`instructors` 테이블을 추가하고 두 표 모두 RLS 활성화와 `anon`·`authenticated`·`public` 권한 전면 회수(`REVOKE ALL`)를 적용했습니다. Data API(PostgREST) 직접 접근을 원천 차단하고 서버 함수의 서비스 롤 키만 접근합니다.
- 판정기 시험: `node scripts/decider-test.mjs` 및 `node scripts/fixture-7.mjs`
- 자기 점검: `npm run bundle` (배포 환경에서 라이브 fetch 점검 수행)
- 로컬 빌드: `npm run build -- --local`

### 2. 배포 환경에서 추가로 적용할 것
- Supabase에 `schema.sql`의 8단계 추가분(`announcements`·`instructors`)을 적용해야 공지 API가 정상 응답합니다.
- 강사 공지 쓰기를 쓰려면 강사 계정의 `userId`를 `instructors` 테이블에 등록해야 합니다. 등록 전에는 모든 공지 쓰기가 403으로 차단됩니다.

## 9단계: 도플갱어를 찾고 권한을 거둡니다

### 1. 현재 작동하는 기능과 다시 실행하는 방법
- 가상 사건 스트림(`src/detect.mjs`)에서 가명 사용자(`sub`), 기기(`deviceId`), 요청 종류(`method`), 판정(`decision`)만 선별하여 안전하게 읽고 본문·토큰·실명 등 민감 정보를 배제했습니다.
- 동일 가명 주체의 `GET` 조회가 10분 구간 내에서 120건을 초과하는 폭주 조회(`burst_read`)를 슬라이딩 윈도우 알고리즘으로 탐지하여 확인된 단일 가상 기기 권한 회수 제안(`propose_revocation`, reasonCode: `burst_read`)을 반환합니다.
- 단순 지역 이상(`region: 'foreign'`) 등 단일 지표나 10분 내 120건 이하의 정상 사건은 회수 제안 없이 관찰(`observe`) 상태를 유지합니다.
- 기존 접속 허용/거부 판정기(`src/decider.mjs`)와 6~8단계 보호 규칙은 그대로 보존됩니다.
- 탐지 시험: `node scripts/detect-test.mjs`
- 자기 점검: `npm run bundle`
- 로컬 빌드: `npm run build -- --local`

## 10단계: 백업에서 자료실을 되살립니다

### 1. 백업 검증 순서 (사전 백업을 다시 읽어 검증)
- **사본 다시 읽기 및 무결성 검증**: 침해 전에 검증한 안전 정책 사본(v9)을 다시 읽어 SHA-256 체크섬과 필수 항목(version, resources, allowedRoutes, ruleIds)을 엄격히 검증합니다.
- **실행 전 버전과 변경 범위 표시**: 복원 실행 전에 복원할 대상 버전(v9)과 변경 범위(diff: 비인가 경로 제거, 누락 필수 경로/규칙 복원, 자원 권한 정상화)를 사용자에게 먼저 보여 줍니다 (Dry-run 미리보기).
- **검증 실패 시 복원 중단 (불변 분기)**: 사본이 없거나 무결성 검증에 실패하면 복원을 즉시 멈추고(`S10_BACKUP_UNVERIFIED`), 정책이나 데이터를 일절 변경하지 않습니다. 그 실패를 성공으로 적거나 처리하지 않습니다.
- **실제 운영 정책 보존**: 실제 운영 정책 파일이나 배포 환경은 건드리지 않으며, 시험 정책 범위 내에서만 안전하게 비교 및 복원을 수행합니다.
- **다시 실행하는 명령**: `node src/restore.mjs`

### 2. 비공개 가상 메모 사본에서 지정한 한 건 복원 (복구 한 건이 사본과 같다)
- **서비스 및 복원 경로**:
  - 서비스: `notes`
  - 복원 경로: `POST /api/notes/restore` (`aleph.config.json`의 `restoreRoute`)
- **지정한 한 건만 복원**: 비공개 가상 메모 사본에서 지정한 대상 1건만 복구합니다.
- **ID·소유자·내용 해시 대조**: 복구 대상 한 건의 ID, 소유자(`owner_id`), 내용 해시(`contentHash`)가 사전 검증된 사본과 같을 때만 그 한 건을 복원합니다. 사본과 값이 다르거나 위변조된 경우 복원을 중단합니다.
- **다른 메모 및 감사 기록 보존**: 다른 메모와 기존 감사 이력(audit logs)은 온전히 보존하며, 다른 서비스 규칙을 바꾸지 않습니다.
- **시험 범위**: 시험 계정 B의 메모 범위로만 확인하며, 실제 개인정보나 비밀값은 결과에 남기지 않습니다.

### 3. 복구 뒤 1~9단계 정상·금지 요청 다시 실행 순서 (정상 사용과 금지 요청 재시험)
복구 뒤 자료와 정책이 정상으로 돌아오고 이전에 막던 대표 공격이 다시 거부되는지 아래 순서대로 재시험합니다.

1. **복원 절차 및 단건 복구 시험**: `node src/restore.mjs`
   - **정상 요청**: 안전 사본(v9) 무결성 통과 후 정책 복원 완료, 시험 계정 B의 메모가 ID·소유자·내용 해시 일치로 복원됨, A의 본인 메모 요청 허용(`allow`).
   - **금지 요청**: 타인(A)의 B 메모 복원 시도 거부(`FORBIDDEN_OWNER_MISMATCH`), 내용 해시 위변조 복원 시도 거부(`S10_BACKUP_UNVERIFIED`), B의 타인(A) 메모 요청 거부(`deny / unauthorized_operation`).
   - **보존 항목**: 타 서비스(`ai_service`, `ai_assistant_guard`) 설정 및 기존 감사 기록 보존.
2. **ZTNA 판정기 재검증 (6~8단계)**: `node scripts/decider-test.mjs`
   - **정상 요청**: 등록 기기의 정상 요청 허용(`allow`), 재인증(step-up)을 마친 요청 허용(`allow`).
   - **금지 요청**: 미등록 기기 가상 요청 거부(`deny / device_not_registered`), 복합 이상 접속 추가 확인 요구(`step_up / step_up_required`).
3. **복합 이상 접속 신호 재검증 (7단계)**: `node scripts/fixture-7.mjs`
   - **정상 사건**: 평소 시간·네트워크 요청 허용(`allow`).
   - **금지/이상 사건**: 평소와 다른 시간·네트워크 및 대량 조회가 겹친 요청 추가 확인 요구(`step_up`).
4. **폭주 조회 행위 탐지기 재검증 (9단계)**: `node scripts/detect-test.mjs`
   - **정상 요청**: 30건, 10분 내 120건 이하 정상 조회는 관찰(`observe`) 유지.
   - **금지/이상 행위**: 10분 내 120건을 초과하는 폭주 조회(`121건`, `200건`)는 권한 회수 제안(`propose_revocation / burst_read`).
5. **라이브 배포 요청 점검 (1~5단계 자기 점검)**: `npm run bundle`
   - **정상/금지 요청 실측**: 배포 환경에서 비로그인 `/data.json` 정적 노출 차단, 비로그인 `/api/notes` 및 `/api/announcements` 직접 요청 차단(401/403), 원본 DB API 직접 접근 차단 확인.
   - **미실행 보존**: 실제 운영 로그인 토큰이 필요한 라이브 강사 공지 쓰기 차단 점검 등 배포 환경에서 실행 불가능한 항목은 허용이나 거부로 채우지 않고 '미실행(보존)'으로 둡니다. 결과를 꾸미지 않습니다.

## 11단계: 나만의 접속 앱을 완성합니다

### 1. 현재 작동하는 기능과 다시 실행하는 방법
- **설치형 웹앱 설정 (`manifest.json`)**:
  - PWA 표준 standalone 매니페스트(`public/manifest.json`)를 연동하여 앱 이름(`BYTE BACK · 보안 금고`), 짧은 이름(`보안 금고`), 테마 색상 및 오프라인 상태 보안 안내를 제공합니다.
  - 배포 주소 및 로컬 환경에서 별도의 외부 접속 프로그램 설치 없이 웹앱 형태로 동작합니다.
- **기기 승인 상태 표시 및 서버 확인 흐름**:
  - 화면 상단 상태 바와 기기 승인 관리 카드(`device-approval-card`)를 통해 기기 접속 환경과 서버 승인 상태를 안내합니다.
  - `POST /api/auth`의 `check_device` 액션은 승인 전 미승인(`approved: false`) 상태를 유지하며, `request_device_approval` 액션을 통해 서버 판정기가 등록 기기로 확인한 응답(`approved: true`)을 수신해야만 승인 처리됩니다.
  - 설치 표시나 단순 화면 버튼 클릭만으로 기기 확인이 끝났다고 처리하지 않습니다 (`S11_BADGE_IS_TRUST` 방지).
- **승인 전 자료 비노출 및 승인 후 화면 오픈**:
  - 기기 승인 전에는 메모 목록 및 본문이 일절 렌더링되지 않으며 보호 자료가 화면에 표시되지 않습니다 (`S11_DATA_BEFORE_APPROVAL` 방지).
  - 서버 검증 완료 및 로그인 확인 시 기존 자료실 대시보드(메모 목록 및 CRUD)가 정상적으로 열립니다 (`S11_APPROVED_SCREEN_CLOSED` 방지).
- **기기 및 세션 격리 원칙**:
  - 브라우저 저장소, 화면, 코드, Git 제출 묶음에 기기 개인키, 서명키, 비밀키 및 토큰 값을 일절 보관하지 않고 메모리 내에서만 격리 유지합니다 (`S11_KEY_EXPOSED` 방지).
- **오프라인 보호 안내**:
  - 네트워크 연결이 끊기면 상단에 오프라인 경고 배너를 노출하고 안전을 위해 보호 자료 표시를 차단합니다.
- **다시 실행하는 방법**:
  - 로컬 빌드: `node scripts/build-public.mjs --local`
  - 판정기 시험: `node scripts/decider-test.mjs`
  - 복원 시험: `node src/restore.mjs`

## 12단계: 탈환 작전실을 완성합니다

### 1. 1~11단계 정상·금지 요청 실측 대조표

1~11단계의 대표 정상 허용 및 금지 거부 요청을 점검한 결과입니다. 심판 접수 서버에 실제 공격 요청 기록이 존재하지 않는 항목 및 쓰기·내부 로직 점검은 심판 규칙(요청을 보내지 않은 점검은 observed를 not_run으로 적음)에 따라 임의로 통과나 막음으로 꾸미지 않고 not_run(미실행)으로 분리 기록했습니다. 가상 메모 본문은 일절 포함하지 않습니다.

| 단계 | 구분 | 요청 ID | 검증 대상 요청 | 기대 결과 | 실제 API 실측 결과 | 확인 시각 |
|---|---|---|---|---|---|---|
| 1단계 | 금지 거부 | `anonymous_static_leak` | `GET /data.json` (비인가) | 정적 가상 메모 노출 차단 (404 또는 미생성) | not_run (심판 요청 기록 미생성 / API 실측 미실행) | 2026-10-14T12:46:29Z |
| 2~3단계 | 금지 거부 | `anonymous_api_read_blocked` | `GET /api/notes` (비로그인) | 401/403 JSON 오류 반환 | not_run (심판 요청 기록 미생성 / API 실측 미실행) | 2026-10-14T12:46:30Z |
| 3단계 | 정상 허용 | `api_auth_read_allowed` | `GET /api/notes` (인가 토큰) | 200 OK 및 본인 메모 목록 반환 | not_run (인가 세션 점검 / API 실측 미실행) | 2026-10-14T12:46:30Z |
| 4단계 | 내부 판정 | `other_user_note_read_blocked` | `GET /api/notes/:id` (타인 메모) | 403 Forbidden 또는 deny 반환 | not_run (내부 판정기 규칙 / API 실측 미실행) | 2026-10-14T12:46:30Z |
| 5단계 | 금지 거부 | `direct_origin_api_blocked` | `GET {originalApiUrl}` (익명 우회) | 원본 저장소 직접 요청 차단 (401/403/404) | not_run (심판 요청 기록 미생성 / API 실측 미실행) | 2026-10-14T12:46:31Z |
| 6단계 | 내부 판정 | `unregistered_device_decider_blocked` | `decide({ deviceRegistered: false })` | deny 및 device_not_registered 반환 | not_run (내부 판정기 규칙 / API 실측 미실행) | 2026-10-14T12:46:31Z |
| 6단계 | 정상 허용 | `registered_device_decider_allowed` | `decide({ deviceRegistered: true })` | allow 및 approved 반환 | not_run (내부 판정기 규칙 / API 실측 미실행) | 2026-10-14T12:46:31Z |
| 7단계 | 내부 판정 | `suspicious_access_step_up_required` | `decide({ hour: 3, network: 'unusual' })` | step_up 및 step_up_required 반환 | not_run (내부 판정기 규칙 / API 실측 미실행) | 2026-10-14T12:46:31Z |
| 7단계 | 정상 허용 | `step_up_verified_allowed` | `decide({ stepUp: { verified: true } })` | allow 및 approved 반환 | not_run (내부 판정기 규칙 / API 실측 미실행) | 2026-10-14T12:46:31Z |
| 8단계 | 내부 판정 | `cross_zone_path_blocked` | `decide({ service: 'notes', path: '/announcements/x' })` | deny 및 unauthorized_operation 반환 | not_run (내부 판정기 규칙 / API 실측 미실행) | 2026-10-14T12:46:31Z |
| 8단계 | 내부 판정 | `hidden_function_route_blocked` | `decide({ path: '/notes/x/export' })` | deny 및 unauthorized_operation 반환 | not_run (내부 판정기 규칙 / API 실측 미실행) | 2026-10-14T12:46:31Z |
| 8단계 | 내부 판정 | `announcement_zone_isolated_allow` | `decide({ service: 'announcements', path: '/announcements' })` | allow 및 approved 반환 | not_run (내부 판정기 규칙 / API 실측 미실행) | 2026-10-14T12:46:31Z |
| 8단계 | 내부 판정 | `student_announcement_write_blocked` | `decide({ service: 'announcements', method: 'PUT', subjectId: 'learner_a' })` | deny 및 unauthorized_operation 반환 | not_run (내부 판정기 규칙 / API 실측 미실행) | 2026-10-14T12:46:31Z |
| 8단계(운영) | 미실행 | `live_instructor_write_guard` | `PUT /api/announcements/:id` (운영 토큰 미발급) | 라이브 403 차단 | not_run (운영 로그인 토큰 미발급 환경으로 미실행 보존) | 2026-10-14T12:46:31Z |
| 9단계 | 내부 탐지 | `burst_read_detection_revocation` | `detect(burstEvents)` (10분 121건) | propose_revocation 및 burst_read 반환 | not_run (내부 탐지 규칙 / API 실측 미실행) | 2026-10-14T12:46:31Z |
| 9단계 | 정상 허용 | `normal_read_detection_observe` | `detect(normalEvents)` (10분 30건) | observe 반환 | not_run (내부 탐지 규칙 / API 실측 미실행) | 2026-10-14T12:46:31Z |
| 10단계 | 내부 복원 | `policy_restore_preview_verified` | `previewPolicyRestore(safeBackup, compromised)` | readyToRestore: true, restoreVersion: 9 | not_run (내부 복원 로직 / API 실측 미실행) | 2026-10-14T12:46:31Z |
| 10단계 | 내부 복원 | `single_note_restore_verified` | `restoreSingleNote({ id: 'note_b_vault_01' })` | ID·소유자·해시 일치 단건 복원 | not_run (내부 복원 로직 / API 실측 미실행) | 2026-10-14T12:46:31Z |
| 11단계 | 정상 허용 | `manifest_pwa_read_accessible` | `GET /manifest.json` | 200 OK 및 standalone 제공 | not_run (심판 요청 기록 미생성 / API 실측 미실행) | 2026-10-14T12:46:32Z |
| 11단계 | 클라이언트 | `unapproved_device_data_closed` | 기기 승인 전 자료 비노출 / 승인 후 오픈 | 승인 전 비노출, 승인 후 오픈 | not_run (클라이언트 규칙 / API 실측 미실행) | 2026-10-14T12:46:32Z |
| 종합 | 미실행 | `full_assault_41_types` | 41종 총공세 종합 시험 | 미실행 분리 유지 | not_run (0 / 41 막음, 상용 제품 완성 또는 전량 방어로 표시하지 않음) | 2026-10-14T12:46:32Z |

### 2. 실측 대조표 생성 및 실행 절차

위 실측 표는 아래 절차에 따라 실제 API와 판정기를 직접 호출하여 검증하고 수치를 대조합니다.

1. **배포 주소 및 네트워크 실측**:
   - `node scripts/bundle.mjs`를 실행하여 배포된 `/data.json`, `/api/notes`, `/api/announcements`, `/manifest.json` 및 Supabase 원본 API에 실제 요청을 보내 HTTP 상태 코드를 실측합니다.
2. **판정기 및 복합 신호 로컬 실측**:
   - `node scripts/decider-test.mjs` 및 `node scripts/fixture-7.mjs`를 실행하여 미등록 기기 차단(`device_not_registered`), 복합 이상 접속 추가 확인(`step_up_required`), 구역 혼선 및 기능 경로 위장 차단(`unauthorized_operation`), 등록 기기 및 공지 구역 정상 허용을 실측합니다.
3. **행위 탐지기 실측**:
   - `node scripts/detect-test.mjs`를 실행하여 10분 구간 내 120건 초과 폭주 조회에 대한 회수 제안(`propose_revocation / burst_read`)과 120건 이하 정상 조회의 관찰(`observe`) 유지를 실측합니다.
4. **정책 무결성 및 단건 복구 실측**:
   - `node src/restore.mjs`를 실행하여 침해 전 v9 안전 정책 사본의 SHA-256 체크섬 대조 및 diff 계산과 시험 계정 B의 메모 단건 복구(본문 미노출)를 실측합니다.
5. **수치 및 미실행 일치 확인**:
   - 생성된 `artifacts/submission.json`의 `attackAttempts` 배열과 탈환 작전실 화면(`public/index.html`)의 수치가 '확인 0건 / 미실행 17건 (41종 총공세: 막음 0 / 41 미실행)'으로 서로 일치하는지 확인합니다.

### 3. 출처 구분 (제공 엔진과 학생 작업의 분리)

검사한 커밋(`4cafae2` / `HEAD`)을 기준으로 제공 엔진과 학생 작업의 출처를 엄격히 분리하고 각 구성요소의 재현 순서를 안내합니다.

#### 1) 출처 구분
- **제공 엔진 출처**: **ALEPH SDP 엔진**
  - 엔진은 공인된 접속 신호(`source: 'judge_fixture'`)를 검증하여 판정기에 인계하고, 자원 경로 템플릿 정규화 및 가상 사건 스트림 전달을 담당합니다.
  - 제공 엔진은 심판 측이 제공하는 기반 구조이며 학생 작업과 합쳐져 있지 않습니다.
- **학생 작업 출처** (학생 몫):
  - **학생 판정기** (`src/decider.mjs`): 등록 기기 검증, 복합 이상 접속 추가 확인(step_up), 구역 격리(notes vs announcements) 판정 로직 구현.
  - **학생 탐지 규칙** (`src/detect.mjs`): 사건 스트림에서 슬라이딩 윈도우 기반 10분 내 120건 초과 폭주 조회 탐지 및 기기 권한 회수 제안 로직 구현.
  - **학생 접속 앱** (`public/app.js`, `public/manifest.json`): PWA standalone 설정, 서버 승인 기반 화면 오픈 제어, 브라우저 저장소 내 키 미보관 구현.
  - **학생 자료실** (`public/index.html`, `api/notes.js`, `api/announcements/`, `src/restore.mjs`): 격리된 자료실 화면, 탈환 작전실 관제 화면, 단건 복원 및 정책 검증 구현.

#### 2) 학생 4대 구성요소의 설치·실행·중지·복구 재현 순서

| 구성요소 | 설치 (Install) | 실행 (Run) | 중지 (Stop) | 복구 (Restore) |
|---|---|---|---|---|
| **학생 판정기**<br>(`src/decider.mjs`) | Node.js 22+ 환경에서 저장소 클론 후 계약 명세(`docs/DECIDER_REQUEST.md`) 확인 | `node scripts/decider-test.mjs` 실행 (단위 시험) | 테스트 완료 즉시 자동 종료 또는 `Ctrl+C` | `git checkout HEAD -- src/decider.mjs` (검증 커밋 원복) |
| **학생 탐지 규칙**<br>(`src/detect.mjs`) | 사건 형식 명세(`docs/DETECT_EVENTS.md`) 확인 | `node scripts/detect-test.mjs` 실행 (폭주 탐지 시험) | 테스트 완료 즉시 자동 종료 또는 `Ctrl+C` | `git checkout HEAD -- src/detect.mjs` (검증 커밋 원복) |
| **학생 접속 앱**<br>(`public/app.js`, `manifest.json`) | `node scripts/build-public.mjs --local` 정적 자산 준비 | 브라우저로 배포 주소(`/`) 접속 및 설치형 PWA 실행 | 브라우저 탭 또는 앱 창 닫기 | `git checkout HEAD -- public/app.js public/manifest.json` |
| **학생 자료실**<br>(`public/index.html`, `api/`, `src/restore.mjs`) | `npm install` 의존성 설치 및 DB 스키마(`schema.sql`) 적용 | 배포 주소 접속 또는 `node scripts/bundle.mjs` 종합 검증 | 서버리스 대기 상태 유지 또는 프로세스 종료 | `node src/restore.mjs` (안전 정책 v9 사본 검증 및 단건 복구) |

#### 3) 비밀값 취급 및 유의 사항
- **비밀값 미포장 원칙**: 데이터베이스 키, JWT 시크릿, 기기 개인키 등의 비밀값은 코드, 로그, Git 커밋, 문서에 일절 포장하거나 포함하지 않습니다. 필요한 경우 Vercel 시스템 환경변수 등 공식 비밀 입력란에만 직접 설정합니다.
- **범위 한계 명시**: 본 구현 및 안내는 교육 방어전의 검증 및 실습 목적이며, 상용 제품 완성, 보안 인증 취득, 또는 운영 방어 종료를 의미하지 않습니다.

## 보너스 과제: 무차별 로그인 공격을 잡아 냅니다 (xdr-01)

### 1. 현재 작동하는 기능과 다시 실행하는 방법
- Wazuh 모의 경보(`xdr/fixtures/brute-force.json`)에서 무차별 대입 및 비밀번호 스프레이 공격을 식별하는 MITRE ATT&CK T1110 기반 패턴 목록(`xdr/brute-force/patterns.json`)을 구성했습니다.
- 격리 환경 판단 모듈(`xdr/brute-force/decide.mjs`)이 외부 import 없이 단독으로 동작하여 명확한 공격은 `block`, 애매한 시도는 `alert`, 정상 이벤트는 `record`로 판정합니다.
- 연동 모듈(`xdr/brute-force/respond.mjs`)이 차단 후보에 대해 만료 시각과 근거 경보 번호가 담긴 ZTNA 거부 규칙을 등록하고 알림을 `xdr/alerts.log`에 기록합니다.
- 다시 실행하는 방법: `npm run xdr:run -- brute-force`

## 보너스 과제: 웹 주입 공격을 잡아 냅니다 (xdr-02)

### 1. 현재 작동하는 기능과 다시 실행하는 방법
- Wazuh 모의 경보(`xdr/fixtures/web-injection.json`)에서 SQL 주입, 스크립트/명령 삽입, 경로 거슬러 올라가기(../) 공격을 식별하는 MITRE ATT&CK T1190 기반 패턴 목록(`xdr/web-injection/patterns.json`)을 구축했습니다.
- 격리 환경 판단 모듈(`xdr/web-injection/decide.mjs`)이 외부 import 없이 단독으로 동작하여 명확한 주입 공격은 `block`, 의심스러운 시도는 `alert`, 정상 이벤트는 `record`로 판정합니다.
- 연동 모듈(`xdr/web-injection/respond.mjs`)이 차단 후보에 대해 만료 시각과 근거 경보 번호가 포함된 ZTNA 거부 규칙을 생성하고 알림을 `xdr/alerts.log`에 기록합니다.
- 다시 실행하는 방법: `npm run xdr:run -- web-injection`

## 보너스 과제: 알려진 취약점 악용을 잡아 냅니다 (xdr-03)

### 1. 현재 작동하는 기능과 다시 실행하는 방법
- Wazuh 모의 경보(`xdr/fixtures/known-cve.json`)에서 Log4j(CVE-2021-44228) 원격 조회(JNDI) 및 취약점 점검 도구 악용을 식별하는 MITRE ATT&CK T1190 기반 패턴 목록(`xdr/known-cve/patterns.json`)을 구축했습니다.
- 격리 환경 판단 모듈(`xdr/known-cve/decide.mjs`)이 외부 import 없이 단독으로 동작하여 명확한 원격 조회 주입 및 스캐너 악용은 `block`, 단순 검색/불완전 시도는 `alert`, 정상 이벤트는 `record`로 판정합니다.
- 연동 모듈(`xdr/known-cve/respond.mjs`)이 차단 후보에 대해 만료 시각과 근거 경보 번호가 포함된 ZTNA 거부 규칙을 생성하고 알림을 `xdr/alerts.log`에 기록합니다.
- 다시 실행하는 방법: `npm run xdr:run -- known-cve`

## 보너스 과제: 지속성 확보 공격을 잡아 냅니다 (xdr-04)

### 1. 현재 작동하는 기능과 다시 실행하는 방법
- Wazuh 모의 경보(`xdr/fixtures/persistence.json`)에서 서명 없는 신규 서비스 등록, 임시 폴더 실행 예약 작업, 시작 폴더 비인가 침투를 식별하는 MITRE ATT&CK T1543 및 T1053 기반 패턴 목록(`xdr/persistence/patterns.json`)을 구축했습니다.
- 격리 환경 판단 모듈(`xdr/persistence/decide.mjs`)이 외부 import 없이 단독으로 동작하여 명확한 지속성 확보 시도는 `block`, 수업 도구 유사 명칭이나 단순 설명 변경은 `alert`, 정상 이벤트는 `record`로 판정합니다.
- 연동 모듈(`xdr/persistence/respond.mjs`)이 차단 후보에 대해 만료 시각과 근거 경보 번호가 포함된 ZTNA 거부 규칙을 생성하고 알림을 `xdr/alerts.log`에 기록합니다.
- 다시 실행하는 방법: `npm run xdr:run -- persistence`

## 보너스 과제: 권한 상승 공격을 잡아 냅니다 (xdr-05)

### 1. 현재 작동하는 기능과 다시 실행하는 방법
- Wazuh 모의 경보(`xdr/fixtures/privilege.json`)에서 비인가 관리자 그룹 등록, 특권 명령 악용, 업무 외 시간 권한 남용을 식별하는 MITRE ATT&CK T1068 및 T1078 기반 패턴 목록(`xdr/privilege/patterns.json`)을 구축했습니다.
- 격리 환경 판단 모듈(`xdr/privilege/decide.mjs`)이 외부 import 없이 단독으로 동작하여 명확한 권한 상승 및 도용 시도는 `block`, 일반 과제 그룹 변경이나 단발성 시도는 `alert`, 정상 이벤트는 `record`로 판정합니다.
- 연동 모듈(`xdr/privilege/respond.mjs`)이 차단 후보에 대해 만료 시각과 근거 경보 번호가 포함된 ZTNA 거부 규칙을 생성하고 알림을 `xdr/alerts.log`에 기록합니다.
- 다시 실행하는 방법: `npm run xdr:run -- privilege`

## 보너스 과제: 데이터 유출 공격을 잡아 냅니다 (xdr-06)

### 1. 현재 작동하는 기능과 다시 실행하는 방법
- Wazuh 모의 경보(`xdr/fixtures/exfiltration.json`)에서 미승인 목적지 대용량 전송, 업무 외 시간 압축 파일 반출, C2 명령 통로 유출을 식별하는 MITRE ATT&CK T1041 및 T1048 기반 패턴 목록(`xdr/exfiltration/patterns.json`)을 구축했습니다.
- 격리 환경 판단 모듈(`xdr/exfiltration/decide.mjs`)이 외부 import 없이 단독으로 동작하여 명확한 유출 시도는 `block`, 소용량 전송이나 수업 자료 동기화는 `alert`, 정상 이벤트는 `record`로 판정합니다.
- 연동 모듈(`xdr/exfiltration/respond.mjs`)이 차단 후보에 대해 만료 시각과 근거 경보 번호가 포함된 ZTNA 거부 규칙을 생성하고 알림을 `xdr/alerts.log`에 기록합니다.
- 다시 실행하는 방법: `npm run xdr:run -- exfiltration`
