# 연결된 가족·내 가족 Claude 디자인 반영 (2026-10-30)

## 시안

- Claude Design 프로젝트: https://claude.ai/design/p/70278963-88a1-44fa-8f33-f9952668d983?file=SilverBridge-app.html
- 보호자 "연결된 가족" = `WardListPage`(라우트 `wardlist`), 피보호자 "내 가족" = `WardGuardianList`(라우트 `myguardian`)
- 같은 파일의 `WardGuardianListSimple`·`GuardianListPage`는 라우팅되지 않는 옛 후보라 기준에서 뺐다.
- 시안의 피보호자 "동의 창"(약·병원·기분 / 카메라 체크)은 정의만 있고 어떤 버튼에도 연결돼 있지 않아 구현하지 않았다.

## 차이와 반영

### 보호자 - 연결된 가족

| 영역 | 이전 (v13, eb8f570) | 시안·반영 |
|---|---|---|
| 머리말 | "연결된 가족" | 옆에 연결된(ACTIVE) 인원 "N명" - 불러오는 중·오류일 때는 숨김 |
| 카드 보조 정보 | "만 N세 · 여성" | "만 N세"만 (성별은 연결 데이터에만 남김) |
| 연결 해제 | 카드 머리 오른쪽 | 카드 아래 오른쪽 밑줄 버튼 |
| 연락처 | 전화 일반 굵기, "(우편번호) 주소 상세" | 전화 굵게(18px), "주소, 상세주소" |
| 수락 대기 요청 | 목록 아래 별도 칸 | 같은 그리드 안 점선 카드("수락을 기다리는 중" 배지·요청 취소) |
| 가족 등록 | 사이드바에만 | 그리드 끝 점선 "가족 등록" 타일(`/guardian/wards/register`) |
| 그리드 | 2칸 고정 | `auto-fill, minmax(min(100%, 300px), 1fr)` (최대 폭 1000px 유지) |
| 해제 확인 창 | 경고 아이콘 + 작은 버튼 | 아이콘 없음, 400px·제목 20px·버튼 50px 두 칸 |
| 빈 상태 | 문구 | 문구 유지 + 등록 타일(시안에는 문구 없음 - 처음 쓰는 사람 안내용으로 유지) |
| 불러오는 중·오류 | 문구 | 시안에 없어 그대로 |

- 등록 화면(`/guardian/wards/register`)의 "수락을 기다리는 중" 섹션은 시안에 해당 모양이 없어 그대로 두었다. 조회·취소 로직은 `useGuardianPendingRequests` 훅으로 나눠 두 화면이 같이 쓴다(쿼리 키·뮤테이션은 같다).

### 피보호자 - 내 가족

| 영역 | 이전 (1040c7c 폭 확장 포함) | 시안·반영 |
|---|---|---|
| 받은 요청 카드 | 시안과 같음 | 보호자 사진이 항상 이니셜로 나오던 것 수정(아래) |
| 보호자 카드 | 시안과 같음 | 그대로 |
| 빈 상태 | "아직 연결된 보호자가 없어요" | "아직 연결된 가족이 없어요" |
| 해제 확인 창 | 시안과 같음 | 그대로 - "끊으면 SOS를 눌러도 이 분께 알림이 가지 않아요" 유지 |

- 이름 뒤 "님"은 두 화면 모두 유지했다(시안은 "님" 없음). 앱 전체 존칭과 맞추기 위한 결정이다.

## 필드 매핑

| 시안 표시 | API 필드 |
|---|---|
| 이름·사진 | `partnerName`·`partnerProfileImage` (피보호자 받은 요청: `guardianName`·`guardianProfileImage`) |
| 만 N세 | `partnerBirthDate` (ACTIVE만) |
| 전화·주소 | `partnerPhone`·`partnerAddress`·`partnerAddressDetail` (BE가 ACTIVE에서만 내려줌) |
| 관계 | `relation` - 보호자가 피보호자에게 누구인지. 피보호자 화면 "박민수 님 (아들)", 보호자 대기 카드 "아들로 요청" |
| 요청일 | `createdAt` / `requestedAt` |
| N명 | ACTIVE 연결 수 |

- **받은 요청 사진 누락 수정**: BE `PendingConnectionResponse`는 `guardianProfileImage`를 내려주는데 FE 타입 `IWardPendingConnectionRequest`에 필드가 없고 `mapWardPendingRequestToConnection`이 `partnerProfileImage: null`로 고정해 두었다. 타입에 필드를 추가하고 매핑을 고쳤다(`connection.test.ts`로 고정).

## BE 필요 목록

- 없음. 시안의 표시 값은 모두 현재 API로 채운다.

## 바뀌지 않는 것

- API 호출·쿼리 키·뮤테이션(해제·요청 취소·수락·거절), WS 갱신(`connectionSocket`·`pendingConnectionRequests`)
- 해제 확인 창의 `useModalDialog`(포커스 가두기·Esc·포커스 복귀), `role="dialog"`·`aria-labelledby`
- 목록 aria-label("연결된 가족"·"받은 연결 요청"·"연결된 보호자"), 피보호자 화면 글자·버튼 크기
- 수락 전 요청 카드에는 연락처를 넣지 않는다.

## 스크린샷 (목 데이터, 실제 Chrome)

| | 데스크톱 1280 | 모바일 360 |
|---|---|---|
| 보호자 | ![](./(2026-10-30)%20family-guardian-1280.png) | ![](./(2026-10-30)%20family-guardian-360.png) |
| 피보호자 | ![](./(2026-10-30)%20family-ward-1280.png) | ![](./(2026-10-30)%20family-ward-360.png) |

## 테스트·검증

- `tsc --noEmit` 통과, `next build` 통과
- 두 화면 브라우저 테스트: 보호자 20건(추가 6: 불러오는 중·빈 상태+등록 타일·사진/연락처 없음·그리드 대기 카드·취소 실패 409·인원수), 피보호자 9건(추가 3: 불러오는 중·받은 요청 사진 유무·전화 없음) 모두 통과
- 단위 `vitest run`: 337건 통과, 새 `src/service/api/ward/connection.test.ts` 2건 포함
- 기존 결함(이번 변경과 무관, `origin/develop`에서도 같음): `src/service/api/admin/user.test.ts` 모듈 목 hoisting 실패, `eslint`의 `BirthDateSelects.tsx` 오류 1건, 브라우저 `WardGuardianCallSection`·`WardGameContent`·`GuardianHospitalContent` 각 1건
