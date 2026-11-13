# 말벗 마침 카드·테스트 판정 칸·표정 한국어 기능 점검 (2026-11-13)

> 대상: PR #263(머지 `484ed09`) - 6개 파일. 점검만 했다(코드 수정 없음).
> 정책 기준: BE `.claude/rules/policy-companion.md` "테스트 계정" - `analysis`는 응답에만(저장·로그 금지), 테스트 계정에만 실린다.

## 종합 판정

판정 결과가 일반 사용자에게 보이거나 저장되는 경로는 없다(🔴·🟠 0). 하지만 PR #263이 만든 **글자 크게 설정 시 가로 넘침 회귀 1건(🟡)**이 있다. 테스트 칸에서만 생기지만 태블릿에서는 페이지 전체가 가로로 밀리므로 고치는 것을 권한다. 그 밖에 작은 어긋남 4건(🟢)이 있다.

| 심각도 | 건수 | 내용 |
|---|---|---|
| 🔴 | 0 | - |
| 🟠 | 0 | - |
| 🟡 | 1 | 지난 대답 표가 줄바꿈 없이(`nowrap`) 넓어져 글자 크게(1.471배)에서 태블릿 페이지 가로 넘침, 폰은 표 안 가로 스크롤(M-1) |
| 🟢 | 4 | L-1~L-4 |

## 1. 기준선 (PHASE -1)

| 항목 | 결과 |
|---|---|
| origin/develop | `484ed09`(#263 머지) |
| gosky dev(`silver-bridge-fe-dev-web`) | `484ed09`, develop과 같음(2026-11-13 반영) |
| 린트 | 경고 0 |
| 단위 테스트 | 654건 통과 |
| 브라우저 테스트 | 644건 통과 |
| `next build` | 성공 |

## 2. 대상과 사용처 (PHASE 0)

| 코드 | 사용처 | 비고 |
|---|---|---|
| `companionAnalysis.ts`(`faceLabel`·`summarize*`·`format*`) | `WardCompanionContent.tsx` 한 곳 | 다른 화면은 쓰지 않음 |
| `IWardCompanionTurnAnalysis`·`IWardCompanionResultAnalysis` | `companionAnalysis.ts`·`companion.ts`(응답 타입) | - |
| 테스트 칸 표시 조건 | `today.data?.testMode === true`(BE `today.testMode`) | 폰 `compact`(574행), 태블릿 aside(581행), 테스트 시작 칸(614행) 모두 이 조건 안 |

BE·AI 계약 대조:

| 칸 | AI(`companion_router._face_dict`) | BE(`CompanionDtos.TurnAnalysis`) | FE |
|---|---|---|---|
| `face.label` | `Happiness`·`Neutral`·`Sadness`(`face_service.HEAD3_LABELS`) 또는 `None` | `Map<String,Object>` 그대로 | 8종 매핑에 포함 |
| `face.labelKo` | 아직 없음 | Map이라 AI가 넣으면 그대로 전달 | 있으면 우선 사용 |
| `alertLevel` | - | `URGENT`·`INFO`·null | 긴급·안내·없음 |

- gosky dev의 `COMPANION_TEST_ALL_WARDS` 켜짐 여부는 **확인하지 못했다**(자동 모드가 운영 컨테이너 환경 변수 읽기를 막음). 켜져 있으면 gosky dev의 모든 피보호자에게 테스트 칸이 보이므로, M-1이 테스트 계정 밖으로도 보인다.

## 3. 노출·개인정보 (PHASE A) - PASS

| 확인 | 결과 |
|---|---|
| 테스트 칸이 `testMode`에서만 보이는가(폰·태블릿 두 경로) | PASS - 세 렌더 지점 모두 `testMode &&` 조건 |
| 판정 결과가 localStorage·sessionStorage·console·URL·전송 요청에 남는가 | PASS - React 상태(`talk.results`)에만 있음, 해당 호출 없음 |
| 일반 계정에 `analysis`가 와도 보이는가 | PASS - 결과가 쌓여도 렌더하지 않음(기존 테스트 `testMode가 아니면 테스트 칸·결과 칸이 없다`) |
| 표 행 `title`(판정 근거 원문) | 테스트 칸 안에서만 쓰임 - 노출 문제 없음(L-3은 사용성) |

## 4. 기능 정합성·구조 (PHASE B·C)

### M-1 🟡 지난 대답 표가 글자 크게에서 넘친다 (PR #263 회귀)

- 위치: `WardCompanionContent.module.css` `.earlierResults tbody th, .earlierResults td { white-space: nowrap }`
- 재현(브라우저 테스트로 측정, 가장 긴 값 조합 `판단 안 함 | 판단 못 함 | 판단 안 함 · 위험`):

| 화면 | 글자 배율 | PR #263 후 | PR #263 전 |
|---|---|---|---|
| 375×812 | 1 | 넘침 없음(347/347) | 넘침 없음 |
| 375×812 | 1.471(설정 최대) | **표 415px > 칸 347px** - 표 안 가로 스크롤 | 넘침 없음(옛 줄은 줄임표) |
| 1280×800 | 1 | 넘침 없음 | 넘침 없음 |
| 1280×800 | 1.471 | **페이지 폭 1327px > 1280px** - 오른쪽 칸이 넓어져 페이지 전체 가로 스크롤 | 넘침 없음 |

- 원인: 옛 지난 대답 줄은 말·표정 글을 `ellipsis`로 줄였는데, 표로 바꾸며 모든 칸을 `nowrap`으로 두어 표의 최소 폭이 오른쪽 칸(`minmax(320px, 400px)`)보다 커졌다.
- 수정 방향: 표 칸을 `white-space: normal; word-break: keep-all`로 바꿔 두 줄까지 허용(또는 `table-layout: fixed` + 첫 칸 폭 고정), `.testResults`에 `min-width: 0`. 375·1280 × 배율 1·1.471에서 `earlierWrap.scrollWidth <= clientWidth`, 페이지 `scrollWidth <= 화면 폭`을 브라우저 테스트로 고정한다.

### 🟢 Low

| ID | 내용 | 위치 | 수정 방향 |
|---|---|---|---|
| L-1 | `face.label`·`labelKo`가 문자열이 아니면 `.trim()`이 예외를 던져 테스트 화면이 깨진다. BE가 AI Map을 그대로 넘기므로 타입이 보장되지 않는다. 기존 `moodText`의 `.toUpperCase()`도 같은 모양(이전부터 있음) | `companionAnalysis.ts` `faceLabel`·`moodText` | `typeof value === 'string'` 가드 + 단위 테스트 |
| L-2 | 마침 요약의 `title`·`rowLabel`은 이제 화면에서 쓰이지 않는다(폰 접힌 줄 제목은 `'대화 마침 판정'` 하드코딩) | `summarizeResultAnalysis`·`TestResults` | 다음에 손댈 때 정리(동작 영향 없음) |
| L-3 | 지난 대답의 판정 근거는 행 `title`(마우스 올림)으로만 볼 수 있어 터치 기기에서는 보이지 않는다(옛 `li title`부터 같음) | `TestResults` 표 행 | 필요하면 행을 눌러 펼치는 '자세히'로 |
| L-4 | 대답 0번으로 마친 대화에서도 `alertLevel`이 `INFO`("알림 안내")로 왔다(2026-11-13 gosky dev 실측). FE는 받은 값을 그대로 보인다 - AI·BE 쪽 판단이라 FE 범위 밖 | 참고 | AI 쪽에서 0턴 대화의 알림 단계가 의도인지 확인 |

### 그 밖에 확인한 것 (문제 없음)

- 표정 우선순위: 사진 0장 → "사진 없음", `usable=false` → "판단 못 함", 그 밖에는 `labelKo` → 8종 매핑 → `-`. 대소문자·앞뒤 공백 무시
- 마침 한 줄: `alertLevel` null/INFO/URGENT, `riskFlag`, `mood` null("판단 불가"), `turnCount` 0 조합 모두 올바른 문구·색
- 지난 대답 표: 최근 것부터, 마침 행 제외, 기분은 결과 칸 한 번, 이어 하는 대화도 서버 `turnNo`로 번호를 붙임
- 마침 카드 스크롤: 서버 종료·그만하기 모두 `talk.ended`로 같은 렌더에서 카드가 생겨 효과가 카드 기준으로 동작. 세션이 끊긴 경우는 대화를 닫으므로 해당 없음. gosky dev 375px 실측에서 카드 위 341px(화면 안), 제목 두 줄
- 지운 CSS 클래스(`earlierTitle`·`earlierNo`·`earlierLine`) 참조 없음, 태블릿 표 머리줄 고정(`sticky`)·표만 스크롤

## 5. 테스트 (PHASE D)

| 항목 | 테스트 | 판정 |
|---|---|---|
| 테스트 칸은 testMode에서만 | 있음(`testMode가 아니면 …`) | 충분 |
| 표정 labelKo 우선·8종·모르는 값 `-` | 단위 + 브라우저 있음 | 충분 |
| 마침 한 줄·중복 없음 | 단위 + 브라우저 있음 | 충분 |
| 마침 카드 두 줄·카드 위 화면 안·가로 넘침(375/768/1280) | 있음(배율 1만) | **약함** - 배율 1.471과 가장 긴 판정 값 조합이 없어 M-1을 못 잡았다 |
| 문자열이 아닌 라벨 | 없음 | L-1과 함께 추가 |

## 6. 수정용 커밋 메시지 초안

```
fix: 말벗 지난 대답 표가 글자 크게에서 넘치지 않게 칸 줄바꿈 허용·라벨 타입 가드
```
