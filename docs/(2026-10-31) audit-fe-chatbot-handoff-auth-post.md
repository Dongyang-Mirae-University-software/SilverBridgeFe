# 챗봇 예약 칩 피보호자 이어받기(#199)·인증 폼 POST(#201) 기능 점검

- 점검일: 2026-10-31 / 기준: develop `b38145d`(#201 머지) = gosky dev 반영 커밋
- 방법: 두 PR diff 검토 + 사용처 grep + 브라우저 테스트로 재현(필요한 곳만 임시 측정 후 원복) + 로컬 `next start`·gosky dev(`devdmu.gosky.kr`) 실측

## 결과 요약

| 항목 | 판정 | 근거 |
|---|---|---|
| 저장소에 피보호자 ID 외 값이 담기지 않음 | PASS | 저장하는 곳은 `ChatbotContent.tsx`의 `saveReservationWardId(selectedWard.partnerUserId)` 하나 |
| 상담 문장이 저장소·로그에 남지 않음 | PASS | 칩 문장은 화면 상태(`setMessages`)에만 둠 |
| 다른 사람의 ID를 넣는 경우 | PASS | 화면은 ACTIVE 목록 검사. 서버 BFF(`api/reservation/[...path]/route.ts` `getWardProfile`)가 보호자 토큰으로 ACTIVE 연결을 다시 조회 |
| 칩 연속 클릭·피보호자 0·1명·피보호자용 화면에 칩 없음 | PASS | 타이머 중복 방지, 피보호자 없으면 저장 안 함, 기존 테스트 |
| 2×2 버튼 0~4개 · 768/1024/1025px | PASS | 브라우저 테스트 + 실화면 |
| (auth) 밖 자격 입력 폼 | PASS | 탈퇴 확인·인증번호 입력은 `<form>`이 없거나 `name`이 없어 제출 경로 없음 |
| 인증 폼 안 `type` 없는 버튼 | PASS | 0건 |
| 하이드레이션 전 POST | PASS | urlencoded 일반 폼이라 서버 액션으로 처리되지 않음. `next start`·`next dev` 모두 200, 값은 본문에만 |

이슈: 🔴 0 · 🟠 0 · 🟡 1 · 🟢 2 → **전부 반영**

## 이슈와 조치

- **🟡 M-1 이어받기 때 첫 번째 피보호자가 잠깐 그려지고 그 사람 예약을 한 번 더 부름**: 피보호자 목록이 캐시에 있으면 첫 렌더가 첫 번째 피보호자였고, 예약 조회가 `["ward01","ward02"]` 순서로 나갔다(BFF → 예약 서비스). 데이터가 섞이거나 노출되지는 않는다(조회 키가 피보호자별로 다름).
  → **조치**: 저장소 확인이 끝날 때까지 기존 로딩 문구("피보호자 정보를 불러오는 중이에요.")를 보여 주고 예약 조회를 미룸(`handoffChecked`). 테스트가 조회 순서 `['ward02']`를 고정한다. 수정 전 코드에서는 이 테스트 2건이 실패한다.
- **🟢 L-1 계정 찾기·비밀번호 재설정 흐름에 브라우저 테스트 없음** → `src/app/(auth)/authFormsSubmit.browser.test.tsx`: 이메일 찾기·비밀번호 찾기(이메일·SMS)·새 비밀번호 폼이 POST이고 제출하면 이동 없이 API를 부르는지. 회원가입 폼은 의존성이 많아 정적 테스트(`formMethodPost.test.ts`)로만 막는다.
- **🟢 L-2 글자 크게 설정에서 두 칸 폭 미검증** → `--ward-font-scale` 1.647(28px 최대)에서 768px 2×2 마지막 버튼 두 칸 폭·가로 넘침 없음 테스트.

## 함께 반영한 형식 정리

- prettier: 이번 작업에서 다룬 6개 파일만 적용. 줄바꿈과 의미가 같은 괄호만 바뀜(공백 제거 비교로 확인). 저장소 전체 158개 파일은 범위 밖(관리자 화면 포함, 다른 세션과 충돌 우려).
- eslint 경고 6 → 1: 쓰지 않는 `phone` 구조 분해 제거, `<img>` 4곳은 이유를 적고 규칙 예외(MJPEG 실시간 영상·BFF 클립 썸네일·카카오 프로필). `useSignupForm` `watch()`의 React Compiler 경고는 `useWatch` 전환이 가입 폼 동작 변경이라 그대로 둠.

## 검증

vitest 444 · 브라우저 332 · tsc · eslint(오류 0, 경고 1) · next build 통과.
