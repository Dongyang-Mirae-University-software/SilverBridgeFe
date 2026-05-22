'use client';

import { CSSProperties, FormEvent, ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import { logout, signupSmsSend, signupSmsVerify } from '@/service/api/auth';
import {
  changeMyPassword,
  changeMyProfileImage,
  deleteMyAccount,
  updateMyProfile,
} from '@/service/api/user';
import { myProfileQueryKey, myProfileQueryOptions } from '@/service/query/user';
import { GenderType } from '@/service/interface/auth';
import { IUserProfile, IUserUpdateReq } from '@/service/interface/user';
import { AuthRole, clearAuthTokens, getAccessTokenSubject } from '@/lib/auth/tokenStore';
import { getRoleLabel } from '@/lib/auth/routes';
import { getUserProfileData } from '@/lib/auth/userProfile';
import { unregisterFcmTokenForCurrentDevice } from '@/lib/fcm';
import { connectConnectionSocket, ConnectionRealtimePayload } from '@/lib/realtime/connectionSocket';
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
  icon: NavIconName;
  label: string;
  key: PageKey;
}

interface Props {
  children?: ReactNode;
  pageKey: PageKey;
  role: AuthRole;
}

type NavIconName =
  | 'home'
  | 'phone'
  | 'message'
  | 'game'
  | 'hospital'
  | 'heart'
  | 'users'
  | 'bell'
  | 'settings'
  | 'dashboard'
  | 'alert'
  | 'plus'
  | 'inquiry';

const WARD_NAV: NavItem[] = [
  { href: '/ward', icon: 'home', label: '홈', key: 'home' },
  { href: '/ward/sos', icon: 'phone', label: '긴급 전화', key: 'sos' },
  { href: '/ward/chatbot', icon: 'message', label: 'AI 의료 챗봇', key: 'chatbot' },
  { href: '/ward/game', icon: 'game', label: '치매 예방 게임', key: 'game' },
  { href: '/ward/medication', icon: 'heart', label: '복약 알림', key: 'medication' },
  { href: '/ward/guardians', icon: 'users', label: '내 보호자', key: 'guardians' },
  { href: '/ward/notices', icon: 'bell', label: '공지사항', key: 'notices' },
  { href: '/ward/settings', icon: 'settings', label: '환경설정', key: 'settings' },
];

const GUARDIAN_NAV: NavItem[] = [
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
  wards: '피보호자 관리',
  'ward-register': '피보호자 등록',
  inquiries: '문의하기',
};

const WARD_ACTIONS = [
  { href: '/ward/sos', label: '긴급전화' },
  { href: '/ward/chatbot', label: 'AI 챗봇' },
  { href: '/ward/game', label: '치매예방 게임' },
];

const GUARDIAN_STATS = [
  { label: '연결된 피보호자', value: '3명', state: '정상 관리 중' },
  { label: '오늘 이상감지', value: '1건', state: '확인 필요' },
  { label: '복약 완료율', value: '86%', state: '전일 대비 +4%' },
  { label: '정서 체크', value: '안정', state: '최근 7일 기준' },
];

type WardSosAction = 'call119' | 'call119AndNotify' | 'notifyGuardianFirst';

interface WardSettings {
  fontSize: number;
  highContrast: boolean;
  sosAction: WardSosAction;
}

const WARD_SETTINGS_STORAGE_KEY = 'silverbridge_ward_settings';
const MIN_WARD_FONT_SIZE = 14;
const MAX_WARD_FONT_SIZE = 28;
const DEFAULT_WARD_SETTINGS: WardSettings = {
  fontSize: 17,
  highContrast: false,
  sosAction: 'call119AndNotify',
};

const WARD_SOS_OPTIONS: Array<{ label: string; value: WardSosAction }> = [
  { value: 'call119', label: '119에 바로 연결' },
  { value: 'call119AndNotify', label: '119 연결과 동시에 보호자에게 알림' },
  { value: 'notifyGuardianFirst', label: '보호자에게 먼저 알림한 뒤 119 연결 안내' },
];

function getRealtimeNotification(payload: ConnectionRealtimePayload) {
  switch (payload.type) {
    case 'CONNECTION_REQUEST':
      return {
        body: payload.body ?? '보호자가 연결을 요청했습니다.',
        title: payload.title ?? '연결 요청',
      };
    case 'CONNECTION_ACCEPTED':
      return {
        body: payload.body ?? '피보호자가 연결 요청을 수락했습니다.',
        title: payload.title ?? '연결 수락',
      };
    case 'CONNECTION_REFUSED':
      return {
        body: payload.body ?? '피보호자가 연결 요청을 거절했습니다.',
        title: payload.title ?? '연결 거절',
      };
    case 'CONNECTION_CANCELLED':
      return {
        body: payload.body ?? '연결 요청이 취소되었습니다.',
        title: payload.title ?? '요청 취소',
      };
    default:
      return {
        body: payload.body ?? '연결 상태가 변경되었습니다.',
        title: payload.title ?? '연결 변경',
      };
  }
}

function getProviderLabel(provider?: string) {
  if (provider === 'KAKAO') return '카카오';
  if (provider === 'LOCAL') return '일반';
  return '확인 전';
}

function formatProfileDate(value?: string) {
  if (!value) return '정보 없음';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '정보 없음';

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function MenuIcon() {
  return (
    <svg className={cx('menuIcon')} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function NavIcon({ name }: { name: NavIconName }) {
  switch (name) {
    case 'home':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
        </svg>
      );
    case 'phone':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.1 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.8.7a2 2 0 0 1 1.8 2.1Z" />
        </svg>
      );
    case 'message':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.8 8.8 0 0 1-3.5-.9L3 21l1.8-5A8.3 8.3 0 0 1 3 11.5a8.6 8.6 0 0 1 9-8.4 8.6 8.6 0 0 1 9 8.4Z" />
        </svg>
      );
    case 'game':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 12h4M8 10v4M15 11h.01M18 13h.01M7 17h10a4 4 0 0 0 3.8-5.3l-1.2-3.5A4 4 0 0 0 15.8 5H8.2a4 4 0 0 0-3.8 3.2l-1.2 3.5A4 4 0 0 0 7 17Z" />
        </svg>
      );
    case 'hospital':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M9 21v-6h6v6M9 8h6M12 5v6" />
        </svg>
      );
    case 'heart':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" />
        </svg>
      );
    case 'users':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
        </svg>
      );
    case 'bell':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0" />
        </svg>
      );
    case 'settings':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2a2 2 0 1 1-4 0V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H2.8a2 2 0 1 1 0-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V2.8a2 2 0 1 1 4 0V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z" />
        </svg>
      );
    case 'dashboard':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 13h8V3H3v10ZM13 21h8V11h-8v10ZM13 9h8V3h-8v6ZM3 21h8v-6H3v6Z" />
        </svg>
      );
    case 'alert':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m10.3 3.9-8.5 14.9A2 2 0 0 0 3.5 22h17a2 2 0 0 0 1.7-3.2L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01" />
        </svg>
      );
    case 'plus':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'inquiry':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.4 1 1.1 1 1.8V17h6v-.5c0-.7.4-1.4 1-1.8A7 7 0 0 0 12 2Z" />
        </svg>
      );
    default:
      return null;
  }
}

export default function UserDashboard({ children, pageKey, role }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [wardSettings, setWardSettings] = useState<WardSettings>(DEFAULT_WARD_SETTINGS);
  const [isWardSettingsLoaded, setIsWardSettingsLoaded] = useState(false);
  const isWard = role === 'WARD';
  const navItems = isWard ? WARD_NAV : GUARDIAN_NAV;
  const pageTitle = PAGE_TITLES[pageKey];
  const rootPath = isWard ? '/ward' : '/guardian';
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profile = getUserProfileData(profileResponse);
  const realtimeUserId = getAccessTokenSubject() ?? profile?.id;
  const userName = profile?.name ?? (isWard ? '사용자' : '보호자');
  const userEmail = profile?.email ?? '이메일 정보 없음';
  const userPhone = profile?.phone ?? '전화번호 정보 없음';
  const userInitial = userName.charAt(0) || 'U';
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
  const { mutate: profileImageMutate, isPending: isProfileImageChanging } = useMutation({
    mutationKey: ['user-profile-image-change'],
    mutationFn: changeMyProfileImage,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: myProfileQueryKey });
    },
    onError: error => {
      console.error('프로필 이미지 변경 실패:', error);
    },
  });

  const handleLogout = () => {
    if (isLoggingOut) return;
    logoutMutate();
  };

  const handleProfileImageChange = (file?: File) => {
    if (!file || isProfileImageChanging) return;
    profileImageMutate(file);
  };

  const updateWardSettings = (settings: Partial<WardSettings>) => {
    setWardSettings(current => ({ ...current, ...settings }));
  };

  useEffect(() => {
    if (!isWard) return;

    try {
      const rawSettings = window.localStorage.getItem(WARD_SETTINGS_STORAGE_KEY);
      if (rawSettings) {
        const parsedSettings = JSON.parse(rawSettings) as Partial<WardSettings>;
        setWardSettings({
          ...DEFAULT_WARD_SETTINGS,
          ...parsedSettings,
          fontSize: clampFontSize(parsedSettings.fontSize),
          sosAction: getValidSosAction(parsedSettings.sosAction),
        });
      }
    } catch (error) {
      console.error('피보호자 환경설정 불러오기 실패:', error);
    } finally {
      setIsWardSettingsLoaded(true);
    }
  }, [isWard]);

  useEffect(() => {
    if (!isWard || !isWardSettingsLoaded) return;

    window.localStorage.setItem(WARD_SETTINGS_STORAGE_KEY, JSON.stringify(wardSettings));
  }, [isWard, isWardSettingsLoaded, wardSettings]);

  useEffect(() => {
    if (!realtimeUserId) return;

    return connectConnectionSocket({
      role,
      userId: realtimeUserId,
      onMessage: payload => {
        const notification = getRealtimeNotification(payload);

        window.dispatchEvent(
          new CustomEvent('careai:push', {
            detail: {
              data: {
                connectionId: payload.connectionId ?? '',
                type: payload.type,
              },
              notification,
            },
          }),
        );
      },
    });
  }, [realtimeUserId, role]);

  const profileRows = [
    { label: '사용자 ID', value: profile?.id ?? '정보 없음' },
    { label: '전화번호', value: userPhone },
    { label: '최근 로그인', value: formatProfileDate(profile?.lastLoginAt) },
    { label: '가입일', value: formatProfileDate(profile?.createdAt) },
  ];

  const stageStyle = isWard
    ? ({ '--ward-preferred-font-size': `${wardSettings.fontSize}px` } as CSSProperties)
    : undefined;

  return (
    <div
      className={cx('stage', {
        guardianTheme: !isWard,
        wardHighContrast: isWard && wardSettings.highContrast,
        wardReadableText: isWard,
      })}
      style={stageStyle}
    >
      <div className={cx('mobileTopBar')}>
        <button
          className={cx('topBarMenuButton')}
          type="button"
          aria-label="메뉴 열기"
          onClick={() => setIsSidebarOpen(true)}
        >
          <MenuIcon />
          <span>메뉴</span>
        </button>
        <div className={cx('topBarBrand')}>
          <div className={cx('brandMark')}>S</div>
          <div>
            <strong>SilverBridge</strong>
            <span>{pageTitle}</span>
          </div>
        </div>
        <span className={cx('topBarRole')}>{getRoleLabel(role)}</span>
      </div>

      {isSidebarOpen && (
        <button
          className={cx('scrim')}
          type="button"
          aria-label="메뉴 닫기"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={cx('sidebar', { open: isSidebarOpen })} aria-label={`${getRoleLabel(role)} 메뉴`}>
        <div className={cx('brand')}>
          <div className={cx('brandMark')}>S</div>
          <div>
            <strong>SilverBridge</strong>
            <span>{getRoleLabel(role)} 웹</span>
          </div>
          <button
            className={cx('closeButton')}
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setIsSidebarOpen(false)}
          >
            ×
          </button>
        </div>

        <nav className={cx('nav')} aria-label={`${getRoleLabel(role)} 메뉴`}>
          {navItems.map(item => (
            <Link
              key={item.href}
              className={cx('navItem', {
                active: pathname === item.href || (item.href !== rootPath && pathname.startsWith(`${item.href}/`)),
              })}
              href={item.href}
              onClick={() => setIsSidebarOpen(false)}
            >
              <span className={cx('navIcon')}>
                <NavIcon name={item.icon} />
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className={cx('sidebarFooter')}>
          <button
            className={cx('userCard')}
            type="button"
            aria-haspopup="dialog"
            aria-label="사용자 상세 정보 열기"
            onClick={() => setIsProfileModalOpen(true)}
          >
            <div className={cx('avatar')}>
              {profile?.profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={profile.profileImage} />
              ) : (
                userInitial
              )}
            </div>
            <div className={cx('userInfo')}>
              <div className={cx('userTitleRow')}>
                <strong>{userName}</strong>
                <span className={cx('userRoleBadge')}>{getRoleLabel(role)}</span>
              </div>
              <span>{userEmail}</span>
            </div>
            <span className={cx('userChevron')} aria-hidden="true">
              ›
            </span>
          </button>

          <button className={cx('logoutButton')} type="button" disabled={isLoggingOut} onClick={handleLogout}>
            {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
          </button>
        </div>
      </aside>

      {isProfileModalOpen && (
        <div className={cx('profileModalOverlay')} role="presentation" onClick={() => setIsProfileModalOpen(false)}>
          <section
            className={cx('profileModal')}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-modal-title"
            onClick={event => event.stopPropagation()}
          >
            <div className={cx('profileModalHeader')}>
              <div className={cx('profileModalUser')}>
                <div className={cx('profilePhotoBlock')}>
                  <div className={cx('profileModalAvatar')}>
                    {profile?.profileImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" src={profile.profileImage} />
                    ) : (
                      userInitial
                    )}
                  </div>
                  <label className={cx('profilePhotoEditButton')} aria-label="프로필 이미지 변경">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8.5 7.5 10 5h4l1.5 2.5H18a3 3 0 0 1 3 3V17a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-6.5a3 3 0 0 1 3-3h2.5Z" />
                      <path d="M12 10.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
                    </svg>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isProfileImageChanging}
                      onChange={event => {
                        handleProfileImageChange(event.target.files?.[0]);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                </div>
                <div>
                  <div className={cx('profileModalBadges')}>
                    <span className={cx('userRoleBadge')}>{getRoleLabel(role)}</span>
                    <span className={cx('profileProviderBadge')}>{getProviderLabel(profile?.provider)}</span>
                  </div>
                  <h2 id="profile-modal-title">{userName}</h2>
                  <p>{userEmail}</p>
                </div>
              </div>
              <button
                className={cx('profileModalClose')}
                type="button"
                aria-label="사용자 상세 정보 닫기"
                onClick={() => setIsProfileModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className={cx('profileDetailGrid')}>
              {profileRows.map(row => (
                <div key={row.label} className={cx('profileDetailItem')}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>

            <ProfileModalControls
              key={profile?.id ?? 'anonymous-profile'}
              profile={profile}
              isLoggingOut={isLoggingOut}
              onClose={() => setIsProfileModalOpen(false)}
              onLogout={handleLogout}
            />
          </section>
        </div>
      )}

      <main className={cx('main')}>
        <header className={cx('desktopHeader')}>
          <div className={cx('desktopHeaderTitle')}>
            <span className={cx('roleBadge')}>{getRoleLabel(role)} 웹</span>
            <h1>{pageTitle}</h1>
          </div>
          <button
            className={cx('desktopUserButton')}
            type="button"
            aria-haspopup="dialog"
            aria-label="사용자 상세 정보 열기"
            onClick={() => setIsProfileModalOpen(true)}
          >
            <div className={cx('avatar')}>
              {profile?.profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={profile.profileImage} />
              ) : (
                userInitial
              )}
            </div>
            <div className={cx('desktopUserInfo')}>
              <strong>{userName}</strong>
              <span>{userEmail}</span>
            </div>
          </button>
        </header>
        {children ??
          (isWard
            ? renderWardContent(pageKey, wardSettings, updateWardSettings)
            : renderGuardianContent(pageKey, userName))}
      </main>
    </div>
  );
}

function ProfileModalControls({
  profile,
  isLoggingOut,
  onClose,
  onLogout,
}: {
  profile: IUserProfile | null;
  isLoggingOut: boolean;
  onClose: () => void;
  onLogout: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [profileForm, setProfileForm] = useState<IUserUpdateReq>(getProfileFormValue(profile));
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneNonce, setPhoneNonce] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [activePanel, setActivePanel] = useState<'profile' | 'security'>('profile');
  const isKakaoUser = profile?.provider === 'KAKAO';
  const isPhoneChanged = (profileForm.phone ?? '').trim() !== (profile?.phone ?? '');

  const profileMutation = useMutation({
    mutationKey: ['user-profile-update'],
    mutationFn: updateMyProfile,
    onMutate: () => setFeedbackMessage(''),
    onSuccess: async response => {
      setProfileForm(getProfileFormValue(getUserProfileData(response)));
      setPhoneCode('');
      setPhoneNonce(null);
      setFeedbackMessage('프로필 정보를 수정했습니다.');
      await queryClient.invalidateQueries({ queryKey: myProfileQueryKey });
    },
    onError: error => setFeedbackMessage(getModalErrorMessage(error, '프로필 수정에 실패했습니다.')),
  });

  const smsSendMutation = useMutation({
    mutationKey: ['user-profile-phone-sms-send'],
    mutationFn: signupSmsSend,
    onMutate: () => setFeedbackMessage(''),
    onSuccess: () => setFeedbackMessage('새 전화번호로 인증번호를 보냈습니다.'),
    onError: error => setFeedbackMessage(getModalErrorMessage(error, '인증번호 발송에 실패했습니다.')),
  });

  const smsVerifyMutation = useMutation({
    mutationKey: ['user-profile-phone-sms-verify'],
    mutationFn: signupSmsVerify,
    onMutate: () => setFeedbackMessage(''),
    onSuccess: response => {
      const verificationNonce = getSmsVerificationNonce(response);
      setPhoneNonce(verificationNonce);
      setFeedbackMessage('전화번호 인증이 완료되었습니다.');
    },
    onError: error => setFeedbackMessage(getModalErrorMessage(error, '전화번호 인증에 실패했습니다.')),
  });

  const passwordMutation = useMutation({
    mutationKey: ['user-password-change'],
    mutationFn: changeMyPassword,
    onMutate: () => setFeedbackMessage(''),
    onSuccess: () => {
      clearAuthTokens();
      queryClient.clear();
      router.replace('/login');
    },
    onError: error => setFeedbackMessage(getModalErrorMessage(error, '비밀번호 변경에 실패했습니다.')),
  });

  const deleteMutation = useMutation({
    mutationKey: ['user-account-delete'],
    mutationFn: deleteMyAccount,
    onMutate: () => setFeedbackMessage(''),
    onSuccess: () => {
      clearAuthTokens();
      queryClient.clear();
      router.replace('/login');
    },
    onError: error => setFeedbackMessage(getModalErrorMessage(error, '회원 탈퇴에 실패했습니다.')),
  });

  const updateProfileForm = (field: keyof IUserUpdateReq, value: string) => {
    setProfileForm(current => ({
      ...current,
      [field]: value,
    }));

    if (field === 'phone') {
      setPhoneCode('');
      setPhoneNonce(null);
    }
  };

  const resetProfilePanel = () => {
    setProfileForm(getProfileFormValue(profile));
    setPhoneCode('');
    setPhoneNonce(null);
  };

  const resetSecurityPanel = () => {
    setPasswordForm({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
    setDeletePassword('');
    setDeleteConfirmation('');
  };

  const handlePanelChange = (panel: 'profile' | 'security') => {
    if (panel === activePanel) return;

    setFeedbackMessage('');
    resetProfilePanel();
    resetSecurityPanel();
    setActivePanel(panel);
  };

  const handleProfileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = (profileForm.name ?? '').trim();
    const phone = (profileForm.phone ?? '').trim();
    const birthDate = profileForm.birthDate ?? '';
    const postcode = (profileForm.postcode ?? '').trim();
    const address = (profileForm.address ?? '').trim();
    const addressDetail = (profileForm.addressDetail ?? '').trim();

    if (!name) {
      setFeedbackMessage('이름을 입력하세요.');
      return;
    }

    if (!/^\d{10,11}$/.test(phone)) {
      setFeedbackMessage('전화번호는 숫자 10~11자리로 입력하세요.');
      return;
    }

    if (!birthDate || !postcode || !address) {
      setFeedbackMessage('생년월일, 우편번호, 주소를 모두 입력하세요.');
      return;
    }

    if (isPhoneChanged && !phoneNonce) {
      setFeedbackMessage('전화번호를 변경하려면 SMS 인증을 완료하세요.');
      return;
    }

    profileMutation.mutate({
      ...profileForm,
      address,
      addressDetail,
      birthDate,
      name,
      phone,
      postcode,
      verificationNonce: isPhoneChanged ? phoneNonce : null,
    });
  };

  const handlePasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isKakaoUser) {
      setFeedbackMessage('카카오 가입 계정은 비밀번호를 변경할 수 없습니다.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.newPasswordConfirm) {
      setFeedbackMessage('새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    passwordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  const handleDeleteSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!window.confirm('정말 회원 탈퇴를 진행할까요? 탈퇴 후 해당 계정으로 로그인할 수 없습니다.')) return;

    deleteMutation.mutate(
      isKakaoUser
        ? { confirmation: deleteConfirmation }
        : { password: deletePassword },
    );
  };

  return (
    <div className={cx('profileManageStack')}>
      {feedbackMessage && <p className={cx('profileModalMessage')}>{feedbackMessage}</p>}

      <div className={cx('profileTabsBar')} role="tablist" aria-label="사용자 정보 관리">
        <button
          className={cx('profileTab', { profileTabActive: activePanel === 'profile' })}
          type="button"
          role="tab"
          aria-selected={activePanel === 'profile'}
          onClick={() => handlePanelChange('profile')}
        >
          기본 정보
        </button>
        <button
          className={cx('profileTab', { profileTabActive: activePanel === 'security' })}
          type="button"
          role="tab"
          aria-selected={activePanel === 'security'}
          onClick={() => handlePanelChange('security')}
        >
          보안
        </button>
      </div>

      <div className={cx('profileManageScroll')}>
        {activePanel === 'profile' ? (
          <section className={cx('profileManageCard')}>
            <form className={cx('profileForm')} onSubmit={handleProfileSubmit}>
              <div className={cx('profileFormGrid')}>
                <label className={cx('profileField')}>
                  <span>이름</span>
                  <input
                    maxLength={20}
                    value={profileForm.name ?? ''}
                    onChange={event => updateProfileForm('name', event.target.value)}
                  />
                </label>
                <label className={cx('profileField')}>
                  <span>전화번호</span>
                  <input
                    inputMode="numeric"
                    value={profileForm.phone ?? ''}
                    onChange={event => updateProfileForm('phone', event.target.value.replace(/\D/g, ''))}
                  />
                </label>
                <label className={cx('profileField')}>
                  <span>성별</span>
                  <select
                    value={profileForm.gender ?? 'FEMALE'}
                    onChange={event => updateProfileForm('gender', event.target.value as GenderType)}
                  >
                    <option value="FEMALE">여성</option>
                    <option value="MALE">남성</option>
                  </select>
                </label>
                <label className={cx('profileField')}>
                  <span>생년월일</span>
                  <input
                    type="date"
                    value={profileForm.birthDate ?? ''}
                    onChange={event => updateProfileForm('birthDate', event.target.value)}
                  />
                </label>
                <label className={cx('profileField')}>
                  <span>우편번호</span>
                  <input
                    inputMode="numeric"
                    maxLength={5}
                    value={profileForm.postcode ?? ''}
                    onChange={event => updateProfileForm('postcode', event.target.value.replace(/\D/g, ''))}
                  />
                </label>
                <label className={cx('profileField')}>
                  <span>주소</span>
                  <input value={profileForm.address ?? ''} onChange={event => updateProfileForm('address', event.target.value)} />
                </label>
              </div>

              <label className={cx('profileField')}>
                <span>상세 주소</span>
                <input
                  value={profileForm.addressDetail ?? ''}
                  onChange={event => updateProfileForm('addressDetail', event.target.value)}
                />
              </label>

              {isPhoneChanged && (
                <div className={cx('profilePhoneVerify')}>
                  <button
                    className={cx('profileModalGhostButton')}
                    type="button"
                    disabled={smsSendMutation.isPending}
                    onClick={() => smsSendMutation.mutate({ phone: (profileForm.phone ?? '').trim() })}
                  >
                    {smsSendMutation.isPending ? '발송 중' : '인증번호 발송'}
                  </button>
                  <input
                    inputMode="numeric"
                    placeholder="인증번호"
                    value={phoneCode}
                    onChange={event => setPhoneCode(event.target.value)}
                  />
                  <button
                    className={cx('profileModalGhostButton')}
                    type="button"
                    disabled={smsVerifyMutation.isPending || !phoneCode.trim()}
                    onClick={() => smsVerifyMutation.mutate({ phone: (profileForm.phone ?? '').trim(), code: phoneCode.trim() })}
                  >
                    {smsVerifyMutation.isPending ? '확인 중' : phoneNonce ? '인증 완료' : '인증 확인'}
                  </button>
                </div>
              )}

              <div className={cx('profileModalActions')}>
                <button className={cx('profilePrimaryButton')} type="submit" disabled={profileMutation.isPending}>
                  {profileMutation.isPending ? '저장 중' : '프로필 저장'}
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section className={cx('profileManageCard')}>
            <form className={cx('profileForm')} onSubmit={handlePasswordSubmit}>
              <div className={cx('profileFormGrid')}>
                <label className={cx('profileField')}>
                  <span>현재 비밀번호</span>
                  <input
                    type="password"
                    disabled={isKakaoUser}
                    value={passwordForm.currentPassword ?? ''}
                    onChange={event => setPasswordForm(current => ({ ...current, currentPassword: event.target.value }))}
                  />
                </label>
                <label className={cx('profileField')}>
                  <span>새 비밀번호</span>
                  <input
                    type="password"
                    disabled={isKakaoUser}
                    value={passwordForm.newPassword ?? ''}
                    onChange={event => setPasswordForm(current => ({ ...current, newPassword: event.target.value }))}
                  />
                </label>
                <label className={cx('profileField')}>
                  <span>새 비밀번호 확인</span>
                  <input
                    type="password"
                    disabled={isKakaoUser}
                    value={passwordForm.newPasswordConfirm ?? ''}
                    onChange={event => setPasswordForm(current => ({ ...current, newPasswordConfirm: event.target.value }))}
                  />
                </label>
              </div>
              <div className={cx('profileModalActions')}>
                <button className={cx('profilePrimaryButton')} type="submit" disabled={isKakaoUser || passwordMutation.isPending}>
                  {passwordMutation.isPending ? '변경 중' : '비밀번호 변경'}
                </button>
              </div>
            </form>

            <form className={cx('profileDeleteRow')} onSubmit={handleDeleteSubmit}>
              <input
                type={isKakaoUser ? 'text' : 'password'}
                placeholder={isKakaoUser ? '탈퇴' : '현재 비밀번호'}
                value={isKakaoUser ? deleteConfirmation ?? '' : deletePassword ?? ''}
                onChange={event =>
                  isKakaoUser ? setDeleteConfirmation(event.target.value) : setDeletePassword(event.target.value)
                }
              />
              <button className={cx('profileDangerButton')} type="submit" disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? '처리 중' : '회원 탈퇴'}
              </button>
            </form>
          </section>
        )}
      </div>

      <div className={cx('profileModalFooter')}>
        <button className={cx('logoutButton')} type="button" disabled={isLoggingOut} onClick={onLogout}>
          {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
        </button>
        <button className={cx('profileModalGhostButton')} type="button" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}

function getProfileFormValue(profile?: IUserProfile | null): IUserUpdateReq {
  return {
    address: profile?.address ?? '',
    addressDetail: profile?.addressDetail ?? '',
    birthDate: profile?.birthDate ?? '',
    gender: profile?.gender ?? 'FEMALE',
    name: profile?.name ?? '',
    phone: profile?.phone ?? '',
    postcode: profile?.postcode ?? '',
    verificationNonce: null,
  };
}

function getModalErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getSmsVerificationNonce(response: unknown) {
  const data = (response as { data?: unknown } | undefined)?.data;
  const nestedData = (data as { data?: unknown } | undefined)?.data;
  const verificationData = (nestedData ?? data ?? response) as { verificationNonce?: string } | null;

  return verificationData?.verificationNonce ?? '';
}

function clampFontSize(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return DEFAULT_WARD_SETTINGS.fontSize;

  return Math.min(MAX_WARD_FONT_SIZE, Math.max(MIN_WARD_FONT_SIZE, value));
}

function getValidSosAction(value: unknown): WardSosAction {
  return WARD_SOS_OPTIONS.some(option => option.value === value)
    ? (value as WardSosAction)
    : DEFAULT_WARD_SETTINGS.sosAction;
}

function renderWardContent(
  pageKey: PageKey,
  wardSettings: WardSettings,
  updateWardSettings: (settings: Partial<WardSettings>) => void,
) {
  if (pageKey === 'settings') {
    return <WardSettingsPanel settings={wardSettings} onSettingsChange={updateWardSettings} />;
  }

  if (pageKey !== 'home') return <FeaturePanel title={PAGE_TITLES[pageKey]} role="WARD" />;

  return (
    <div className={cx('wardHomeActions')}>
      <section className={cx('quickGrid', 'wardHomeActionGrid')}>
        {WARD_ACTIONS.map(action => (
          <Link key={action.href} className={cx('actionCard')} href={action.href}>
            <strong>{action.label}</strong>
          </Link>
        ))}
      </section>
    </div>
  );
}

function WardSettingsPanel({
  settings,
  onSettingsChange,
}: {
  settings: WardSettings;
  onSettingsChange: (settings: Partial<WardSettings>) => void;
}) {
  const fontRangeProgress =
    ((settings.fontSize - MIN_WARD_FONT_SIZE) / (MAX_WARD_FONT_SIZE - MIN_WARD_FONT_SIZE)) * 100;
  const rangeStyle = { '--settings-range-progress': `${fontRangeProgress}%` } as CSSProperties;

  return (
    <section className={cx('settingsPage')} aria-labelledby="ward-settings-title">
      <div className={cx('settingsHeader')}>
        <span className={cx('eyebrow')}>피보호자 전용</span>
        <h2 id="ward-settings-title">환경설정</h2>
        <p>글자 크기, 화면 대비, 긴급 SOS 동작 방식을 이 기기에 저장합니다.</p>
      </div>

      <div className={cx('settingsStack')}>
        <section className={cx('settingsCard')} aria-labelledby="ward-font-size-title">
          <div className={cx('settingsCardHeader')}>
            <span className={cx('settingsNumber')}>1</span>
            <div>
              <h3 id="ward-font-size-title">글자 크기</h3>
              <p>화면 글자 크기 ({MIN_WARD_FONT_SIZE}px ~ {MAX_WARD_FONT_SIZE}px)</p>
            </div>
          </div>

          <div className={cx('settingsRangeWrap')}>
            <input
              className={cx('settingsRange')}
              type="range"
              min={MIN_WARD_FONT_SIZE}
              max={MAX_WARD_FONT_SIZE}
              value={settings.fontSize}
              aria-label="화면 글자 크기"
              style={rangeStyle}
              onChange={event => onSettingsChange({ fontSize: clampFontSize(Number(event.target.value)) })}
            />
            <div className={cx('settingsRangeLabels')} aria-hidden="true">
              <span>{MIN_WARD_FONT_SIZE}px</span>
              <span>기본</span>
              <span>{MAX_WARD_FONT_SIZE}px</span>
            </div>
          </div>

          <p className={cx('settingsPreview')} style={{ fontSize: `${settings.fontSize}px` }}>
            현재: <strong>{settings.fontSize}px</strong> — 글자가 이렇게 보입니다.
          </p>
        </section>

        <section className={cx('settingsCard')} aria-labelledby="ward-display-title">
          <div className={cx('settingsCardHeader')}>
            <span className={cx('settingsNumber')}>2</span>
            <div>
              <h3 id="ward-display-title">화면</h3>
              <p>화면의 글자와 테두리 표시 방식을 조정합니다.</p>
            </div>
          </div>

          <label className={cx('settingsCheckRow')}>
            <input
              type="checkbox"
              checked={settings.highContrast}
              onChange={event => onSettingsChange({ highContrast: event.target.checked })}
            />
            <span>고대비(진한 글자) 켜기</span>
          </label>
          <p className={cx('settingsHelp')}>체크 시 글자와 테두리를 더 또렷하게 표시합니다. (이 기기에만 저장)</p>
        </section>

        <section className={cx('settingsCard')} aria-labelledby="ward-sos-title">
          <div className={cx('settingsCardHeader')}>
            <span className={cx('settingsNumber')}>3</span>
            <div>
              <h3 id="ward-sos-title">SOS 동작 설정</h3>
              <p>긴급 SOS를 눌렀을 때 어떻게 동작할지 선택합니다.</p>
            </div>
          </div>

          <div className={cx('settingsRadioGroup')} role="radiogroup" aria-labelledby="ward-sos-title">
            {WARD_SOS_OPTIONS.map(option => (
              <label
                key={option.value}
                className={cx('settingsRadioCard', { active: settings.sosAction === option.value })}
              >
                <input
                  type="radio"
                  name="ward-sos-action"
                  value={option.value}
                  checked={settings.sosAction === option.value}
                  onChange={() => onSettingsChange({ sosAction: option.value })}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </section>
      </div>
    </section>
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
      <p>
        이 화면은 역할별 route group 안에 분리되어 있습니다. 이후 실제 API와 상세 기능을 이 페이지 단위로 연결하면
        됩니다.
      </p>
    </section>
  );
}
