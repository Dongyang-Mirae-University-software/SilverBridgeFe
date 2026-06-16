# SilverBridge FE

보호자와 피보호자를 연결하는 AI 케어 플랫폼, **SilverBridge**의 프론트엔드입니다.

## 프로젝트 소개

Next.js App Router 기반으로 구현된 웹 애플리케이션입니다.  
보호자(GUARDIAN)와 피보호자(WARD)의 역할에 따라 화면을 분리해 각자 필요한 기능에 바로 접근할 수 있도록 구성했습니다.

- **피보호자**: 긴급 SOS, 보호자 연결, 실시간 송출, 복약 알림, 치매 예방 게임
- **보호자**: 피보호자 관리, 실시간 이상감지 모니터링, AI 의료 챗봇
- **공통**: 이메일·카카오 로그인, 회원가입, SMS 인증, 마이페이지, 알림 설정
- **실시간**: WebSocket/STOMP 기반 연결 알림·SOS 알림, FCM 푸시 알림

## 기술 스택

| 구분            | 기술                                      |
| --------------- | ----------------------------------------- |
| Framework       | Next.js 16, React 19                      |
| Language        | TypeScript                                |
| Styling         | CSS Modules, classnames                   |
| Server State    | TanStack Query                            |
| API Client      | Axios                                     |
| Realtime        | STOMP WebSocket, Firebase Cloud Messaging |
| Form            | react-hook-form                           |
| Date            | dayjs                                     |
| Package Manager | npm                                       |

## 주요 기능

### 인증

- 이메일 로그인 / 카카오 소셜 로그인
- 회원가입, SMS 인증, 비밀번호 재설정
- Access Token / Refresh Token 재발급
- 마이페이지
- 프로필 수정, 이미지 업로드, 비밀번호 변경, 회원 탈퇴 ![login](/docs/login.png)

### 보호자

- 피보호자 목록 조회, 연결 요청·수락·해제
- 실시간 이상감지 모니터링 (화재·흉기·낙상)
- AI 의료 챗봇 (응급 증상·병원 예약·일반 문의)
- 공지사항 조회, 알림 채널 설정

![chat](/docs/chat.png)

### 피보호자

- 긴급 SOS 전송 및 보호자 직접 전화
- 실시간 화면·카메라 송출
- 복약 알림, 치매 예방 게임
- 공지사항 조회, 알림·보안 설정

![sos](/docs/sos.png)

## 폴더 구조

```text
src
├── app
│   ├── (auth)       # 로그인, 회원가입, 아이디/비밀번호 찾기
│   ├── (guardian)   # 보호자 페이지
│   ├── (ward)       # 피보호자 페이지
│   └── api          # Next.js API proxy route
├── assets           # SVG 아이콘 등 정적 에셋
├── components       # 공용 컴포넌트
├── constants        # 상수
├── lib              # API client, auth, realtime, format 유틸
├── service
│   ├── api          # 서버 API 함수
│   ├── interface    # API 타입
│   └── query        # React Query hooks
└── store            # 클라이언트 상태 관리
```

## 실행 방법

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.local` 또는 `.env.dev`에 필요한 값을 설정합니다.

| 변수                             | 설명                            |
| -------------------------------- | ------------------------------- |
| `NEXT_PUBLIC_API_DOMAIN`         | 백엔드 API 도메인               |
| `NEXT_PUBLIC_KAKAO_CLIENT_ID`    | 카카오 REST API 키              |
| `NEXT_PUBLIC_KAKAO_REDIRECT_URI` | 카카오 OAuth redirect URI       |
| `NEXT_PUBLIC_CHAT_API_MOCK`      | 챗봇 API mock 사용 여부         |
| `ALLOWED_DEV_ORIGINS`            | 개발 서버 외부 접속 허용 origin |

### 3. 개발 서버 실행

```bash
npm run dev
```

기본 개발 서버 주소:

```text
http://localhost:6510
```

### 4. 빌드 / 프로덕션 실행

```bash
npm run build
npm run start
```
