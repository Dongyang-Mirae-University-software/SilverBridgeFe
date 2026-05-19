'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { logout } from '@/service/api/auth';
import { myProfileQueryOptions } from '@/service/query/user';
import { AuthRole, clearAuthTokens } from '@/lib/auth/tokenStore';
import { getRoleLabel } from '@/lib/auth/routes';
import { getUserProfileData } from '@/lib/auth/userProfile';
import { unregisterFcmTokenForCurrentDevice } from '@/lib/fcm';
import styles from './UserDashboard.module.css';

const cx = classNames.bind(styles);

type PageKey =
  | 'home'
  | 'sos'
  | 'chatbot'
  | 'game'
  | 'hospital'
  | 'medication'
  | 'notices'
  | 'guardians'
  | 'settings'
  | 'dashboard'
  | 'detection'
  | 'emotion'
  | 'wards'
  | 'ward-register'
  | 'inquiries';

interface NavItem {
  href: string;
  label: string;
  key: PageKey;
}

interface Props {
  children?: ReactNode;
  pageKey: PageKey;
  role: AuthRole;
}

const WARD_NAV: NavItem[] = [
  { href: '/ward', label: '홈', key: 'home' },
  { href: '/ward/sos', label: '긴급 전화', key: 'sos' },
  { href: '/ward/chatbot', label: 'AI 의료 챗봇', key: 'chatbot' },
  { href: '/ward/game', label: '치매 예방 게임', key: 'game' },
  { href: '/ward/hospital', label: '병원 예약하기', key: 'hospital' },
  { href: '/ward/medication', label: '복약 알림', key: 'medication' },
  { href: '/ward/guardians', label: '내 보호자', key: 'guardians' },
  { href: '/ward/notices', label: '공지사항', key: 'notices' },
  { href: '/ward/settings', label: '환경설정', key: 'settings' },
];

const GUARDIAN_NAV: NavItem[] = [
  { href: '/guardian', label: '대시보드', key: 'dashboard' },
  { href: '/guardian/detection', label: '이상감지', key: 'detection' },
  { href: '/guardian/emotion', label: '정서 상태 체크', key: 'emotion' },
  { href: '/guardian/chatbot', label: 'AI 의료 챗봇', key: 'chatbot' },
  { href: '/guardian/wards', label: '피보호자 리스트', key: 'wards' },
  { href: '/guardian/wards/register', label: '피보호자 등록', key: 'ward-register' },
  { href: '/guardian/hospital', label: '병원 예약', key: 'hospital' },
  { href: '/guardian/notices', label: '공지사항', key: 'notices' },
  { href: '/guardian/inquiries', label: '문의하기', key: 'inquiries' },
  { href: '/guardian/settings', label: '환경설정', key: 'settings' },
];

const PAGE_TITLES: Record<PageKey, string> = {
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
  wards: '피보호자 리스트',
  'ward-register': '피보호자 등록',
  inquiries: '문의하기',
};

const WARD_ACTIONS = [
  { href: '/ward/sos', label: '긴급 전화', desc: '보호자와 119에 빠르게 연결' },
  { href: '/ward/chatbot', label: 'AI 의료 챗봇', desc: '증상과 복약 궁금증 확인' },
  { href: '/ward/game', label: '치매 예방 게임', desc: '매일 가볍게 두뇌 운동' },
  { href: '/ward/hospital', label: '병원 예약하기', desc: '가까운 병원 일정 확인' },
];

const GUARDIAN_STATS = [
  { label: '연결된 피보호자', value: '3명', state: '정상 관리 중' },
  { label: '오늘 이상감지', value: '1건', state: '확인 필요' },
  { label: '복약 완료율', value: '86%', state: '전일 대비 +4%' },
  { label: '정서 체크', value: '안정', state: '최근 7일 기준' },
];

export default function UserDashboard({ children, pageKey, role }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isWard = role === 'WARD';
  const navItems = isWard ? WARD_NAV : GUARDIAN_NAV;
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profile = getUserProfileData(profileResponse);
  const userName = profile?.name ?? (isWard ? '사용자' : '보호자');
  const { mutate: logoutMutate, isPending: isLoggingOut } = useMutation({
    mutationKey: ['logout'],
    mutationFn: async () => {
      await unregisterFcmTokenForCurrentDevice().catch(error => {
        console.error('FCM 토큰 삭제 실패:', error);
      });

      return logout();
    },
    onSettled: () => {
      clearAuthTokens();
      queryClient.clear();
      router.replace('/login');
    },
  });

  const handleLogout = () => {
    if (isLoggingOut) return;
    logoutMutate();
  };

  return (
    <div className={cx('stage')}>
      {!isSidebarOpen && (
        <button className={cx('menuButton', { ward: isWard })} type="button" aria-label="메뉴 열기" onClick={() => setIsSidebarOpen(true)}>
          ☰
        </button>
      )}

      {isSidebarOpen && (
        <>
          <button className={cx('scrim')} type="button" aria-label="메뉴 닫기" onClick={() => setIsSidebarOpen(false)} />
          <aside className={cx('sidebar')} aria-label={`${getRoleLabel(role)} 메뉴`}>
            <div className={cx('brand')}>
              <div className={cx('brandMark')}>SB</div>
              <div>
                <strong>SilverBridge</strong>
                <span>{getRoleLabel(role)} 웹</span>
              </div>
              <button className={cx('closeButton')} type="button" aria-label="메뉴 닫기" onClick={() => setIsSidebarOpen(false)}>
                ×
              </button>
            </div>

            <nav className={cx('nav')} aria-label={`${getRoleLabel(role)} 메뉴`}>
              {navItems.map(item => (
                <Link
                  key={item.href}
                  className={cx('navItem', { active: pathname === item.href })}
                  href={item.href}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <span className={cx('navDot')} />
                  {item.label}
                </Link>
              ))}
            </nav>

            <button className={cx('logoutButton')} type="button" disabled={isLoggingOut} onClick={handleLogout}>
              {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
            </button>

            <div className={cx('userCard')}>
              <div className={cx('avatar')}>{userName.charAt(0)}</div>
              <div>
                <strong>{userName}</strong>
                <span>{profile?.email ?? getRoleLabel(role)}</span>
              </div>
            </div>
          </aside>
        </>
      )}

      <main className={cx('main')}>
        <header className={cx('header')}>
          <div>
            <h1>{PAGE_TITLES[pageKey]}</h1>
            <p>{isWard ? '오늘도 편안하게 이용할 수 있도록 준비했어요.' : '가족의 상태를 한눈에 확인하고 필요한 일을 처리하세요.'}</p>
          </div>
          <div className={cx('headerActions')}>
            <span className={cx('roleBadge')}>{getRoleLabel(role)}</span>
            <button className={cx('headerLogoutButton')} type="button" disabled={isLoggingOut} onClick={handleLogout}>
              {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
            </button>
          </div>
        </header>

        {children ?? (isWard ? renderWardContent(pageKey, userName) : renderGuardianContent(pageKey, userName))}
      </main>
    </div>
  );
}

function renderWardContent(pageKey: PageKey, userName: string) {
  if (pageKey !== 'home') return <FeaturePanel title={PAGE_TITLES[pageKey]} role="WARD" />;

  return (
    <div className={cx('contentGrid')}>
      <section className={cx('heroCard')}>
        <span className={cx('eyebrow')}>안녕하세요, {userName}님</span>
        <h2>필요한 돌봄 기능을 크게, 쉽게 배치했어요.</h2>
        <p>긴급 연락, AI 상담, 병원 예약, 복약 알림을 한 화면에서 시작할 수 있습니다.</p>
        <Link className={cx('primaryButton')} href="/ward/sos">
          긴급 전화 열기
        </Link>
      </section>

      <section className={cx('quickGrid')}>
        {WARD_ACTIONS.map(action => (
          <Link key={action.href} className={cx('actionCard')} href={action.href}>
            <strong>{action.label}</strong>
            <span>{action.desc}</span>
          </Link>
        ))}
      </section>

      <section className={cx('wideCard')}>
        <div>
          <span className={cx('eyebrow')}>오늘의 상태</span>
          <h3>복약 알림 2건, 병원 일정 1건이 남아 있어요.</h3>
        </div>
        <div className={cx('statusList')}>
          <span>아침 혈압 기록 완료</span>
          <span>점심 약 복용 대기</span>
          <span>오후 3시 내과 예약</span>
        </div>
      </section>
    </div>
  );
}

function renderGuardianContent(pageKey: PageKey, userName: string) {
  if (pageKey !== 'dashboard') return <FeaturePanel title={PAGE_TITLES[pageKey]} role="GUARDIAN" />;

  return (
    <div className={cx('contentGrid')}>
      <section className={cx('heroCard')}>
        <span className={cx('eyebrow')}>{userName}님 대시보드</span>
        <h2>피보호자 상태와 이상감지 현황을 한눈에 확인하세요.</h2>
        <p>위험 신호, 정서 상태, 복약 일정, 병원 예약을 보호자 기준으로 정리했습니다.</p>
      </section>

      <section className={cx('statGrid')}>
        {GUARDIAN_STATS.map(stat => (
          <div key={stat.label} className={cx('statCard')}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <small>{stat.state}</small>
          </div>
        ))}
      </section>

      <section className={cx('wideCard')}>
        <div>
          <span className={cx('eyebrow')}>최근 알림</span>
          <h3>박영희 님의 낙상 의심 알림이 1건 있습니다.</h3>
        </div>
        <div className={cx('statusList')}>
          <span>낙상 의심 · 오늘 09:12</span>
          <span>복약 완료 · 오늘 08:10</span>
          <span>정서 상태 안정 · 어제</span>
        </div>
      </section>
    </div>
  );
}

function FeaturePanel({ title, role }: { title: string; role: AuthRole }) {
  return (
    <section className={cx('featurePanel')}>
      <span className={cx('eyebrow')}>{getRoleLabel(role)} 전용 기능</span>
      <h2>{title}</h2>
      <p>이 화면은 역할별 route group 안에 분리되어 있습니다. 이후 실제 API와 상세 기능을 이 페이지 단위로 연결하면 됩니다.</p>
    </section>
  );
}
