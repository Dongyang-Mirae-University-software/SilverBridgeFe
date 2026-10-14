# 피보호자 '내 카메라' 화면 단순화 기능 점검 (PR #38, 2026-10-14)

대상: `feature/ward-camera-simplify` (8a824e8, PR #38). 점검 시점에는 코드를 바꾸지 않았고, 지적 사항은 같은 PR(2a7b2c8)에서 모두 수정했다. 아래 처리 결과 참고.
방법: 코드 읽기 + tsc·vitest·build 결과 확인. 실기기·브라우저 수동 시나리오는 범위 밖이다.

## 환경
- tsc 오류 0, `npm test` 16건 통과, build 성공 (PR 시점 기준, 점검 시 tsc·test 재실행 동일).
- PR #38 OPEN, base develop. 이후 develop에 문서 PR 2건(#39 등)만 추가돼 카메라 파일과 겹치지 않음.
- "다시 켜기" 문구는 `src`에서 더 이상 나오지 않음.

## 호출 경로
| 진입 | 경로 |
|---|---|
| 페이지 "카메라 켜기" | `WardCameraContent.handlePrimary` → `ref.turnOn()` → `turnOnCamera` → `openMedia` → `restartExistingCamera` → `startStreaming` |
| 모달 "카메라 켜기"(기존 카메라) | `handleTurnOn` → `turnOnCamera` (같은 경로) |
| 모달 "촬영 다시 시작" | `handleRegister` → `restartExistingCamera` |
| 신규 등록 | `handleRegister` → `registerMutation` → `startStreaming` |
`startStreaming`(상태 즉시 갱신 포함)은 위 네 경로 모두가 사용한다.

## 상태별 주 버튼
| 상태 | 기대 | 코드 | 판정 |
|---|---|---|---|
| 이 기기 카메라 없음 | 등록 | `register` | PASS |
| running | 카메라 화면 보기 | `view` | PASS |
| disconnected / offline | 카메라 켜기 | `turnOn` | PASS |
| null | 비활성 | `checking`, disabled | PASS |
| 다른 기기 카드 | 보기 버튼 없음·안내 | 카드에 안내만 | PASS |

## 이슈
### 🟠 H-1 카메라 켜기 중 중복 트리거 시 MediaStream 누수 - ✅ 수정 완료
`turnOnCamera`는 권한 프롬프트(`getUserMedia`)를 기다리는 동안 `isStartingStream`이 false라, 모달의 "카메라 켜기"를 다시 누르면 `openMedia`가 한 번 더 실행된다. 앞 스트림의 참조(`mediaStreamRef`)가 덮어써져 트랙이 정리되지 않는다(카메라 표시등이 계속 켜짐). 페이지 버튼은 `isTurningOn`으로 막혀 있지만 모달 버튼은 막혀 있지 않다. `handleStartMedia`(미리보기 시작)에도 있던 패턴이 이번 흐름에서 더 쉽게 밟힌다.
- 제안: `turnOnCamera` 시작에서 `isStartingStream`을 true로 올리거나 ref 잠금을 두고 `finally`에서 해제. `openMedia`가 이미 스트림이 있으면 먼저 정리.

### 🟡 M-1 신규 등록 직후 화면 구성이 갑자기 바뀜 - ✅ 수정 완료
등록 성공 → 상태 즉시 갱신으로 `myCamera`가 생기면 `initialRoom`이 채워져 `isExisting`이 true가 된다. 송출 중인 모달에서 1·2번 섹션이 사라지고 전송 화면이 접힌다(방금 확인하던 화면이 사라짐). 의도(등록 후 단순화)로 볼 수도 있으나, 등록 직후 확인 시간이 없다.
- 제안: 등록 흐름으로 시작한 세션은 `isExisting` 전환을 송출을 끌 때까지 유지(진입 시점 값 고정).

### 🟡 M-2 카메라 끄기 후 상태 갱신 지연 - ✅ 수정 완료
상태 즉시 갱신은 켜기에만 있다. "카메라 끄기" 후 페이지는 폴링(최대 15초)까지 "카메라 화면 보기"를 보여줄 수 있다.
- 제안: `handleStopMedia`에서도 `wardLiveCamerasQueryKey`를 invalidate.

### 🟡 M-3 이미 송출 중일 때 "카메라 켜기"가 조용히 무반응 - ✅ 수정 완료
서버 상태가 아직 disconnected인데 로컬은 streaming이면(켠 직후 프레임이 닿기 전·불안정) `turnOnCamera`가 null을 돌려주고 아무 안내가 없다.
- 제안: 이미 켜져 있으면 모달을 열어 보여 주거나 "이미 송출 중이에요" 안내.

### 🟢 L-1 접힌 전송 화면의 접근성 - ✅ 수정 완료
접힌 영역은 시각적으로만 숨겨져 스크린리더가 "AI에 전송되는 화면"을 읽는다. 토글 버튼에 `aria-expanded` 없음.
- 제안: 접힐 때 `aria-hidden`, 버튼에 `aria-expanded`.

### 🟢 L-2 "화면 보기" 라벨과 모달 내용 불일치 - ✅ 수정 완료
서버는 running이지만 이 탭이 송출하지 않는 경우(새로고침 직후 등) "카메라 화면 보기"를 눌러도 보여줄 화면이 없고 "카메라 켜기"만 있다.

### 🟢 L-3 테스트 범위 - ✅ 수정 완료(순수 함수 한정)
순수 함수 `getCameraPrimaryAction`만 고정돼 있다. 흐름(중복 트리거, 실패 정리)은 수동 확인 의존.

## 확인된 안전 항목 (PASS)
- 접힘은 `height: 0`(display:none 아님)이라 캔버스 그리기·`toBlob`·Worker·회전에 영향 없음. 캔버스 크기는 속성값이라 CSS와 무관.
- 켜기 실패 시 `handleStopMedia`로 미디어·세션 정리, 권한 거부는 고정 문구.
- 등록 409(`CAMERA_LABEL_DUPLICATED`)는 기존 처리 유지, 그 외 코드(`CAMERA_LIMIT_REACHED` 포함)는 `error.message` 그대로 표시.
- FE-1의 429 대기·불안정 안내와 충돌 없음(업로드 경로 미변경).

## 종합
Critical 없음. H-1 / M-1~M-3 / L-1~3 모두 같은 PR에서 수정했다(2a7b2c8).

## 처리 결과 (2026-10-14)
| 이슈 | 수정 | 위치 |
|---|---|---|
| H-1 | `startingRef` 잠금, `openMedia`가 이전 스트림 트랙을 먼저 정리, 시작 중 모달 버튼 비활성 | `CameraRegisterModal.tsx` |
| M-1 | 새로 등록해 송출한 세션은 끌 때까지 등록 화면 유지(`isNewSession`) | 〃 |
| M-2 | `handleStopMedia`에서 상태 조회 즉시 갱신 | 〃 |
| M-3 | 이미 송출 중이면 `ALREADY_STREAMING`을 돌려주고 페이지가 모달을 연다 | `cameraAction.ts`, `WardCameraContent.tsx` |
| L-1 | 접힌 영역 `aria-hidden`, 토글 `aria-expanded` | `CameraRegisterModal.tsx` |
| L-2 | 모달 제목을 이 탭의 송출 상태 기준으로(`getModalTitle`), 송출 안 할 때 안내 | 〃 |
| L-3 | `getModalTitle` 등 순수 함수 테스트 (흐름 자체는 수동 확인) | `cameraAction.test.ts` |

## 배포 후 발견·반영 (같은 날)
- 페이지의 "카메라 켜기"가 항상 전면 카메라로 시작하고 송출 중 방식 표시도 없던 문제 -> PR #41: 마지막 촬영 방식을 localStorage에 저장, 송출 중에도 선택 표시 유지, 변경 안내.
- 카드 형식 정리 -> PR #42: 주 버튼을 이 기기 카드 안으로, "연결하는 중..." 배지 추가, 다른 기기 카드는 안내만(영상 시청은 보호자 전용 정책).
- 두 PR 모두 gosky에 반영(5305687). 기기 수동 시나리오는 사용자가 확인 중.
