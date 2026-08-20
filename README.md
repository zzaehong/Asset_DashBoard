# 월간 자산 흐름 플래너

현재 계좌 잔액과 앞으로 일어날 재무 이벤트를 바탕으로 미래의 현금·순자산 흐름과 현금 부족 시점을 확인하는 개인용 자산 계획 서비스입니다.

세부 거래를 매일 기록하는 대신 월급, 고정 지출, 이체, 투자금 추가, 대출 상환처럼 의사결정에 영향을 주는 사건을 등록하는 데 초점을 둡니다.

현재 릴리즈 버전은 `0.1.0`입니다.

## 주요 기능

### 대시보드

- 3개월·6개월·12개월 예상 기간 선택
- 기간 말 현금과 순자산, 감지된 위험 요약
- 현금·순자산 전환형 영역 그래프
- 기간 말 금액, 시작 대비 증감, 최저 예상 금액 표시
- 현금 0원 기준선과 최저점 시각화
- 이벤트가 발생하는 월의 그래프 꼭지점 및 이벤트 건수 표시
- 계좌별 예상 잔액과 예정 이벤트 타임라인 제공

### 월별 계획

- 선택한 달의 일회성·반복 이벤트 조회
- 실제 발생일 기준 날짜순 정렬
- 이전 달·다음 달 이동 및 월 직접 선택
- 이벤트가 많아도 목록 내부 스크롤 없이 전체 내용 표시

### 계좌 관리

- 입출금, 저축, 투자, 부채, 기타 자산 계좌 등록
- 계좌 정보 수정 및 삭제
- 연결된 이벤트가 있는 계좌의 실수 삭제 방지
- 모든 계좌의 현재 상태 기준일 일치 검증

### 이벤트 관리

- 수입, 지출, 계좌 간 이체, 투자금 추가 등록
- 대출 실행·원금 상환·이자 납부 및 예·적금 만기 등록
- 월 단위 반복 간격과 선택적 반복 종료일 설정
- 이벤트 유형에 따른 출발·도착 계좌 검증
- 이벤트 수정 및 삭제

### Risk Guard

- 날짜별 이벤트 반영 후 현금 잔액이 음수가 되는 시점 감지
- 투자금 이동 후 현금 부족 위험 감지
- 위험 유형, 발생일, 예상 현금 잔액 표시
- 행동을 추천하기보다 사용자가 놓치기 쉬운 위험 시점을 알리는 데 집중

### 반응형 UI

- 데스크톱 고정 사이드바
- 모바일 드로어 내비게이션
- 모바일 계좌·이벤트 목록과 입력 화면 분리
- 키보드 포커스 이동, Escape 닫기, 배경 스크롤 방지 지원

## 빠른 시작

### 요구 사항

- Docker
- Docker Compose

### 1. 환경 변수 설정

```bash
cp .env.example .env
```

`.env`에 로컬 개발용 MySQL 설정을 입력합니다. 현재 Docker healthcheck와 맞추기 위해 루트 비밀번호는 아래 값을 사용합니다.

```dotenv
MYSQL_DATABASE=asset_dashboard
MYSQL_USER=asset_user
MYSQL_PASSWORD=local_password
MYSQL_ROOT_PASSWORD=root_local_only
```

이 값들은 로컬 실행 예시입니다. 외부에 노출되는 환경에서는 별도의 안전한 값을 사용하고 Docker 설정도 함께 변경해야 합니다.

### 2. 서비스 실행

```bash
docker compose up --build
```

MySQL이 준비되면 백엔드와 프런트엔드가 순서대로 시작됩니다.

| 서비스 | 주소 |
| --- | --- |
| 웹 애플리케이션 | <http://localhost:5173> |
| Backend API | <http://localhost:8000/api> |
| Swagger API 문서 | <http://localhost:8000/docs> |
| 상태 확인 | <http://localhost:8000/api/health> |

서비스를 중지할 때는 실행 중인 터미널에서 `Ctrl+C`를 누른 뒤 다음 명령을 사용합니다.

```bash
docker compose down
```

MySQL 데이터는 `mysql_data` Docker volume에 유지됩니다.

## 사용 순서

1. **계좌 관리**에서 현재 보유한 계좌와 잔액을 등록합니다.
2. 모든 계좌에 같은 현재 상태 기준일을 사용합니다.
3. **이벤트 관리**에서 앞으로 발생할 주요 수입·지출·이체를 등록합니다.
4. **월별 계획**에서 특정 달의 일회성·반복 이벤트를 확인합니다.
5. **대시보드**에서 분석 기간을 선택하고 현금·순자산 흐름과 Risk Guard를 확인합니다.

## 로컬 개발

Docker 없이 실행하면 백엔드는 기본적으로 프로젝트 위치의 SQLite 데이터베이스를 사용합니다.

### 백엔드

Python 3.12 이상이 필요합니다.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -e ".[dev]"
uvicorn app.main:app --reload
```

다른 데이터베이스를 사용하려면 실행 전에 `DATABASE_URL`을 설정합니다.

### 프런트엔드

Node.js 22 이상을 권장합니다.

```bash
cd frontend
npm ci
npm run dev
```

기본 API 주소는 `http://localhost:8000/api`입니다. 다른 주소를 사용하려면 프런트엔드 실행 전에 `VITE_API_BASE_URL`을 설정합니다.

```bash
VITE_API_BASE_URL=http://localhost:8000/api npm run dev
```

## 테스트와 빌드

### 백엔드 테스트

```bash
cd backend
python3 -m unittest discover -s tests -v
```

### 프런트엔드 테스트

```bash
cd frontend
npm test
```

### 프런트엔드 프로덕션 빌드

```bash
cd frontend
npm run build
```

계산 엔진은 FastAPI와 데이터베이스에 의존하지 않는 순수 Python 도메인 계층으로 구성되어 있습니다.

## 기술 구성

| 영역 | 기술 |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, TanStack Query, Recharts |
| Backend | Python 3.12, FastAPI, SQLAlchemy |
| Database | MySQL 8.4 (Docker), SQLite (로컬 기본값) |
| Test | unittest, Vitest |
| Runtime | Docker Compose |

```text
frontend/                 React 애플리케이션
backend/app/api/          FastAPI 라우트와 입출력 스키마
backend/app/domain/       이벤트 검증과 월별 예측 계산
backend/app/infrastructure/ 데이터베이스 연결과 저장소
backend/tests/            계산 엔진 회귀 테스트
PRD.md                    제품 요구사항과 도메인 규칙
```

## API 개요

| Method | Endpoint | 설명 |
| --- | --- | --- |
| `GET` | `/api/health` | 서버 상태 확인 |
| `GET`, `POST` | `/api/accounts` | 계좌 목록 조회·등록 |
| `PATCH`, `DELETE` | `/api/accounts/{account_id}` | 계좌 수정·삭제 |
| `GET`, `POST` | `/api/events` | 이벤트 목록 조회·등록 |
| `PATCH`, `DELETE` | `/api/events/{event_id}` | 이벤트 수정·삭제 |
| `GET` | `/api/forecast?period_months=12` | 3·6·12개월 예측과 위험 조회 |

상세 요청·응답 스키마는 실행 후 Swagger API 문서에서 확인할 수 있습니다.

## 현재 릴리즈 범위

이 버전은 개인이 로컬 환경에서 사용하는 MVP입니다.

- 통화 표시는 KRW를 기준으로 합니다.
- 사용자 계정, 인증, 권한 분리는 제공하지 않습니다.
- 금융기관 자동 연동이나 거래 자동 수집은 제공하지 않습니다.
- 투자 수익률 예측이나 금융상품 추천을 제공하지 않습니다.
- 데이터베이스 스키마는 애플리케이션 시작 시 자동 생성되며 별도 마이그레이션 체계는 아직 없습니다.
- 실제 금융 의사결정 전에는 원본 계좌와 일정 정보를 다시 확인해야 합니다.

제품 정의와 상세 도메인 규칙은 [PRD.md](./PRD.md)를 참고하세요.
