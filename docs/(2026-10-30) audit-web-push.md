# 웹푸시 기능 점검 (2026-10-30)

- 대상: FE #182(66dcf7c)·#184(1d84c24)·#185(8ebaa95) - 서비스 워커·앱 안 토스트·FCM 토큰. 기준 develop `335cfd5`
- 연계: BE #405 `notification.fcm.webpush-data-only` - gosky dev `true`(2026-10-30 17시대 확인)
- 방식: 코드 대조 + BE 발송 코드 읽기 + gosky dev 실측(같은 날 설계 문서 6절). **점검만, 코드 수정 없음**
- 기준선: lint 0 errors(경고 6 기존), `npm test` 402, `npm run test:browser` 283, build 통과

## 점검 파일

`public/firebase-messaging-sw.js`, `public/push-sw-logic.js`, `src/components/PushNotificationListener.{tsx,kind.ts,module.css}`(루트 `layout.tsx`에 붙음 - 모든 화면),
`src/lib/fcm.ts`(사용처 `completeSignin`·`RoleRouteGuard`·로그아웃 mutation), `src/app/manifest.ts`, `public/icons/push/*`

## 종류 × 역할 × 표시·이동 (SW 기준)

| data.type | 받는 역할 | 표시(data 전용) | 버튼 | SW 이동 | 토스트 이동 | 판정 |
|---|---|---|---|---|---|---|
| WARD_SOS | 보호자 | 경고 아이콘·requireInteraction·renotify | SOS 화면·가족 연락처 | `/guardian/sos` | 같음 | PASS (tag는 L-1) |
| ANOMALY_DETECTED | 보호자 / 본인 | 종류별 아이콘·renotify | 보호자만 2개 | `/guardian/detection?session=` / `/ward` | 같음 | PASS |
| ANOMALY_REVIEW_*·CAMERA_LINK_LOST | 보호자 | 눈 아이콘 | - | `/guardian/detection` | 같음 | PASS |
| MEDICATION_REMINDER | 피보호자 | 알약 | - | `/ward/medication` | 같음 | **FAIL (H-1)** |
| MEDICATION_MISSED·STOPPED | 보호자 | 알약 | - | `/guardian/medication` | 같음 | PASS (미복용은 보호자·피보호자별 하루 1회) |
| CONNECTION_REQUEST·ACCEPTED·REFUSED·CANCELLED·DISCONNECTED | 역할별 | 사람 | - | 역할별 연결 화면 | 같음 | PASS |
| CONNECTION_FORCED | 양쪽 | 사람 | - | 역할별 연결 화면 | **역할 홈** | **M-1** |
| INQUIRY_ANSWERED | 보호자 | 다리 | - | `/guardian/inquiries` | **`/guardian`** | **M-1** |

실측: 탭을 모두 닫은 피보호자에게 `CONNECTION_FORCED` 1건 → 알림 1개, SW가 `icon-connection`·`badge`·tag로 그림(설계 문서 6절).

## 보안·개인정보 (PHASE A) - PASS

| 항목 | 결과 |
|---|---|
| SW의 access token 사용 | `cookieStore`에서 읽어 `role` 값만 해석, 로그·postMessage·외부 전송 없음. 이미 JS로 읽을 수 있는 쿠키라 노출 범위가 늘지 않음 |
| 클릭 이동 URL | 경로는 고정 목록, data는 `sessionId`만 쿼리로 들어가고 `encodeURIComponent`·같은 출처 `new URL(path, origin)` → open redirect 불가 |
| 잘못된 역할 경로 | 역할을 모르면 보호자 경로로 열지만 `RoleRouteGuard`가 역할 홈으로 보냄 - 다른 역할 데이터 노출 없음. 역할을 모를 수 있는 iOS는 알림 버튼을 지원하지 않아 "피보호자에게 버튼" 우려도 실제로는 없음 |
| 로그·저장소 | 새 코드에 본문·이름·토큰 로그 없음. localStorage `careai_fcm_last_token`은 기기 토큰 문자열뿐, 로그아웃 때 지움 |

## 이슈

### 🟠 H-1. 복약 재알림이 소리 없이 이전 알림을 덮을 수 있다
- `getTag`가 `MEDICATION_REMINDER:{medicationId}`이고 `renotify: false`다. BE는 같은 약을 `attempt`를 올려 다시 보내고(`MedicationReminderPlanner` UNIQUE `(medication_id, dose_date, attempt)`), 같은 약의 다른 복용 시각도 같은 `medicationId`다.
- 첫 알림이 알림 목록에 남아 있으면(= 피보호자가 아직 반응하지 않은 바로 그 상황) 재알림은 **같은 tag로 교체되며 소리·진동이 나지 않는다**(Notifications API: 같은 tag + renotify false → 조용히 교체). 재알림의 목적이 무력화된다.
- 수정 제안: `MEDICATION_REMINDER`의 tag에 `doseDate`·`attempt`를 넣거나(`MEDICATION_REMINDER:{medicationId}:{doseDate}:{attempt}`), 이 종류를 `renotify: true`로. 둘 다 하면 묶임과 재알림이 모두 산다.
- 재발 방지 테스트: `pushSwLogic.test.ts`에 "attempt가 다르면 tag가 다르다(또는 renotify true)" 케이스.
- 수정 커밋 초안: `fix: 복약 재알림이 같은 tag로 소리 없이 교체되던 문제`

### 🟡 M-1. 토스트와 브라우저 알림의 이동 경로가 4곳 다르다
- `CONNECTION_FORCED`: SW `/guardian/wards`·`/ward/guardians`, 토스트 `getPushRoute`는 default → 역할 홈. `INQUIRY_ANSWERED`: SW `/guardian/inquiries`, 토스트 `/guardian`(피보호자는 `/ward`).
- 같은 알림이 앱 안에서 누르면 다른 화면으로 간다. 토스트 `getPushRoute`에 두 종류를 추가하면 맞는다.
- 재발 방지 테스트: 종류 × 역할 전수로 토스트 경로 == `push-sw-logic.getPath` 를 비교(점검 중 같은 방식으로 찾음). 지금 `PushNotificationListener.kind.test.ts`는 종류·아이콘만 맞춰 본다.
- 수정 커밋 초안: `fix: 앱 안 토스트의 강제 연결·문의 답변 이동 경로를 브라우저 알림과 맞춤`

### 🟡 M-2. 서비스 워커 파일의 연결(리스너 순서·그리지 않는 분기)이 자동 테스트 밖이다
- 단위 테스트는 `push-sw-logic.js`의 순수 함수만 본다. `firebase-messaging-sw.js`에서 ① `notificationclick`을 `firebase.messaging()`보다 먼저 등록, ② `shouldDraw`가 false면 `showNotification`을 부르지 않음, ③ 그 밖에는 정확히 1번 부름 - 이 셋이 깨지면 "누르면 아무 데도 안 감"·"두 번 표시"가 조용히 돌아온다. 이번에는 실측으로만 확인했다.
- 제안: `importScripts`·`firebase`·`self`를 가짜로 두고 SW 파일을 `vm`으로 실행해 등록 순서와 `showNotification` 호출 수를 고정하는 테스트(firebase 설정 블록은 읽기만).

### 🟢 L-1. SOS 연타가 하나로 묶이지 않는다(설계 의도와 다름, 안전 쪽)
- SOS는 누를 때마다 새 `sosEventId`라 tag가 매번 달라, BE 쿨다운을 통과한 SOS는 `requireInteraction` 알림으로 각각 쌓인다. 설계는 "같은 SOS 연타가 쌓이지 않게"였다. 긴급 알림이 빠지지는 않으므로 수용 가능 - 묶으려면 `WARD_SOS:{wardId}` + renotify(지금도 true).

### 🟢 L-2. 토스트 알림 영역이 비어 있을 때 DOM에 없다
- `toasts.length === 0`이면 `null`을 돌려, 알림 영역이 내용과 함께 새로 생긴다. `role="alert"`는 대체로 읽히지만 `role="status"`(일반 알림)는 일부 스크린 리더가 새로 생긴 영역을 읽지 않는다. 변경 전부터 같은 구조. 빈 영역을 늘 두면 해결된다.

### 🟢 L-3. FCM 토큰 정리의 경계
- 로그아웃에서 서버 삭제가 실패해도 `careai_fcm_last_token`을 지운다(`finally`) → 그 토큰은 다음 교체 때 지워지지 않고 BE 상한·만료 정리에 맡겨진다.
- 같은 브라우저에서 A가 로그아웃 없이 B로 로그인하고 토큰도 바뀐 경우, B 권한의 옛 토큰 삭제는 서버가 무시한다(A 소유) → A 계정에 죽은 토큰이 남는다. BE 사용자당 상한(오래된 것부터 삭제)이 결국 정리한다. 둘 다 수용 가능.

### 🟢 L-4. 토스트의 이상감지 경로가 `sessionId`를 인코딩하지 않는다
- SW는 `encodeURIComponent`, 토스트는 그대로. 세션 ID 형식(`ward_` + 영숫자)상 지금은 무해. M-1 수정 때 함께 맞추면 된다.

## 테스트 (PHASE D)

| 대상 | 덮는 것 | 빠진 것 |
|---|---|---|
| `pushSwLogic.test.ts` | 그리기 분기·모양·tag·버튼·클릭 경로·역할 해석 | 재알림 tag(H-1) |
| `PushNotificationListener.kind.test.ts` | 토스트·SW 종류·아이콘 일치, 막대, 시각 | 토스트·SW 이동 경로 일치(M-1) |
| `PushNotificationListener.browser.test.tsx` | data 문구 우선·두 줄·SOS assertive·버튼 경로·연결 수락·반응형 | - |
| `fcm.test.ts` | 교체 시 삭제 순서·같은 토큰·삭제 실패 | 로그아웃·계정 전환(L-3) |
| (없음) | - | SW 파일 연결(M-2) |

## 사람이 확인할 것
PC Chrome 실제 클릭 이동(탭 없을 때 `openWindow`), 안드로이드 Chrome 실기기(배지·버튼), 아이폰 홈 화면 아이콘·홈 화면 앱 푸시, SOS·이상감지 실제 발생 때의 모양.

## 종합 판정
**조건부 PASS** - 보안·개인정보 문제 없음, 두 번 표시 해결은 실측으로 확인. 다만 **H-1(복약 재알림이 소리 없이 덮임)은 피보호자 기능의 목적을 해치므로 빠르게 고칠 것**을 권한다. M-1·M-2는 같은 PR에서 테스트와 함께.
