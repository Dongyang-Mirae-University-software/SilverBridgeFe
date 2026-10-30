# 보호자 병원 예약 - Claude 디자인(2026-10-30) 반영

- 화면: `src/app/(guardian)/guardian/hospital` (보호자가 연결된 피보호자 대신 예약)
- 디자인 원본: Claude Design `SilverBridge-app.html`의 `GuardianHospital()` (10/30 수정본). 이전 `design_handoff_hospital_booking/README.md`는 이 수정본보다 오래돼 기준으로 쓰지 않았다.
- 기준 API: 예약 서비스(SilverBridgeReservation) - FE BFF `/api/reservation/**` 경유. BFF·예약 서비스는 바꾸지 않았다.

## 디자인 대조표

| 화면 | 디자인 | 반영 | 비고 |
|---|---|---|---|
| 목록 상단 | 큰 갈색 [새 진료 예약하기] + "예약 현황 n건" | 반영 | n = 진행 중(BOOKED·CONFIRMED) 예약 수 |
| 다음 진료 | 왼쪽 남은 날 판(오늘·내일·n일 뒤) + 오른쪽 일시·병원·[예약 취소] | 반영 | 600px 이하에서 위아래로 쌓임 |
| 그 밖의 예약 | 남은 날 칩 + 일시 + 병원 + [예약 취소] | 반영 | |
| 취소 확인 | 모달 [그대로 두기]/[예약 취소] | 반영 | Esc·바깥 누르기로 닫힘, 포커스는 [그대로 두기] → 닫으면 누른 버튼으로 |
| 지난 진료 | "다시 예약 ›" 카드 격자 | 반영 | 다시 예약할 수 없는 병원(목록에 없음·지금 진료 안 함·진료과 없음)은 누를 수 없는 카드 |
| 병원 찾기 | 병원당 한 줄 + 진료과 목록(넷 이상은 "외 N개") + 주소 | 반영 | 접수 중단 병원은 목록에서 빠지고, 진료 중이 아닌 병원은 흐리게 "지금은 예약을 받지 않아요" |
| 진료과 | 진료과가 둘 이상이면 날짜 위에 진료과 칸 | 반영 | 진료과를 고르기 전엔 시간 칸을 묻지 않는다(시간 칸이 진료과별) |
| 날짜·시간 | 7일, 오전·오후 칸, 마감 | 반영 | 휴진 요일·점심시간·요일별 진료 시간·지난 시각 처리 유지 |
| 확인 | 큰 일시 + 병원 + 주소 + 진료받으실 분 + 연락처 [바꾸기] + "어디가 불편하세요?" | 반영 | 증상은 선택, 200자 |
| 완료 | 초록 원 + 회색 요약 상자 + [확인] | 반영 | |

## API 대응표

| 화면 요소 | API·필드 | 예약 서비스 |
|---|---|---|
| 병원 목록·진료과·주소·운영 상태·접수 여부 | `GET /hospitals` (`departments`·`address`·`operationStatus`·`bookingAvailable`) | 있음 |
| 빈 시간(진료과별) | `GET /hospitals/:id/available-slots?date=&department=` | 있음 |
| 점심·휴진·요일별 진료 시간 | `breakStart/End`·`closedWeekdays`·`weekdayHours` | 있음 |
| 예약 생성 | `POST /reservations` | 있음 - **`symptomSummary`를 새로 보냄**(입력했을 때만) |
| 예약 현황·지난 진료 | `GET /reservations/my` | 있음 |
| 취소 | `PATCH /reservations/:id/cancel` | 있음(DELETE로 바꾸지 않음) |
| 지난 진료 상태 | `status` = `BOOKED·CONFIRMED·COMPLETED·CANCELED·NO_SHOW·REJECTED` | FE 타입에 `NO_SHOW`·`REJECTED`(운영 상태 `INSPECTION`) 추가 |
| 중복 예약 | 400 `DUPLICATE_RESERVATION`(같은 사람·같은 날짜·같은 시각, 병원 무관) | "{이름} 님은 이 시간에 이미 예약이 있어요…"로 안내 |
| 예약 상세 화면 | `GET /reservations/:id` | 디자인에 없어 만들지 않음(BFF도 막혀 있음) |
| 사진·평점·거리·의사·결제·날짜 변경 | - | 디자인에도 없음 |

## 결정 (사용자, 2026-10-30)

1. 증상 입력은 `symptomSummary`로 보낸다(`memo` 아님). 콘솔·로그에 남기지 않는다.
2. 취소 모달의 "김영희에게도 취소 소식을 알려 드려요"는 사실이 아니라(취소해도 피보호자 알림 없음) "{이름} 님 화면에서도 취소된 것으로 보여요"로 바꿨다.
3. 지난 진료에 작은 상태 표시를 둔다: 취소됨·병원이 거절함·방문하지 않음(진료 완료는 표시 없음).

## 디자인과 다르게 둔 것

- **피보호자 선택 칸 유지**: 디자인은 "김영희" 고정이지만 보호자에게 피보호자가 여럿이면 고를 수 있어야 한다.
- **완료 화면의 진료과·"{이름} 화면에서도 볼 수 있어요"**: 디자인은 병원 이름만 있지만 진료과와 안내 줄을 남겼다.
- **틀린 번호 칸 색**: 디자인은 `--danger`(빨강)이지만 빨간색은 SOS·이상감지 전용이라 기존처럼 갈색 계열(`--sb-warn`).
- **지난 진료 쪽 크기**: 카드 격자에 맞춰 한 쪽 5건 → 6건.
- **확인 화면 번호 표시**: 계정 번호가 줄표 없이 저장돼 있으면 줄표를 넣어 보인다(보내는 값은 그대로) - 실측에서 발견.

## 변경 파일

| 파일 | 내용 |
|---|---|
| `GuardianHospitalContent.tsx` | 상태·요청·머리줄·진행 막대·완료만 남기고 단계는 하위 컴포넌트로 |
| `HospitalListStep.tsx` (신규) | 목록·예약 현황·취소 확인 창·지난 진료 카드 |
| `HospitalSearchStep.tsx` (신규) | 병원 찾기 |
| `HospitalDateTimeStep.tsx` (신규) | 진료과·날짜·시간 |
| `HospitalConfirmStep.tsx` (신규) | 확인(연락처 [바꾸기]·증상) |
| `hospitalBooking.ts` (신규) | 이 화면 전용 도우미(병원 검색·진료과 요약·남은 날·상태 표시·번호 줄표·중복 안내) |
| `hospitalIcons.tsx` (신규) | 아이콘 |
| `GuardianHospitalContent.module.css` | 디자인 수치 반영, 600px 기준 추가 |
| `GuardianHospitalContent.browser.test.tsx` | 22건 갱신 + 7건 추가(29건) |
| `src/service/interface/reservation.ts` | **공용 타입** - enum 값 보강(타입만 넓힘, 피보호자 화면 동작 변화 없음) |

공용 예약 코드(`components/reservation/*`·`utils/reservation/*`·`service/*/reservation`)·BFF·전역 스타일·`PageLayout`은 바꾸지 않았다.

## 검증

- lint 오류 0(경고 6, 기준선과 같음) / 단위 테스트 343건 / 브라우저 테스트 전체 통과(병원 화면 29건) / `next build` 통과
- gosky에 임시 미리보기(제 브랜치)를 띄워 **실제 예약 서비스**로 확인(시험 보호자, 피보호자 2명):
  - 병원 5곳·진료과 목록·검색 / 진료과 선택 / 휴진 1일·마감 칸 2개 / 예약 생성 201 / 같은 날짜·시각 다른 진료과 재시도 → 400 `DUPLICATE_RESERVATION`과 안내 문구 / 다음 진료 "내일"·"예약 현황 1건" / 모달 취소 `PATCH` 200 → 지난 진료 "취소됨"
  - 시험 예약 2건은 모두 취소했다(예약 현황 0건 확인).
  - 375·768·1280px 모든 단계 가로 넘침 0.

## 스크린샷

`(2026-10-30) guardian-hospital-` + `list-{1280,768,375}` · `search-768` · `datetime-375` · `confirm-375` · `duplicate-1280` · `cancel-dialog-375` · `done-375` (.png)
