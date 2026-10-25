import { NavItem } from '@/components/layout/dashboard/types';

export const WARD_NAV: NavItem[] = [
  { href: '/ward', icon: 'dashboard', label: '홈', key: 'home' },
  // { href: '/ward/sos', icon: 'phone', label: '긴급 전화', key: 'sos' },
  { href: '/ward/guardians', icon: 'users', label: '내 가족', key: 'guardians' },
  // 치매 예방 게임: 아직 미공개. 사이드바에서만 숨김(/ward/game 직접 접근은 가능)
  // { href: '/ward/game', icon: 'game', label: '치매 예방 게임', key: 'game' },
  { href: '/ward/notices', icon: 'bell', label: '공지사항', key: 'notices' },
  { href: '/ward/settings', icon: 'settings', label: '환경설정', key: 'settings' },
];

export const GUARDIAN_NAV: NavItem[] = [
  { href: '/guardian', icon: 'dashboard', label: '대시보드', key: 'dashboard' },
  { href: '/guardian/detection', icon: 'alert', label: '이상감지', key: 'detection' },
  { href: '/guardian/sos', icon: 'phone', label: 'SOS 이력', key: 'sos-history' },
  { href: '/guardian/emotion', icon: 'heart', label: '정서 상태 체크', key: 'emotion' },
  { href: '/guardian/chatbot', icon: 'message', label: 'AI 의료 챗봇', key: 'chatbot' },
  { href: '/guardian/medication', icon: 'heart', label: '복약 관리', key: 'medication-management' },
  // 게임 관리: 아직 미공개. 사이드바에서만 숨김(/guardian/game 직접 접근은 가능)
  // { href: '/guardian/game', icon: 'brain', label: '게임 관리', key: 'game-management' },
  { href: '/guardian/hospital', icon: 'hospital', label: '병원 예약', key: 'hospital' },
  { href: '/guardian/notices', icon: 'bell', label: '공지사항', key: 'notices' },
  { href: '/guardian/inquiries', icon: 'inquiry', label: '문의하기', key: 'inquiries' },
  { href: '/guardian/wards', icon: 'users', label: '연결된 가족', key: 'wards' },
  { href: '/guardian/wards/register', icon: 'plus', label: '가족 등록', key: 'ward-register' },
  { href: '/guardian/settings', icon: 'settings', label: '환경설정', key: 'settings' },
];

export const WARD_ACTIONS = [
  { href: '/ward/sos', label: '긴급전화' },
  { href: '/ward/medication', label: '복약 알림' },
  // { href: '/ward/game', label: '기억력 게임' },
];
