# AI 의료 챗봇 "이어서 물어볼 질문" FE 반영 (2026-10-30)

> AI #135(`suggestedQuestions` 응답) · BE #408(전송 응답 정리) · FE 이 PR

## 무엇이 바뀌나

빠른 질문 칸이 최신 답의 `suggestedQuestions`(0~3개)로 바뀐다. 첫 화면·질문이 없는 답(응급·자해·예약 선택지 등) 뒤에는 지금 고정 문장을 쓴다.

| 역할 | 표시 |
|---|---|
| 보호자 | "병원 예약하고 싶어요" 강조 칩은 항상 맨 앞, 그 뒤에 이어질 질문(같은 문장은 한 번만). 질문이 없으면 고정 칩 4개 |
| 피보호자 | 이어질 질문을 먼저(말풍선 아이콘), 남는 칸은 기본 문장(주의 아이콘)으로 채워 큰 버튼 4개 유지 |

- 누르면 바로 전송(기존과 같음), 칸 제목 "눌러서 물어보세요" 그대로
- 문자열이 아니거나 빈 값은 무시하고 최대 3개만 쓴다(BE도 정리한다)
- 옛 AI·BE(칸 없음)에서는 지금과 똑같이 동작한다

## 변경 파일

- `src/service/interface/chat.ts` - `ChatResponse`·`ChatMessage`에 `suggestedQuestions?: string[]`
- `src/components/chatbot/ChatbotContent.tsx` - 응답 복사, `latestSuggestions`·`guardianPrompts`·`wardPrompts`
- `ChatbotContent.browser.test.tsx` - 3건 추가(보호자 칩 순서·전송·질문 없는 답 뒤 복귀, 피보호자 4칸 채우기, 형식이 다른 값 무시)

## 바뀌지 않는 것

- 역할별 화면 구조, history 미전송, sessionId 유지, 대리 상담 context, 키보드가 뜰 때 빠른 질문 숨김
