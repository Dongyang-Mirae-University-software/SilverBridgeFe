# 피보호자 SOS·119 키패드 기능 점검 (PR #287, 2026-11-19)

대상: PR #287 (머지 `0fc0863`) - ① SOS 확인 창 제거(누르면 바로 전송, 연타는 ref 잠금) ② 119 키패드를 아이폰 전화 앱 키패드 모양으로.
방법: 코드 읽기 + 임시 측정 테스트(실제 Chrome, 커밋 안 함) + gosky 실화면(devdmu.gosky.kr, 390px, 시험 계정). 점검 중 코드는 바꾸지 않았다.

## 환경
- develop·gosky FE dev 모두 `0fc0863`. lint 오류 0(경고 23은 기존), tsc 0, 단위 724, 브라우저 743, `next build` 성공(#287 머지 직전 같은 트리).

## 점검 범위
| 파일 | 역할 |
|---|---|
| `src/app/(ward)/ward/sos/_components/WardSosContent.tsx` | SOS 전송 흐름(확인 창 제거·`sendingLockRef`) |
| `src/components/emergency/Emergency119Dialpad.tsx`·`.module.css` | 키패드(모양 변경) |
| `src/components/chatbot/ChatbotContent.tsx` `openEmergencyDialpad` | 키패드 두 번째 사용처(`onCall`=`CHATBOT_119`, `successNotice`, 109 `footer`) - 무변경 |

키패드 사용처는 이 두 곳뿐이다(`grep Emergency119Dialpad`).

## 흐름 표 (SOS 버튼)
| sosAction | 보호자 목록 | 동작 | 실패 시 |
|---|---|---|---|
| `CALL_119_AND_NOTIFY`(기본) | 있음 | 키패드 즉시 + 전송 (`WardSosContent.tsx:110`) | 키패드 위 실패 창 |
| `NOTIFY_GUARDIAN_FIRST` | 있음 | 전송 → "보호자에게 알렸어요" 창 | 실패 창([119 화면 열기]·[다시 보내기]) |
| 무관 | 없음(로딩 끝) | 키패드 즉시 + 전송(이력만) | 안내 없음(알릴 사람 없음) |
| 무관 | **조회 실패** | 위 "없음"과 같은 경로 | **안내 없음 - H-1** |
| 무관 | 로딩 중 | 설정대로 | 설정대로 |
| 오프라인 | 있음 | 전송하지 않고 바로 실패 창 | - |

(`CALL_119`는 2026-10-07에 없어진 값이라 2종이다.)

## A. 안전·보안 - PASS
- 실제 발신 경로 없음: 키패드·챗봇 소스에 `tel:`·`sms:`·`intent:`·이동·링크 없음(guard 테스트 2종). `WardGuardianCallSection`의 `tel:`은 보호자에게 거는 의도된 실제 전화로 범위 밖.
- SOS 중복 전송: hero 연타(같은 작업 안 두 번 클릭)도 1건 - ref 잠금을 빼면 테스트 3건 실패하는 것으로 확인. 실패 창 [다시 보내기]도 같은 잠금을 탄다. 키보드 Enter 반복은 렌더 뒤 `disabled`로 막힌다.
- 보호자 전화(`GUARDIAN_CALL`) 연타는 FE 잠금이 없으나 BE `SosNotificationCooldown`이 알림을 막는다(L-2).
- 로그·콘솔에 토큰·번호 출력 없음.

## B. 기능 정합성
- 레이아웃(임시 측정, 루트 글씨 28px·배율 1.647·굵기 +200 포함): 320×568·375×667·375×812·430×932·812×375 모두 가로 넘침 0, 키 밖으로 나간 글자 0, 상태 문구는 항상 숫자 위. 320×568만 세로 27px 스크롤(통화 버튼은 화면 안).
- 포커스 가둠·Esc·포커스 복귀: 기존 테스트 그대로 통과.

## C. 실서버 (gosky, 390px)
| 확인 | 결과 |
|---|---|
| SOS 1회 | 확인 창 없음, 키패드 즉시, `POST /api/ward/sos` 1건, 보호자 `WARD_SOS` 알림 1건(10:59) |
| 챗봇 119 | 칩 "어지러워요" → AI 되물음 "말이 어눌하거나 팔다리 힘이 빠지세요?"에 "네" → 119 패널("통화 버튼을 누르면 보호자에게 알림이 가요") → 키패드가 SOS와 같은 모양 → 통화 1회 → 보호자 알림 1건(11:16) |
| 키패드 안 글씨 변수 | `--ward-font-scale`·`--ward-weight-boost` **없음** - M-1 |

## 이슈
- 🟠 **H-1 보호자 목록 조회가 실패하면 SOS 실패가 조용히 묻힌다** (#287 이전, 2026-10-23부터): `wardConnectionsQueryOptions`가 `retry: false`라 첫 조회 1회 실패로 `isError`·`activeGuardians=[]` → `hasActiveGuardians=false` → "보호자 없음" 경로(`WardSosContent.tsx:118`)가 전송 실패를 `.catch(() => {})`로 삼킨다. 보호자가 있는데도 실패 안내가 없고, `NOTIFY_GUARDIAN_FIRST`는 알림 결과 창 대신 키패드가 열린다. 수정안: "보호자 없음" 분기를 `!isGuardiansError`일 때만 타게 하고, 조회 실패면 보호자가 있다고 보고 기존 실패 창 흐름으로 보낸다 + 테스트.
- 🟡 **M-1 키패드(와 모든 공용 모달)에 피보호자 글씨 배율·고대비 굵기가 적용되지 않는다** (기존): 변수는 `WardLayout`의 화면 영역 div(`WardLayout.tsx:61`)에만 있고 모달은 루트 `ModalHost`(`app/layout.tsx:53`)에 그려진다. 루트 글씨 크기(rem)만 반영된다. 수정안: `WardLayout`이 이미 루트 `fontSize`를 바꾸는 effect에서 두 변수도 `documentElement`에 설정·해제 + 테스트.
- 🟢 L-1 테스트 빈칸: `CALL_119_AND_NOTIFY` + 오프라인(키패드 위 실패 창), 보호자 목록 조회 실패(H-1).
- 🟢 L-2 `GUARDIAN_CALL` 연타는 FE에서 막지 않는다 - BE 쿨다운이 알림은 막으나 SOS 이력은 여러 건 남을 수 있다.

## 종합 판정
**#287 변경 자체는 PASS.** 점검 중 기존 결함 H-1(안전 기능)·M-1(접근성)을 찾았다 - 별도 수정 작업으로 진행 권장.

수정 커밋 메시지 초안
- `fix: 보호자 목록 조회 실패 시 SOS 실패 안내가 사라지던 문제 - 보호자 없음 분기에서 조회 실패 제외`
- `fix: 피보호자 글씨 배율·고대비를 루트에도 적용 - 119 키패드 등 공용 모달에 반영`

## 조치 (2026-11-19, 같은 날)
| 항목 | 조치 | PR |
|---|---|---|
| H-1 | 조회 실패는 "보호자 없음"으로 보지 않고 설정대로 진행·실패 시 실패 창(수정을 빼면 실패하는 테스트 3건) | #288 |
| M-1 | `useWardRootTextSettings`가 루트에 글씨 배율·진한 글자 변수를 두고 언마운트 때 지움 - gosky에서 루트 변수 확인 | #288 |
| L-1 | 기본 설정 + 오프라인 테스트 추가(조회 실패 테스트는 H-1과 함께) | #288 |
| L-2 | 그대로(BE 쿨다운이 알림을 막음) | - |

함께 진행: Next.js 보안 업그레이드는 대상 없음 - npm bulk advisory·`npm audit`·GitHub 권고 모두 16.4.6 해당 0건(16.4.6이 latest), `next build`의 SecurityFatalError는 다시 실행하면 통과. eslint 경고 23건 → 0(#289, 규칙 설정 무변경).
