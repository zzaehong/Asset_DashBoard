# AGENTS.md

## 1. Project Overview

이 프로젝트의 목적과 제품 요구사항은 `PRD.md`에 정의되어 있다.

`PRD.md`는 프로젝트의 핵심 요구사항 문서이며, 기능을 구현하거나 변경할 때 우선적으로 참고한다.

`README.md`는 프로젝트의 기본적인 소개와 사용 방법을 설명한다.

---

## 2. Project Documentation

프로젝트의 주요 문서는 다음과 같다.

- `PRD.md` — 제품 요구사항 및 프로젝트 정의
- `README.md` — 프로젝트 소개 및 사용 방법
- `AGENTS.md` — AI agent의 개발 및 작업 규칙

`PRD.md`와 실제 구현 사이에 충돌이 발견되면 임의로 판단하지 말고 사용자에게 확인한다.

---

## 3. Development Principles

- 기존 프로젝트 구조와 문서를 먼저 이해한 후 코드를 작성한다.
- 요구사항을 충족하는 가장 단순한 구현을 우선한다.
- 요청된 작업의 범위를 임의로 확대하지 않는다.
- 기존 기능을 불필요하게 변경하지 않는다.
- 새로운 dependency는 필요한 경우에만 추가한다.
- 불확실한 사항은 추측하지 않는다.
- architecture를 크게 변경해야 하는 경우 먼저 사용자와 논의한다.

---

## 4. Task Workflow

모든 개발 작업은 가능한 한 다음 순서를 따른다.

### Before implementation

1. `git status`를 확인한다.
2. 관련 문서와 코드를 확인한다.
3. `PRD.md`에서 관련 요구사항을 확인한다.
4. 기존 architecture와 구현을 파악한다.
5. 필요한 경우 구현 계획을 먼저 제시한다.

### During implementation

1. 필요한 범위에서만 변경한다.
2. 기존 coding convention을 유지한다.
3. 불필요한 dependency를 추가하지 않는다.
4. 테스트 가능한 구조를 우선한다.

### After implementation

1. 변경된 파일을 확인한다.
2. 관련 테스트를 실행한다.
3. 가능한 경우 lint / type check를 실행한다.
4. `git diff`를 확인한다.
5. 의도하지 않은 변경사항이 없는지 확인한다.
6. 작업 결과와 테스트 결과를 요약한다.

---

## 5. Git Rules

작업 전 다음을 확인한다.

```bash
git status
````

변경 후 다음을 확인한다.

```bash
git status
git diff
```

Commit은 논리적으로 의미 있는 작업 단위로 작성한다.

예:

```text
feat: add user authentication
fix: handle invalid API response
refactor: simplify configuration
test: add authentication tests
docs: update project documentation
```

사용자의 명시적인 요청 없이 다음 작업을 수행하지 않는다.

* `git push`
* branch 삭제
* history rewrite
* force push
* 기존 commit 수정

다음과 같은 destructive command도 사용자의 명시적인 요청 없이 실행하지 않는다.

```bash
git reset --hard
git clean -fd
git push --force
```

---

## 6. Security

다음 정보를 source code나 Git repository에 저장하지 않는다.

* API keys
* passwords
* access tokens
* private keys
* 기타 credentials

Secret이 필요한 경우 적절한 environment variable 또는 secret management 방식을 사용한다.

Secret 값을 터미널 출력이나 최종 응답에 노출하지 않는다.

---

## 7. AI Agent Behavior

AI agent는 단순한 코드 생성기가 아니라 프로젝트의 개발 파트너로 행동한다.

### 원칙

* 먼저 이해하고 그 다음 수정한다.
* 기존 코드를 존중한다.
* 작은 변경을 선호한다.
* 변경 이유를 설명할 수 있어야 한다.
* 테스트 가능한 구현을 선호한다.
* 오류를 숨기지 않는다.
* 불확실한 내용을 사실처럼 단정하지 않는다.

### 작업 범위

현재 작업과 직접적으로 관련되지 않은 개선사항을 발견하더라도 사용자의 허락 없이 수정하지 않는다.

필요한 개선사항은 별도로 보고한다.

### 명령 실행

다음 명령은 실행 전에 영향을 확인한다.

* `sudo`
* `rm -rf`
* `git reset --hard`
* `git clean`
* `git push --force`
* Docker resource 삭제 명령
* database migration 또는 데이터 삭제 명령

---

## 8. Documentation

프로젝트의 중요한 architecture와 개발 방법은 문서화한다.

기존 문서가 있다면 먼저 확인하고 중복 문서를 만들지 않는다.

코드 자체가 명확한 경우 불필요한 주석을 추가하지 않는다.

---

## 9. Completion Criteria

작업 완료 전에 다음을 확인한다.

* 요구사항을 충족했는가?
* 관련 테스트가 통과했는가?
* 필요한 lint / type check가 통과했는가?
* 의도하지 않은 파일 변경이 없는가?
* secret이 포함되지 않았는가?
* `git diff`를 확인했는가?

최종 보고에는 다음을 포함한다.

1. 변경사항
2. 실행한 테스트
3. 테스트 결과
4. 추가 확인이 필요한 사항

````
