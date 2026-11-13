# 안부 말벗 목소리 재생 기능 점검 (2026-11-13)

> 대상: PR #268(머지 `bed28e6`) - `useCompanionVoice.ts`(새 파일)·`WardCompanionContent.tsx`·`service/api/ward/companion.ts`·응답 타입·CSS·브라우저 테스트. 점검만 했다(코드 수정 없음).
> 짝 BE: #484(`c60f9ece`, `GET /api/ward/companion/sessions/{sessionId}/audio/{index}`), AI: #281(Supertonic F1).

## 종합 판정

소리가 저장되거나 남의 대화 소리가 재생되는 경로는 없고, 녹음에 말벗 목소리가 섞이는 경로도 찾지 못했다(🔴·🟠·🟡 0). 실기기에서만 확인할 수 있는 항목과 작은 어긋남 4건(🟢)이 남았다. 지금 고칠 것은 없고, L-1·L-2는 아이폰 실기기 결과를 본 뒤 정한다.

| 심각도 | 건수 | 내용 |
|---|---|---|
| 🔴 | 0 | - |
| 🟠 | 0 | - |
| 🟡 | 0 | - |
| 🟢 | 4 | L-1~L-4 |

## 1. 기준선 (PHASE -1)

| 항목 | 결과 |
|---|---|
| origin/develop | `b36127b`(#268 뒤 #267 게임 메뉴 머지 - 말벗 파일 무관) |
| gosky dev FE / BE | `bed28e63` / `c60f9ece`(14:18 재기동, healthy) |
| 말벗 브라우저 테스트 | 83건 통과(새 13건) |
| 단위 테스트 / `next build` | 656건 통과 / 성공 (PR #268 시점) |

## 2. 대상과 흐름 (PHASE 0)

| 코드 | 역할 |
|---|---|
| `fetchWardCompanionAudio` | `fetch` + 인증 헤더 + `cache: 'no-store'`. `apiClient`를 쓰지 않는다(401에 세션을 지우는 처리를 소리 하나로 타지 않게) |
| `useCompanionVoice.play` | 앞 소리 멈춤 → `audio` 없으면 기기 음성 / 있으면 받기(8초) → 재생, 실패·초과면 기기 음성 한 번 |
| `stop` | 순번(turn) +1, 받기 abort, 타이머 해제, pause·revoke, 기기 음성 취소 |
| `prime` | 시작 버튼 클릭 순간 무음 WAV 재생(iOS 자동 재생 권한) |
| 호출 지점 | 첫 질문 `startTalk`, 응답 `applyReply`, 다시 듣기·들려 주세요, 녹음 시작(`handleVoice` + `voice.state` 효과), 보내기·사진 묻기·그만하기, 대화 닫기·끊김(`reset`), 화면 떠남(언마운트) |

## 3. 보안·개인정보 (PHASE A)

| 항목 | 결과 |
|---|---|
| 남의 대화 소리 | BE가 403 `COMPANION_SESSION_NOT_OWNED` - FE는 상태와 무관하게 기기 음성으로 읽는다. FE가 `sessionId`를 바꿔 보낼 경로 없음(응답의 `sessionId`만 사용) **PASS** |
| 소리 저장 | 브라우저 캐시 `no-store`(BE 응답도 `no-store`), localStorage·Cache API 없음, Blob은 대화 메모리(Map)에만 - 닫기·끊김·떠남에 비움 **PASS** |
| 로그 | 소리·문장·토큰을 콘솔에 남기지 않는다 **PASS** |
| 토큰 만료 | `fetch`라 갱신하지 않는다. 다만 응답 목소리 요청 직전에 대답 요청(`apiClient`)이 먼저 토큰을 갱신하므로 실제 영향은 드물고, 실패해도 기기 음성으로 읽는다 **PASS** |
| `index` 값 | 정수일 때만 요청(`voiceAudio`), BE도 0~50 정수만 받는다 **PASS** |

## 4. 기능 정합성 (PHASE B)

| 항목 | 결과 |
|---|---|
| 녹음 시작 → 즉시 멈춤 | `handleVoice`(toggle 전)와 `voice.state`가 `recording`이 되는 효과 두 곳. 받던 소리·늦은 기기 음성 모두 순번으로 무효 **PASS** (테스트 2건) |
| 대신 읽기 한 번만 | `settled` + 순번 검사. 8초 초과 뒤 도착한 소리는 버림 **PASS** (gosky 실측: 503·네트워크 끊김·9.5초 지연 모두 1번) |
| 8초 상한과 BE 대기 | BE가 AI를 최대 5초(`COMPANION_AUDIO_WAIT_SECONDS`) 기다림 → 8초 안에 성공·실패가 정해진다 **PASS** |
| 다음 문장 → 멈춤·revoke | `play`가 먼저 `stop` **PASS** |
| NotAllowedError → 들려 주세요 | 그 문장에만 버튼, 누르면 받아 둔 Blob 재생 **PASS** |
| 다시 듣기 | Blob 재사용, 없으면 기기 음성(다시 받지 않음) **PASS** (gosky 실측: 재요청 0) |
| 이어 하는 대화 | BE가 `audio: null` → 기기 음성 **PASS** |
| 메모리 | mp3 48kbps 한 문장 수십 KB × 최대 8턴 + 질문 - 문제 없음 **PASS** |

## 5. 이슈

### L-1 🟢 동의 카드에서 "동의"를 고른 경우 무음 재생이 클릭 순간에 일어나지 않는다
- 위치: `handleConsentChoice` → `await updateWardCompanionTranscriptConsent(true)` 뒤 `start()` → `handleOpen`의 `prime()`.
- 영향: 첫 대화에서 동의를 고른 아이폰 Safari에서만, 저장 요청이 끝난 뒤라 클릭 권한이 끊겨 있을 수 있다. 그러면 "들려 주세요" 버튼이 뜬다(누르면 들림). "동의 안 함"은 바로 시작하므로 해당 없음.
- 제안: 실기기에서 실제로 막히면 `handleConsentChoice` 맨 앞(await 전)에서 `prime()`을 부른다.

### L-2 🟢 무음 재생이 바로 중단(AbortError)돼도 iOS 권한이 유지되는지 실기기 미확인
- gosky Chrome 실측에서 무음 재생은 질문 소리 직전 `stop`의 pause로 `AbortError`가 됐다(처리돼 화면 영향 없음). 데스크톱 Chrome은 상관없지만 iOS는 확인이 필요하다.
- 같이 볼 것: iOS는 마이크를 쓴 뒤 재생 소리가 작아지거나 수화기 쪽으로 나오는 일이 있다(녹음 뒤 응답 목소리 크기).

### L-3 🟢 받는 중에 그 문장의 "다시 듣기"를 누르면 서버 소리를 버리고 기기 음성으로 읽는다
- `replay`가 `stop`으로 받던 요청을 취소하고, 아직 Blob이 없어 기기 음성으로 읽는다. 그 문장은 다시 들어도 계속 기기 음성이다.
- 받기는 BE 기준 최대 5초라 드물다. 고치려면 같은 문장이 받는 중이면 `replay`가 아무것도 하지 않게 한다.

### L-4 🟢 테스트가 덮지 않는 경로
- 테스트 계정 시작(`handleOpenTest`)의 `prime`, `audio.index`가 정수가 아닐 때 기기 음성, L-3 경로. 동작은 단순하지만 고칠 때 함께 고정하면 좋다.
- 참고: `releaseUrl`이 `src`를 지운 뒤 `load()`를 부르지 않아 멈춘 요소가 옛 소리를 잠시 쥐고 있을 수 있다(다음 재생 때 풀림, 영향 없음).

## 6. 남은 확인 (사용자)

| 기기 | 볼 것 |
|---|---|
| 아이폰 Safari | 이야기 시작 → 첫 질문이 목소리로 나오는지 / 막히면 "들려 주세요" → 누르면 나오는지 / 말로 대답한 뒤 응답 목소리 크기(L-2) / 첫 대화 "동의" 경로(L-1) |
| 안드로이드 Chrome | 첫 질문·응답 목소리 / 녹음 누르면 바로 멈추는지 |
| AI 꺼짐 실제 | gosky AI 정지 필요(사용자 확인 대상) - 화면 동작은 503 흉내로 확인됨 |
