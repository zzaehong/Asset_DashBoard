# 월간 자산 흐름 플래너

현재 계좌 상태와 미래 이벤트를 바탕으로, 선택한 3·6·12개월의 현금과 순자산 흐름을 보여주는 개인용 MVP입니다.

## 실행

Docker가 설치된 환경에서 다음을 실행합니다.

```bash
cp .env.example .env
# .env에 로컬 MySQL 사용자·비밀번호를 입력
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Backend API 문서: `http://localhost:8000/docs`

## 테스트

```bash
cd backend
python -m unittest discover -s tests -v
```

계산 엔진은 FastAPI와 데이터베이스에 의존하지 않는 순수 Python 도메인 계층으로 구성되어 있습니다.
