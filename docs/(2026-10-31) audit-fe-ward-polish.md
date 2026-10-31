# 피보호자웹 다듬기 기능 점검 (PR #193·#195 + 공용 코드 사용처)

- 점검일: 2026-10-31 / 기준: develop `f19872f`(#195 머지) = gosky dev 반영 커밋
- 방법: 두 PR diff 검토 + 공용 코드 사용처 grep + gosky dev(`devdmu.gosky.kr`)에 피보호자·보호자·관리자 계정으로 로그인해 375/768/1280 폭 측정(가로 넘침·화면 밖 요소·44px 미만 터치 대상·잘린 글자·dev 오버레이 Issue 수·콘솔 오류)
- 병원 가는 날 예약 1건·여러 건은 실데이터를 만들지 않고 브라우저에서 `/reservation/reservations/my` 응답을 가로채 확인했다.

## 기준선 (PHASE -1)

| 항목 | 결과 |
|---|---|
| lint | 오류 0 · 경고 6 (기존) |
| 단위 테스트 | 430 / 430 통과 |
| 브라우저 테스트 | 303 / 303 통과 |
| build | 성공 |

## 공용 코드 사용처 (PHASE 0)

| 공용 파일 | 바뀐 내용 | 사용처 | 보호자·관리자 영향 |
|---|---|---|---|
| `PageLayout` | 제목 글자 `calc(px * var(--ward-font-scale, 1))`, `hideTitle`(srOnly h1) | 피보호자 7 · 보호자 10 화면 | 없음 - 변수 기본값 1·0, `hideTitle`은 피보호자만 사용 |
| `Sidebar` | 로고 `variant="wardHeader"` | 피보호자·보호자·관리자 레이아웃 | 없음 - `role === 'WARD'`일 때만 |
| `NoticesPage` | `variant="ward"`: 본문 폭 제한 해제, 새로고침 줄 `display: contents` | 피보호자·보호자 공지 | 없음 - 보호자는 `default` |
| 챗봇 CSS | 글자 배율·굵기 변수 | 피보호자·보호자 챗봇 | 없음 - 변수 기본값 |
| `globals.css` `.wardHighContrast` | 보조 글자색을 더 진하게 | 피보호자만(클래스는 WardLayout에서만 붙음) | 없음 |
| `wardSettings.getWardTextVars` | 신규 | WardLayout | - |

## 화면 × 폭 × 글자 설정 PASS/FAIL

판정 기준: 가로 넘침 0 · 화면 밖 요소 0 · 44px 미만 터치 대상 0 · 하이드레이션 Issue 0 · 캡처에서 겹침·단어 중간 줄바꿈 없음.

| 화면 | 보통 375 / 768 / 1280 | 아주 크게(1.47배)+진한 글자 375 / 768 / 1280 | 비고 |
|---|---|---|---|
| 메인 메뉴 | PASS / PASS / PASS | PASS / PASS / PASS | |
| 병원 가는 날 0건 | PASS / PASS / PASS | PASS / PASS / PASS | |
| 병원 가는 날 1건 | PASS / PASS / PASS | PASS / PASS / PASS | 375 큰 카드 하단 702px ≤ 812px(한 화면 유지) |
| 병원 가는 날 여러 건 | PASS / PASS / PASS | PASS / PASS / PASS | 그다음 1장 + 더 보기, 긴 병원 이름 넘침 없음 |
| 챗봇 | PASS / PASS / PASS | **FAIL(🟡)** / PASS / PASS | 375에서 입력칸 안내 "직접 써서 물어"까지만 보임 |
| SOS | PASS / PASS / PASS | PASS / PASS / PASS | |
| 카메라 | PASS / PASS / PASS | **FAIL(🟡)** / PASS / PASS | 등록 버튼 "카메라 / 로 등록" 단어 중간 줄바꿈 |
| 복약 | PASS / PASS / PASS | **FAIL(🟢)** / PASS / PASS | 빈 상태 "없 / 습니다" 단어 중간 줄바꿈 |
| 공지 | PASS / PASS / PASS | PASS / PASS / PASS | 첫 카드 위 빈 칸 없음, 본문 카드 폭 |
| 설정 | PASS / PASS / PASS | **FAIL(🟡)** / PASS / PASS | 글자 크기 선택 "아주 크 / 게" 줄바꿈 |
| 내 가족 | PASS / PASS / PASS | PASS / PASS / PASS | |
| 보호자 공지·병원·복약·설정·SOS·챗봇 | 회귀 없음 | (해당 없음) | 공지 간격 14px·본문 78ch·새로고침 fixed, 제목 30px(모바일)/24px(1280) 그대로 |
| 관리자 대시보드·회원 관리 | 회귀 없음 | (해당 없음) | |

- 하이드레이션: 피보호자·보호자·관리자 주요 화면과 `/login` 모두 dev 오버레이 Issue 0, 콘솔 오류 0. 옛 컴파일 문제 흔적 없음(gosky dev 컨테이너는 점검 직전 재기동돼 있었다).
- 메뉴 연타(서랍 열기 → 항목 이동 8회): 헤더·서랍 로고 모두 102×37로 일정.
- 잘림으로 잡힌 "오늘 먹을 약"·"공지사항"·"병원 가는 날"·"새로고침"은 화면에서 숨긴 스크린리더용 글자(의도)다.

## 이슈

| 등급 | 이슈 | 근거 | 재현 | 고치는 방법 |
|---|---|---|---|---|
| 🟡 | 카메라 해제 확인창이 Esc로 닫히지 않고, 열릴 때 포커스가 확인창으로 가지 않는다 | `src/app/(ward)/ward/camera/_components/RemoveCameraDialog.tsx:22-40` (같은 피보호자 화면의 `Emergency119Dialpad`는 Esc 처리) | 키보드로 "등록 해제" → 포커스가 뒤 화면 버튼에 남고 Tab이 뒤로 빠진다 | 열릴 때 취소 버튼에 포커스, Esc = 취소(해제 중에는 무시) + 브라우저 테스트 |
| 🟡 | 챗봇 "바로 물어보기" 빈 안내 글자가 고정 크기 | `src/components/chatbot/ChatbotContent.module.css:606-607` (20px·700) | 아주 크게·진한 글자에서도 그대로 | `calc(20px * var(--ward-font-scale, 1))`·`calc(700 + var(--ward-weight-boost, 0))` |
| 🟡 | 아주 크게(375)에서 버튼·선택지 글자가 단어 중간에서 줄바꿈 | 카메라 등록 버튼, 설정 글자 크기 선택 "아주 크게" | 설정에서 아주 크게 → 375 폭으로 카메라·설정 화면 | 해당 버튼 글자에 `word-break: keep-all` |
| 🟡 | 아주 크게(375)에서 챗봇 입력칸 안내 문구가 잘림 | `ChatbotContent.tsx:352` "직접 써서 물어보기" | 아주 크게 → 375 챗봇 | 문구를 줄이거나(예: "직접 쓰기") 안내 글자만 배율 상한 - 문구는 사용자 결정 |
| 🟡 | 진한 글자를 켜도 중간 톤 글자색 일부가 그대로 | `CameraRegisterModal.module.css`(#a8741a), `ChatbotContent.module.css`(#a87a00·#4a4a40), `WardCameraList.module.css`(#3f6e8c) | 진한 글자 켜고 해당 화면 | `:global(.wardHighContrast)` 아래 더 진한 값 지정 |
| 🟢 | `wardReadableText` 클래스는 정의된 CSS가 없다 | `src/app/(ward)/ward/_components/WardLayout.tsx:66` | - | 한 줄 삭제(관련 테스트 없음) |
| 🟢 | 복약 빈 상태 "없 / 습니다" 줄바꿈 | `WardMedicationContent` 빈 상태 | 아주 크게 375 | `word-break: keep-all` |
| 🟢 | 지난 진료 제거 뒤 빈 줄 1개 | `WardHospitalContent.tsx` laterList 뒤 | - | 빈 줄 삭제(쿼리·스타일·테스트 잔여는 없음) |
| 🟢 | 공지 새로고침 줄을 `display: contents`로 뺀 `<header>` | `NoticesPage.module.css` `.topBar.wardTopBar` | - | 동작 문제 없음. 일부 브라우저가 `display: contents` 요소의 랜드마크를 버리지만 이 header는 버튼 1개라 영향 미미 - 기록만 |

### 범위 밖 (이번 PR과 무관, 기존 문제)

| 등급 | 이슈 | 근거 | 비고 |
|---|---|---|---|
| 🟠 | 보호자 복약 화면 375에서 내용 카드가 오른쪽으로 잘림 | `GuardianMedicationContent.module.css` `.page`(grid 트랙이 보호자 선택 탭 최소 폭만큼 늘어남), #193 이전과 같은 CSS - 10/29 `c414da4`(보호자 선택 칩 프로필) 이후로 추정 | 별도 수정 PR 제안 |
| - | 관리자 회원 관리 375·768에서 표가 페이지를 가로로 넘침(375에서 661px) | 관리자 화면은 FE 담당자 몫 | FE 전달 문서에만 기록 |
| 🟢 | `WardLayout.module.css .scrim` 미사용 | 10/07 `c2429c3`부터 | 기록만 |

## 테스트 검토 (PHASE D)

| 테스트 | 확인하는 것 | 판단 |
|---|---|---|
| `wardTextSettings.browser.test.tsx` | 계산된 글자 크기·굵기(보통/크게/아주 크게, 진한 글자 +200), 보호자 PageLayout 30px·800 유지, hideTitle 시 h1 크기 ≤1px | 동작 확인 |
| `RemoveCameraDialog.browser.test.tsx` | 설명 문구 없음, 취소·해제 콜백, 해제 중 버튼 비활성 | 동작 확인(키보드 동작은 미검증 - 위 🟡) |
| `WardHospitalContent.browser.test.tsx` | 지난 진료 없음, 오늘/내일, 빈 상태, 320px 넘침 없음, 더 보기, 갱신 실패 유지, 화면 높이 | 동작 확인(글자 1.47배는 미검증 - 이번 실측으로 보완) |
| `NoticesPage.browser.test.tsx` | 피보호자 max-width none·첫 카드 간격 0, 보호자 78ch·간격 14 | 동작 확인 |
| `PushNotificationListener.browser.test.tsx` | 서버 HTML에 알림 영역 존재 + 하이드레이션 오류 콜백 0 | 동작 확인 |
| `wardSettings.test.ts` | 배율·굵기 값, 범위 밖 저장값 clamp | 동작 확인 |

## 이슈 건수

| 🔴 | 🟠 | 🟡 | 🟢 |
|---|---|---|---|
| 0 | 0 (범위 밖 1) | 5 | 4 (범위 밖 1) |

## 수정 반영 (PHASE E, 사용자 승인: 1~6 전부)

| 이슈 | 수정 | 회귀 테스트 |
|---|---|---|
| 카메라 해제 확인창 키보드 | 열리면 취소에 포커스, Esc = 취소(해제 중 무시), Tab·Shift+Tab은 두 버튼 안에서만 | `RemoveCameraDialog.browser.test.tsx` 3건 |
| (추가 발견) 띄어쓰기 없는 긴 방 이름이면 확인창이 화면 밖으로 넘침 | 제목 `overflow-wrap: anywhere`, 바깥 grid 트랙 `minmax(0, 1fr)` | 같은 파일 1건 - 수정 전 오른쪽 끝 421px > 375px로 실패 확인 |
| 챗봇 빈 안내 글자 고정 | `.wardQuickEmpty` 글자 배율·굵기 변수 | gosky 375·아주 크게 캡처 |
| 단어 중간 줄바꿈 | 카메라 등록 버튼 2곳·설정 글자 크기 선택·복약 빈 상태에 `word-break: keep-all` | gosky 375·아주 크게 캡처 |
| 챗봇 입력칸 안내 잘림 | 피보호자 안내 "직접 써서 물어보기" → "직접 쓰기" | `ChatbotContent.browser.test.tsx` placeholder 갱신 |
| 진한 글자 중간 톤 | `:global(.wardHighContrast)` 아래 상태 배지·회전 안내·챗봇 배지·배너 글자색을 더 진하게 | - |
| `wardReadableText`·병원 빈 줄 | 삭제 | - |
| 보호자 복약 375 잘림(범위 밖 🟠) | 별도 PR - `.page`에 `grid-template-columns: minmax(0, 1fr)`. 수정 전에는 375에서 [약 추가]·알림 시각 선택이 화면 밖이었다 | `GuardianMedicationContent.layout.browser.test.tsx` - 수정 전 실패(692px) 확인 |
