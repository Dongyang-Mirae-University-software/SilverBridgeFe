import { NavItem } from '@/components/layout/dashboard/types';

export const WARD_NAV: NavItem[] = [
  { href: '/ward', icon: 'dashboard', label: '홈', key: 'home' },
  // 안부 말벗은 고정 메뉴에 두지 않는다 - 피보호자는 대화 시간에 홈 카드·알림으로만 들어간다(2026-11-11 사용자 결정).
  // 테스트 계정만 WardLayout이 아래 WARD_COMPANION_NAV를 '홈' 다음에 끼운다.
  // { href: '/ward/sos', icon: 'phone', label: '긴급 전화', key: 'sos' },
  { href: '/ward/guardians', icon: 'users', label: '내 가족', key: 'guardians' },
  { href: '/ward/game', icon: 'game', label: '치매 예방 게임', key: 'game' },
  { href: '/ward/notices', icon: 'bell', label: '공지사항', key: 'notices' },
  { href: '/ward/settings', icon: 'settings', label: '환경설정', key: 'settings' },
];

/** [테스트 계정만] 사이드바의 안부 말벗 메뉴 */
export const WARD_COMPANION_NAV: NavItem = { href: '/ward/companion', icon: 'heart', label: '안부 말벗', key: 'companion', badge: '테스트' };

/** 피보호자 사이드바 - 테스트 계정이면 '홈' 다음에 안부 말벗을 끼운다. */
export function wardNavItems(companionTestMode: boolean): NavItem[] {
  return companionTestMode ? [WARD_NAV[0], WARD_COMPANION_NAV, ...WARD_NAV.slice(1)] : WARD_NAV;
}

// v13 시안의 4개에 AI 기분 체크를 더한다(사용자 결정) - 이상감지·SOS 이력·AI 의료 챗봇·복약 관리·병원 예약·
// 연결된 가족·가족 등록은 홈(대시보드) 카드와 알림으로 들어간다
export const GUARDIAN_NAV: NavItem[] = [
  { href: '/guardian', icon: 'dashboard', label: '홈', key: 'dashboard' },
  { href: '/guardian/emotion', icon: 'heart', label: 'AI 기분 체크', key: 'emotion' },
  { href: '/guardian/notices', icon: 'bell', label: '공지사항', key: 'notices' },
  { href: '/guardian/inquiries', icon: 'inquiry', label: '문의하기', key: 'inquiries' },
  { href: '/guardian/settings', icon: 'settings', label: '환경설정', key: 'settings' },
];

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', icon: 'dashboard', label: '대시보드', key: 'dashboard' },
  { href: '/admin/members', icon: 'users', label: '회원 관리', key: 'members' },
  { href: '/admin/ai-stats', icon: 'activity', label: 'AI 통계', key: 'ai-stats' },
  { href: '/admin/notifications', icon: 'bell', label: '알림 이력', key: 'notification-history' },
  { href: '/admin/devices', icon: 'eye', label: '디바이스 관리', key: 'devices' },
  { href: '/admin/hospitals', icon: 'hospital', label: '제휴 병원', key: 'hospitals' },
  { href: '/admin/notices', icon: 'fileText', label: '공지사항', key: 'admin-notices' },
  { href: '/admin/inquiries', icon: 'inquiry', label: '고객센터', key: 'inquiries' },
];

export const WARD_ACTIONS = [
  { href: '/ward/sos', label: '긴급전화' },
  { href: '/ward/medication', label: '복약 알림' },
  // { href: '/ward/game', label: '기억력 게임' },
];
