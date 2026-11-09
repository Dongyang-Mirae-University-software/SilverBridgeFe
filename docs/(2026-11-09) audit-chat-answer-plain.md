# (2026-11-09) 챗봇 답 화면 글자 위주 정리 기능 점검

- 대상: PR #226 (`e429b34`, 머지 `59cc499`) - `stripLeadEmoji.ts`(신규), `ChatBubble.tsx`·`.module.css`, `ChatbotContent.tsx`·`.module.css` 변경분
- 기준: FE `develop` `59cc499`, gosky dev FE `59cc499`(서빙 CSS에 `urgentLabel` 확인), AI `origin/main` `ef9c50f`(#196)
- 방법: 새 AI 호출 없이 확인했다. 실제 답은 gosky 시험 보호자 계정의 저장된 상담 기록(6건)과 AI 서버 코드(이모지 허용 목록·응급 경로)로 봤다.
- 종합 판정: **PASS** (🟡 1건 - AI·FE 함께 고칠 제안, 🟢 4건)

## 1. 사용처

| 경로 | 줄 머리 이모지 | 카드 아이콘 | 긴급 상자 |
|---|---|---|---|
| `ChatbotContent` → `ChatBubble` 보호자 `/guardian/chatbot` | layout 줄·reply 줄 모두 뗌 | 없음(왼쪽 4px 색 띠) | 있음 |
| 같은 경로 피보호자 `/ward/chatbot` | `breakSentences` 뒤 뗌 | 〃 | 있음(핵심 줄도 문장 줄바꿈) |
| "내 상담 기록" 창(`ChatbotContent`) | 답·경고 모두 뗌 | 해당 없음 | 해당 없음(경고 글자만 빨강) |
| `ChatUiPrompt`·`ChatToolCard`·칩 패널 | 원래 이모지 없음(FE 코드·AI 선택지 라벨 확인) | - | - |

## 2. 보안

| 항목 | 결과 |
|---|---|
| XSS | 모든 글을 React 글자 노드로 넣는다(`dangerouslySetInnerHTML` 없음). 기존 XSS 회귀 테스트 통과 |
| 정규식 성능 | `stripLeadEmoji`는 줄 머리에 고정되고 뒤가 선택이라 되돌아가기(backtracking)가 없다. 이모지 5만 자·ZWJ 5만 자 5ms |
| 판단에 쓰는가 | 이모지·문구로 판단하지 않는다. 긴급 여부는 `emergencyWarning` 유무와 `riskLevel === 'high'`만 본다(`riskLevel: 'low'` + 🚨 핵심 줄은 상자 없음 - 테스트 고정) |

## 3. 실제 답 검증

| 항목 | 결과 |
|---|---|
| AI 줄 머리 이모지 허용 목록 18종(🚨💬📝❓💡 + ⚠️🚫🩺🏥💊🩸🌡️💧🍚🚶🛏️🧊📞) | 18종 모두 지워짐(변형 선택자 포함), 문장은 그대로 |
| 18종을 줄마다 붙인 여러 줄 → 피보호자 경로 | 남은 그림 문자 0 |
| 저장된 상담 기록 6건(이모지가 든 답 1건, layout 1건) | 처리 뒤 답·경고·layout 모두 그림 문자 0 |
| AI 경고 문장(`emergencyWarning`) | 이모지 없음(AI 코드 확인) |

AI #196부터 새 답에는 이모지가 붙지 않는다. 이번 FE 변경은 그 전 기록과 옛 답을 정리하는 몫이 크다.

## 4. 긴급 상자 판정 ↔ AI 응급 경로

| AI 경로 | `emergencyWarning` | `riskLevel` | FE 결과 |
|---|---|---|---|
| 응급(119) 규칙 답·되묻기 "네" 응급 | 있음 | high | 긴급 상자 + 119 핵심 줄 ✅ |
| 자해 고정 응답(109) | 없음 | high | 긴급 상자 + 109 핵심 줄 ✅ |
| 모델 답 `intent=emergency_guidance` | 없을 수 있음 | high | 핵심 줄이 긴급 상자에 들어감 - 응급 안내라 수용 |
| **위기 뒤 해제 턴(`crisisFollowup`, 109 한 줄을 앞에 붙임)** | 없음 | 모델 값(보통 low·medium) | **일반 핵심 줄로 그려짐** → 🟡 M-1 |

## 5. 이슈

### 🟡 M-1. 위기 뒤 해제 턴의 109 핵심 줄이 긴급 상자에 들어가지 않는다

- AI `chat_layout.py`는 `meta.crisisFollowup`이면 109 문장을 핵심 줄로 올리지만, FE가 받는 칸에는 이 신호가 없다(FE 타입에 `meta` 없음, 경고 없음, 위험도는 모델 값).
- 변경 전에는 🚨가 붙은 굵은 핵심 줄이었고, 지금은 같은 굵은 줄에서 🚨만 빠졌다(AI #196 이후로는 AI 쪽에서도 🚨가 안 붙는다). 109 안내 자체는 그대로 맨 위에 보인다.
- 제안(AI·FE 함께, 사용자 결정 필요): AI가 응급·위기 layout에 `layout.urgent: true`를 싣고 FE가 그 칸도 긴급 판정에 넣는다. `riskLevel`을 high로 올리는 방법은 되묻기·답 칩 억제 같은 다른 동작까지 바뀌어 권하지 않는다.

### 🟢 Low

| # | 내용 | 처리 |
|---|---|---|
| L-1 | 기록 창 경고는 `join(' ')` 뒤 맨 앞만 떼므로, 둘째 경고에 줄 머리 이모지가 있으면 문장 사이에 남는다 | AI 경고에 이모지가 없어 실제로 생기지 않음 - 수용 |
| L-2 | 줄 머리의 키캡(1️⃣)·국기(🇰🇷)는 그림 문자 속성이 아니라 남는다 | AI 허용 목록 밖 - 수용 |
| L-3 | 테스트 공백: 피보호자 긴급 핵심 줄의 문장 줄바꿈, 보호자 휴대폰 칩 48px | 다음에 챗봇 화면을 고칠 때 함께 추가 |
| L-4 | `ChatbotContent.browser.test.tsx`의 `getHistoryWarning` 목이 실제 함수와 같은 동작을 따로 구현 | 실제 함수가 바뀌면 같이 고칠 것 |

## 6. 테스트 (PR #226 시점)

- tsc 0 / eslint 0 errors(경고 20, 기준선과 같음) / vitest 53파일 538건 / 챗봇 브라우저 테스트 5파일 전부 통과
- 추가 고정: 그림 문자 0개(layout·reply·기록 창), 긴급 상자·"긴급" 라벨·3px 테두리, 위험도 high만 있는 답, 낮은 위험도 + 🚨는 상자 없음, 질문 1개 큰 줄, `stripLeadEmoji` 단위(ZWJ·피부색·중간 글자 보존)
- 전체 브라우저 실행에서 `GuardianDashboardContent` 1건 간헐 실패(단독 2회 통과, 챗봇과 무관)

## 7. 반영 (2026-11-09, 같은 날)

| # | 반영 | 위치 |
|---|---|---|
| M-1 | AI가 응급·위기(emergency·crisis) 답 layout에 `urgent: true`를 싣고(표시 전용, 판정 칸 불변), FE가 긴급 판정에 넣는다(불리언 `true`만) | AI #198 `chat_layout.py` / FE `ChatBubble.tsx`·`chat.ts` |
| L-1 | 기록 창 경고는 문장마다 줄 머리 이모지를 뗀 뒤 잇는다 | `ChatbotContent.tsx` |
| L-2 | 줄 머리 국기는 떼고 키캡(1️⃣)은 번호라 남긴다(사용자 결정 A) | `stripLeadEmoji.ts` |
| L-3 | 테스트 추가: 피보호자 긴급 핵심 줄 문장 줄바꿈, 375px 칩 48px 이상 | 브라우저 테스트 |
| L-4 | 테스트가 실제 `getHistoryWarning`을 쓴다(목 제거) | `ChatbotContent.browser.test.tsx` |

함께 고친 것: `stripLeadEmoji` 정규식의 변형 선택자·ZWJ가 보이지 않는 실제 문자로 들어가 있던 것을 `️`·`‍` 이스케이프로 바꿨다(동작 같음).
