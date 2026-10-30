# 웹푸시 새 디자인 + 알림 두 번 표시 해결 (2026-10-30)

## 1. 알림 두 번 표시 - 원인과 해결

**원인**: BE가 `notification` 블록을 넣어 보내면, 앱 탭이 보이지 않을 때 `@firebase/messaging`의 `onPush`가
알림을 자동으로 띄운다(`payload.notification`이 있으면 `showNotification`). 그 뒤 우리 `onBackgroundMessage`가
`self.registration.showNotification`으로 한 번 더 띄웠다 → PC·휴대폰 모두 알림 두 개.

**함께 있던 문제**: 라이브러리는 `firebase.messaging()` 시점에 `notificationclick` 리스너를 먼저 등록하고, 자기가 띄운
알림(`data.FCM_MSG`)의 클릭을 `stopImmediatePropagation()`으로 가로챈다. 링크가 없으니 **라이브러리 알림을 눌러도 아무 화면도 열리지 않았다**.

**해결(B안 - 서비스 워커 혼자 그린다)**
1. 우리 `notificationclick`을 `firebase.messaging()`보다 먼저 등록한다. 데이터는 `FCM_MSG.data ?? data`로 읽는다.
2. `onBackgroundMessage`에서 `payload.notification`이 있으면(라이브러리가 이미 띄움) 그리지 않는다 - **전환 기간 방어**.
   FE만 먼저 배포돼도 이때부터 한 번만 뜬다. 그 기간에는 라이브러리 표시라 새 아이콘·버튼이 빠진다(수용).
3. BE가 웹 토큰에 data만 보내도록 켜면(`notification.fcm.webpush-data-only=true`, BE 세션 PHASE 6) 서비스 워커가
   `data.title`·`data.body`로 아이콘·배지·버튼·tag까지 그린다.

규칙은 `public/push-sw-logic.js`(순수 함수, `importScripts`)에 있고 `src/lib/push/pushSwLogic.test.ts`가 시험한다.

## 2. 종류별 표

| data.type | 종류(색) | 아이콘 | 버튼(보호자만) | 누르면 | tag · renotify |
|---|---|---|---|---|---|
| WARD_SOS | 긴급(`--sb-danger`) | 경고 | SOS 화면 열기 `/guardian/sos` · 가족 연락처 `/guardian/wards` | `/guardian/sos` | `WARD_SOS:{sosEventId}` · O, requireInteraction |
| ANOMALY_DETECTED | 이상감지(`--sb-warn`) | detectedType: 불꽃·낙상·흉기 / 그 밖 눈 | 영상 확인 `/guardian/detection` · 실시간 보기 `?session=` | 보호자 `/guardian/detection?session=` · 피보호자 `/ward` | `…:{incidentId}` · O |
| ANOMALY_REVIEW_REQUIRED·SUMMARY·CONFLICTED, CAMERA_LINK_LOST | 이상감지 | 눈 | - | `/guardian/detection` | `…:{incidentId·summaryDate·wardId}` |
| MEDICATION_REMINDER | 복약(`--sb-safe`) | 알약 | - | `/ward/medication` | `…:{medicationId}` |
| MEDICATION_MISSED·STOPPED | 복약 | 알약 | - | `/guardian/medication` | `…:{wardId}-{doseDate}` |
| CONNECTION_REQUEST | 가족 연결(`--sb-brand`) | 사람 | (토스트: 수락·거절) | `/ward/guardians` | `…:{connectionId}` |
| CONNECTION_ACCEPTED·REFUSED | 가족 연결 | 사람 | - | `/guardian/wards` | 같음 |
| CONNECTION_FORCED·CANCELLED·DISCONNECTED | 가족 연결 | 사람 | - | 역할별 `/guardian/wards`·`/ward/guardians` | 같음 |
| INQUIRY_ANSWERED · 그 밖 | 알림(`--sb-brand`) | 다리 로고 | - | `/guardian/inquiries` · 역할 홈 | `{type}:{id}` |

- 제목·본문: `data.title`·`data.body` → `notification` → FE 예비 문구. 본문 줄바꿈(`\n`)은 그대로 둔다.
- **역할 판단(서비스 워커)**: `cookieStore`의 access token에서 `role`만 읽음(Chrome·안드로이드) → 열린 탭 경로 → 모름(보호자 경로로 열고
  피보호자면 `RoleRouteGuard`가 역할 홈으로 보냄). 이상감지는 보호자·피보호자 본인이 같은 data(`ANOMALY_DETECTED`)를 받아 이 판단이 필요하다.
  iOS에서 탭이 하나도 없으면 역할을 몰라 피보호자에게 이상감지 버튼이 보일 수 있다(수용).

## 3. 앱 안 토스트

흰 카드 + 1px `--sb-line-soft` + 14px 모서리 + `--sb-shadow-md`(왼쪽 색 띠 없음). 맨 윗줄(다리 표시·종류 이름·받은 시각·닫기),
40px 종류 아이콘 + 제목·두 줄 본문, 버튼 줄(주 = 종류색, 보조 = `--sb-brand-50`). SOS만 `--sb-danger-soft` 바탕·빨간 테두리.
복약 미복용은 `missedCount`·`totalCount`가 있을 때만 "N번 중 M번 체크" 칸 막대. PC 오른쪽 아래 360px, 휴대폰(≤520px) 위쪽 꽉 차게·위로 밀어 닫기.
SOS·이상감지는 `role=alert`(assertive), 그 밖은 `status`(polite). 움직임 줄이기 설정을 따른다.

| 375px | 768px | 1280px |
|---|---|---|
| ![](<./(2026-10-30) web-push-toast-375.png>) | ![](<./(2026-10-30) web-push-toast-768.png>) | ![](<./(2026-10-30) web-push-toast-1280.png>) |

## 4. 아이콘 (`public/icons/push/`)

직접 그린 SVG(`scripts/build-push-icons.mjs`) → sharp PNG. 다시 만들 때 `node scripts/build-push-icons.mjs`.

| 파일 | 크기 | 용도 |
|---|---|---|
| `icon-sos`·`icon-fire`·`icon-fall`·`icon-weapon`·`icon-anomaly`·`icon-medication`·`icon-connection`·`icon-default` (.png·.svg) | 192 | 브라우저 알림 icon(PNG)·토스트(SVG) |
| `badge.png` | 96 | 안드로이드 상태 표시줄(투명 + 흰 다리, 단색) |
| `app-192.png`·`app-512.png`, `src/app/apple-icon.png`(180) | - | 홈 화면 앱 아이콘(`src/app/manifest.ts` 새로 추가 - 전에는 manifest가 없었다) |

![](<./(2026-10-30) web-push-icons.png>)

## 5. FCM 토큰 정리

`lib/fcm.ts`는 토큰을 sessionStorage에만 기억해 탭을 닫으면 옛 토큰을 잃었고, 새 토큰이 나와도 지우지 않았다(한 계정에 웹 토큰이 상한까지 쌓임).
마지막 등록 토큰을 localStorage(`careai_fcm_last_token`)에 기억하고, 바뀌면 **새 토큰 등록 뒤** 기존 `DELETE /notifications/fcm-token`으로 옛 토큰을 지운다.
서버는 내 토큰만 지우므로 다른 사용자 토큰이면 아무 일도 없다. 실패해도 등록은 유지, 로그아웃 때 기억도 지운다.

## 6. 기기 확인

방법: 로컬 Chrome(playwright, 헤드리스·알림 허용)으로 시험 피보호자 로그인 → 토큰 등록 확인 → **탭을 모두 닫음** →
시험 보호자가 연결 요청 1건(SOS 아님) → 25초 뒤 서비스 워커의 `getNotifications()` 개수 → 요청 취소(무알림).

| 시점 | 결과 |
|---|---|
| 배포 전(develop 80e9683, BE notification 블록 있음) | **2개** - 라이브러리(`FCM_MSG`) 1 + 서비스 워커 1, 둘 다 icon·badge 없음 → 원인 재현 |
| 배포 후(develop 66dcf7c, #182, BE notification 블록 그대로) | **1개** - 라이브러리 표시만, 5초 안에 도착. 서비스 워커는 그리지 않음(전환 기간 방어 동작) |
| 서비스 워커 안 합성 PushEvent(새 SW) | notification 블록 있음 → 1개(라이브러리) / data만 → 1개(SW): `icon-connection.png`·`badge.png`·tag `CONNECTION_REQUEST:1`·두 줄 본문 |

- 배포 후 첫 두 번은 25초 뒤 페이지를 열어 셌을 때 0개였다(FCM은 DELIVERED). SW 안에서 5초마다 세는 방식으로 바꾼 세 번째에 1개가 잡혀,
  헤드리스 푸시 도착 지연·측정 방식 문제로 본다(원인 확정은 못 함).
- 클릭 이동은 합성 클릭으로 확인할 수 없다(사용자 동작이 없어 `openWindow`·`focus`가 거부됨). SW 범위가 `/`라 열린 탭은 `navigate()`가
  된다는 것만 확인했다. 그 과정에서 `focus()`를 기다리다 거부되면 이동을 건너뛰는 회귀를 찾아 고쳤다(#184).
- 시험 연결 요청(693~698)은 모두 보호자 취소로 정리했다(무알림).
- 남은 사람 확인: PC Chrome 실제 클릭 이동, 안드로이드 Chrome 실기기, iOS 홈 화면 아이콘, BE data 전용을 켠 뒤의 새 아이콘·배지·버튼.
