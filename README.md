# To Find Crew 🚀

크루를 찾고 모임을 만들 수 있는 웹 애플리케이션입니다.

## 🎯 프로젝트 개요

- **목적**: 관심사가 비슷한 사람들과 크루를 만들고 모임을 주선할 수 있는 플랫폼
- **주요 기능**: 크루 생성/가입, 모임 관리, 실시간 채팅, 위치 기반 검색
- **기술 스택**: Next.js 15, TypeScript, Tailwind CSS, Supabase

## 🚀 시작하기

### 필수 요구사항

- Node.js 18+
- pnpm

### 설치 및 실행

```bash
# 의존성 설치
pnpm install

# 개발 서버 실행
pnpm dev

# 빌드
pnpm build

# 프로덕션 실행
pnpm start
```

## 🗄️ 데이터베이스 스키마

### 주요 테이블

#### Users (사용자)

- 기본 프로필 정보 (이름, 이메일, 프로필 이미지)
- 소셜 로그인 제공자 (Google, Kakao, Email)
- 자기소개 및 활동 정보

#### Crews (크루)

- 크루명, 설명, 카테고리
- 활동 지역, 최대/현재 멤버 수
- 생성자 정보

#### CrewMembers (크루 멤버)

- 사용자와 크루 간의 관계
- 역할 구분 (OWNER, ADMIN, MEMBER)
- 가입일

#### Meetings (번개)

- 번개 제목, 설명, 장소
- 시작/종료 시간, 참가자 수 제한
- 소속 크루 및 생성자 정보

#### MeetingParticipants (번개 참가자)

- 번개 참가 신청/취소 관리
- 참가 신청일

#### Messages (메시지)

- 크루별 실시간 채팅
- 발신자, 내용, 발송 시간

### 보안 정책 (RLS)

- Row Level Security 활성화
- 사용자별 데이터 접근 권한 관리
- 크루 멤버만 채팅 및 모임 참가 가능

## 🔧 환경 설정

Supabase 프로젝트 생성 후 환경 변수 설정:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 📱 주요 기능

- [ ] 사용자 인증 (Google, Kakao 소셜 로그인)
- [ ] 크루 생성 및 관리
- [ ] 모임 생성 및 참가
- [ ] 실시간 채팅
- [ ] 위치 기반 크루 검색
- [ ] PWA 지원

## 🎨 UI/UX

- Tailwind CSS 기반 디자인 시스템
- 반응형 웹 디자인
- 모던하고 직관적인 인터페이스

## 📁 프로젝트 구조

```
src/
├── app/                 # Next.js App Router
├── components/          # 재사용 가능한 컴포넌트
├── lib/                # 유틸리티 및 설정
│   └── supabase.ts     # Supabase 클라이언트
├── hooks/              # 커스텀 React 훅
└── types/              # TypeScript 타입 정의
```

## 🚧 개발 진행 상황

- [x] 프로젝트 초기 설정
- [x] DB 스키마 설계
- [x] Supabase 설정
- [ ] 기본 UI 컴포넌트
- [ ] 인증 시스템
- [ ] 핵심 CRUD 기능

## 📝 라이선스

MIT License
