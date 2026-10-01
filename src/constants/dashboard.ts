import { NavItem, PageKey } from '@/components/layout/dashboard/types';

export const WARD_NAV: NavItem[] = [
  { href: '/ward', icon: 'home', label: '홈', key: 'home' },
  { href: '/ward/sos', icon: 'phone', label: '긴급 전화', key: 'sos' },
  // 치매 예방 게임: 아직 미공개. 사이드바에서만 숨김(/ward/game 직접 접근은 가능)
  // { href: '/ward/game', icon: 'game', label: '치매 예방 게임', key: 'game' },
  { href: '/ward/medication', icon: 'heart', label: '복약 알림', key: 'medication' },
  { href: '/ward/guardians', icon: 'users', label: '내 보호자', key: 'guardians' },
  { href: '/ward/notices', icon: 'bell', label: '공지사항', key: 'notices' },
  { href: '/ward/settings', icon: 'settings', label: '환경설정', key: 'settings' },
];

export const GUARDIAN_NAV: NavItem[] = [
  { href: '/guardian', icon: 'dashboard', label: '대시보드', key: 'dashboard' },
  { href: '/guardian/sos', icon: 'phone', label: 'SOS 이력', key: 'sos-history' },
  { href: '/guardian/detection', icon: 'alert', label: '이상감지', key: 'detection' },
  { href: '/guardian/emotion', icon: 'heart', label: '정서 상태 체크', key: 'emotion' },
  { href: '/guardian/chatbot', icon: 'message', label: 'AI 의료 챗봇', key: 'chatbot' },
  { href: '/guardian/wards', icon: 'users', label: '피보호자 관리', key: 'wards' },
  { href: '/guardian/medication', icon: 'heart', label: '복약 관리', key: 'medication-management' },
  // 게임 관리: 아직 미공개. 사이드바에서만 숨김(/guardian/game 직접 접근은 가능)
  // { href: '/guardian/game', icon: 'brain', label: '게임 관리', key: 'game-management' },
  { href: '/guardian/hospital', icon: 'hospital', label: '병원 예약', key: 'hospital' },
  { href: '/guardian/notices', icon: 'bell', label: '공지사항', key: 'notices' },
  { href: '/guardian/inquiries', icon: 'inquiry', label: '문의하기', key: 'inquiries' },
  { href: '/guardian/settings', icon: 'settings', label: '환경설정', key: 'settings' },
];

export const PAGE_TITLES: Record<PageKey, string> = {
  home: '홈',
  sos: '긴급 전화',
  chatbot: 'AI 의료 챗봇',
  game: '치매 예방 게임',
  hospital: '병원 예약하기',
  medication: '복약 알림',
  notices: '공지사항',
  guardians: '내 보호자',
  settings: '환경설정',
  dashboard: '대시보드',
  detection: '이상감지',
  emotion: '정서 상태 체크',
  wards: '피보호자 관리',
  'ward-register': '피보호자 등록',
  inquiries: '문의하기',
  stream: '화면 송출',
  'sos-history': 'SOS 이력',
  'medication-management': '복약 관리',
  'game-management': '게임 관리',
};

export const WARD_ACTIONS = [
  { href: '/ward/sos', label: '긴급전화' },
  { href: '/ward/medication', label: '복약 알림' },
  // { href: '/ward/game', label: '기억력 게임' },
];
