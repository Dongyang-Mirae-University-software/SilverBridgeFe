import { NavItem, PageKey } from '@/app/_common/layout/dashboard/types';

export const WARD_NAV: NavItem[] = [
  { href: '/ward', icon: 'home', label: '홈', key: 'home' },
  { href: '/ward/sos', icon: 'phone', label: '긴급 전화', key: 'sos' },
  { href: '/ward/chatbot', icon: 'message', label: 'AI 의료 챗봇', key: 'chatbot' },
  { href: '/ward/game', icon: 'game', label: '치매 예방 게임', key: 'game' },
  { href: '/ward/medication', icon: 'heart', label: '복약 알림', key: 'medication' },
  { href: '/ward/guardians', icon: 'users', label: '내 보호자', key: 'guardians' },
  { href: '/ward/notices', icon: 'bell', label: '공지사항', key: 'notices' },
  { href: '/ward/settings', icon: 'settings', label: '환경설정', key: 'settings' },
];

export const GUARDIAN_NAV: NavItem[] = [
  { href: '/guardian', icon: 'dashboard', label: '대시보드', key: 'dashboard' },
  { href: '/guardian/detection', icon: 'alert', label: '이상감지', key: 'detection' },
  { href: '/guardian/emotion', icon: 'heart', label: '정서 상태 체크', key: 'emotion' },
  { href: '/guardian/chatbot', icon: 'message', label: 'AI 의료 챗봇', key: 'chatbot' },
  { href: '/guardian/wards', icon: 'users', label: '피보호자 관리', key: 'wards' },
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
};

export const WARD_ACTIONS = [
  { href: '/ward/sos', label: '긴급전화' },
  { href: '/ward/chatbot', label: 'AI 챗봇' },
  { href: '/ward/game', label: '치매예방 게임' },
];

export const GUARDIAN_STATS = [
  { label: '연결된 피보호자', value: '3명', state: '정상 관리 중' },
  { label: '오늘 이상감지', value: '1건', state: '확인 필요' },
  { label: '복약 완료율', value: '86%', state: '전일 대비 +4%' },
  { label: '정서 체크', value: '안정', state: '최근 7일 기준' },
];
