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
