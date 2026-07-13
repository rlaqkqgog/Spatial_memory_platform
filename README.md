# 공간기억 위치 실험 플랫폼

연구 참가자가 평면도 위에 기억나는 위치를 표시하는 Next.js 기반 웹 애플리케이션입니다.

현재 구현한 MVP는 참가자 ID 입력, 평면도 표시, 빨강·파랑·초록·노랑 마커 각 3개(총 12개) 입력, 이동·삭제·전체 초기화, 입력 현황, 제출, Supabase 저장을 포함합니다.

## 프로젝트 구조

```text
src/
  app/
    api/submissions/       # 서버 전용 제출 API (Supabase secret key 사용)
    page.tsx               # 참가자 화면 진입점
  components/experiment/  # 화면 단위 React 컴포넌트
  lib/                     # 순수 마커 계산, API 호출 함수
  types/                   # 마커·이벤트·제출 데이터 타입
public/
  floor-plan-placeholder.svg # 교체 가능한 기본 평면도
supabase/migrations/
  202607130001_initial_schema.sql # DB 테이블·보안·저장 함수
```

좌표는 이미지 픽셀이 아닌 `0~1` 정규화 좌표로 저장합니다. 따라서 화면 크기와 관계없이 같은 위치를 저장하며, 평면도 이미지만 바꾸어 다른 실험 조건으로 확장할 수 있습니다.

## 처음 실행하기

### 1. Node.js 확인

PowerShell에서 프로젝트 폴더로 이동합니다.

```powershell
cd "C:\Users\Inyoung\Documents\Codex\2026-07-13\new-chat\spatial-memory-platform"
node --version
```

Node.js 20 이상을 권장합니다.

### 2. 패키지 설치

```powershell
npm install
```

PowerShell이 `npm.ps1` 실행을 차단하면, 같은 명령에서 `npm` 대신 `npm.cmd`를 사용합니다.

```powershell
npm.cmd install
```

### 3. Supabase 연결

1. [Supabase Dashboard](https://supabase.com/dashboard)에 로그인하고 **New project**를 누릅니다.
2. 프로젝트 이름·데이터베이스 비밀번호·리전을 입력한 뒤 **Create new project**를 누릅니다.
3. 생성이 끝나면 왼쪽 메뉴에서 **SQL Editor** → **New query**를 누릅니다.
4. `supabase/migrations/202607130001_initial_schema.sql` 파일 전체를 복사해 붙여 넣고, 오른쪽 아래의 **Run**을 누릅니다.
5. Dashboard의 **Settings** → **API Keys**에서 Project URL과 **Secret key**를 복사합니다. 이전 프로젝트라면 Legacy API Keys의 `service_role` 키도 사용할 수 있습니다.
6. 아래 명령으로 환경 변수 파일을 만듭니다.

```powershell
Copy-Item .env.example .env.local
```

7. `.env.local`을 열고 값을 붙여 넣습니다.

```dotenv
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

`SUPABASE_SECRET_KEY`는 서버에서만 사용합니다. 이름 앞에 `NEXT_PUBLIC_`을 붙이거나 브라우저 코드에 넣으면 안 됩니다.

### 4. 개발 서버 시작

```powershell
npm run dev
```

PowerShell 실행 정책 오류가 있으면 다음 명령을 사용합니다.

```powershell
npm.cmd run dev
```

터미널에 표시된 주소(일반적으로 `http://localhost:3000`)를 브라우저에서 엽니다. 서버를 멈출 때는 터미널에서 `Ctrl + C`를 누릅니다.

## 매번 확인할 테스트 절차

### 화면 동작 확인

1. 참가자 ID에 `TEST-001`을 입력하고 **실험 시작**을 누릅니다.
2. 색상 하나를 선택하고 평면도를 세 번 클릭합니다. 해당 색상의 남은 개수가 `0 / 3`이 되는지 확인합니다.
3. 마커 하나를 드래그해 다른 위치로 옮깁니다.
4. 마커의 `×` 버튼을 눌러 삭제한 뒤, 다시 하나를 배치합니다.
5. 다른 세 색상도 각각 세 개씩 입력해 총 `12 / 12`가 되는지 확인합니다.
6. **제출**을 누릅니다. 성공하면 “응답이 저장되었습니다” 화면이 보이고 수정할 수 없어야 합니다.
7. Supabase Dashboard의 **Table Editor**에서 `experiment_submissions`에 1개, `marker_responses`에 12개 행이 생겼는지 확인합니다. `experiment_events`에는 시작·색상선택·배치·이동·삭제·제출 이력이 저장됩니다.

### 코드 검사

변경 후 아래 두 명령을 실행합니다.

```powershell
npm run lint
npm run build
```

둘 다 오류 없이 끝나야 합니다. 이 프로젝트는 TypeScript strict mode와 ESLint를 사용합니다.

## 평면도 교체

현재 `public/floor-plan-placeholder.svg`는 예시입니다. 실제 연구 평면도를 사용할 때는 이 파일을 실제 SVG로 교체하면 됩니다. PNG나 JPG를 사용하려면 `src/components/experiment/floor-plan-canvas.tsx`의 `src` 값을 해당 파일명으로 변경합니다.

실험 시작 전에 실제 평면도에서 클릭 위치와 저장 좌표가 연구자가 의도한 위치와 일치하는지 반드시 파일럿 테스트를 하세요.

## 저장 데이터와 보안

- `experiment_submissions`: 참가자 ID, 실험 조건 코드, 시작·제출 시각, 소요 시간, 총 삭제 횟수
- `marker_responses`: 색상, 정규화 X/Y 좌표, 배치 시각, 이동 횟수
- `experiment_events`: 시작, 색상 선택, 배치, 이동, 삭제, 제출 시각과 위치

브라우저는 Supabase에 직접 연결하지 않습니다. Next.js 서버 API만 Secret key를 사용하고, SQL은 Row Level Security를 켠 상태에서 참가자용 테이블의 직접 접근을 막습니다. 제출·마커·이벤트는 PostgreSQL 함수 하나에서 트랜잭션으로 저장됩니다.

### 이벤트 로그 시간과 NULL 값

`experiment_events`의 `occurred_at`은 참가자가 실제로 행동한 시각입니다. `created_at`은 제출 버튼을 누른 뒤 서버가 이벤트를 한 번에 저장한 시각이므로, 같은 제출의 이벤트에서는 대부분 같은 값으로 보이는 것이 정상입니다.

- `start`: 마커·색상·좌표가 없으므로 관련 열은 `NULL`
- `color_select`: 색상만 있으므로 마커 ID·좌표는 `NULL`
- `marker_place`, `marker_move`, `marker_delete`: 마커 ID·색상·X/Y 좌표가 있음
- `submit`: 마커·색상·좌표가 없으므로 관련 열은 `NULL`

참가자 ID와 함께 보기 위해서는 `202607130003_admin_event_log_view.sql`을 실행한 뒤 Table Editor의 **Views**에서 `admin_event_log`를 여세요. `participant_action_at`이 실제 행동 시각이고, `recorded_at`은 서버 저장 시각입니다.

## Vercel 배포

1. 이 프로젝트를 GitHub 저장소에 올립니다.
2. [Vercel](https://vercel.com)에서 **Add New** → **Project**를 누르고 해당 저장소를 선택합니다.
3. Framework Preset이 **Next.js**인지 확인합니다.
4. **Environment Variables**에 `SUPABASE_URL`과 `SUPABASE_SECRET_KEY`를 추가합니다. Production, Preview, Development에 각각 적용할지 선택합니다.
5. **Deploy**를 누릅니다.

환경 변수를 추가하거나 바꾼 뒤에는 Vercel에서 다시 배포해야 적용됩니다.

## 다음 개발 단계

1. 관리자 로그인 및 참가자 목록
2. 정답 좌표 관리와 자동 채점
3. 이벤트 로그 조회·분석 화면
4. CSV 다운로드
5. Excel 다운로드
6. 거리 계산 결과와 색상별·평균 오차 분석

현재 채점 방식은 설계 문서의 유클리드 거리 기준을 적용할 수 있도록 정규화 좌표를 저장합니다. 실제 채점 규칙(색상 안에서 순서대로 비교할지, 최적 매칭을 사용할지)은 관리자·채점 단계 구현 전에 연구 설계에 맞추어 확정합니다.
