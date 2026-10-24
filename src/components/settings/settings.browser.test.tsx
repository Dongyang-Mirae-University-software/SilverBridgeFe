// 환경설정 공용 섹션 테스트(알림 종류·알림 방법·비밀번호 변경·탈퇴) - 실제 Chrome에서 돈다(`npm run test:browser`)

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from '@vitest/browser/context';
import { render } from 'vitest-browser-react';

import { AccountDeleteSection } from './AccountDeleteSection';
import { AlertTypeSettingsSection } from './AlertTypeSettingsSection';
import { NotificationSettingsSection } from './NotificationSettingsSection';
import { PasswordChangeSection } from './PasswordChangeSection';

const api = vi.hoisted(() => ({
  getGuardianNotificationTypeSetting: vi.fn(),
  updateGuardianNotificationTypeSetting: vi.fn(),
  getMyNotificationSettings: vi.fn(),
  updateMyNotificationSettings: vi.fn(),
  deleteMyAccount: vi.fn(),
  changeMyPassword: vi.fn(),
}));

vi.mock('@/service/api/guardian/notification', () => ({
  getGuardianNotificationTypeSetting: api.getGuardianNotificationTypeSetting,
  updateGuardianNotificationTypeSetting: api.updateGuardianNotificationTypeSetting,
}));
vi.mock('@/service/api/user/notification', () => ({
  getMyNotificationSettings: api.getMyNotificationSettings,
  updateMyNotificationSettings: api.updateMyNotificationSettings,
}));
vi.mock('@/service/api/user/user', () => ({
  deleteMyAccount: api.deleteMyAccount,
  changeMyPassword: api.changeMyPassword,
}));

const toast = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock('@/store/toastStore', () => ({ showToast: toast.showToast }));

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: nav.replace }) }));
vi.mock('@/lib/auth/tokenStore', () => ({ clearAuthTokens: vi.fn() }));
vi.mock('@/components/Icon', () => ({ Icon: () => <span data-testid="icon" /> }));

const TYPE_SETTING = {
  sos: { enabled: true, required: true },
  anomalyDetection: { enabled: true, required: true },
  anomalyReviewReminder: { enabled: true, required: false },
  medication: { enabled: true, required: false },
  cameraLinkLost: { enabled: true, required: false },
};

const CHANNEL_RESPONSE = {
  data: {
    data: {
      settings: [
        { channelType: 'FCM', enabled: true },
        { channelType: 'SMS', enabled: false },
        { channelType: 'KAKAO_ALIMTALK', enabled: true },
        { channelType: 'EMAIL', enabled: false },
      ],
    },
  },
};

// 서버 5xx를 흉내 낸 실패
const serverError = () => Object.assign(new Error('Internal Server Error'), { status: 500 });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function withClient(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

beforeEach(() => {
  api.getGuardianNotificationTypeSetting.mockResolvedValue(TYPE_SETTING);
  api.getMyNotificationSettings.mockResolvedValue(CHANNEL_RESPONSE);
});

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('알림 종류 (보호자)', () => {
  it('SOS·이상 감지는 끄는 스위치 없이 "항상 받아요"로만 보인다', async () => {
    const screen = render(withClient(<AlertTypeSettingsSection />));
    await expect.element(screen.getByText('SOS 알림')).toBeInTheDocument();

    expect(screen.getByText('항상 받아요').elements()).toHaveLength(2);
    expect(screen.getByRole('switch', { name: 'SOS 알림' }).elements()).toHaveLength(0);
    expect(screen.getByRole('switch', { name: '이상 감지 알림' }).elements()).toHaveLength(0);
    // 끌 수 있는 것은 판정 재촉·카메라 연결 끊김·복약 셋뿐
    expect(screen.getByRole('switch').elements()).toHaveLength(3);
    // BE가 보내지 않는 알림은 설정을 만들지 않는다
    expect(document.body.textContent).not.toContain('정서 변화');
    expect(document.body.textContent).not.toContain('병원 예약');
  });

  it('토글하면 바로 반영되고 그 값으로 저장한다', async () => {
    api.updateGuardianNotificationTypeSetting.mockResolvedValue({
      ...TYPE_SETTING,
      cameraLinkLost: { enabled: false, required: false },
    });
    const screen = render(withClient(<AlertTypeSettingsSection />));
    const toggle = screen.getByRole('switch', { name: '카메라 연결 끊김 안내' });
    await expect.element(toggle).toBeChecked();

    await toggle.click();

    await expect.element(toggle).not.toBeChecked();
    expect(api.updateGuardianNotificationTypeSetting).toHaveBeenCalledWith({ cameraLinkLost: false });
    expect(toast.showToast).not.toHaveBeenCalled();
  });

  it('저장 중에는 다른 토글을 막고, 서버 오류면 이전 값으로 되돌리고 안내한다', async () => {
    const pending = deferred<unknown>();
    api.updateGuardianNotificationTypeSetting.mockReturnValue(pending.promise);
    const screen = render(withClient(<AlertTypeSettingsSection />));
    const medication = screen.getByRole('switch', { name: '복약 알림' });
    await expect.element(medication).toBeChecked();

    await medication.click();
    await expect.element(medication).not.toBeChecked();
    await expect.element(screen.getByRole('switch', { name: '이상 감지 확인 요청' })).toBeDisabled();

    pending.reject(serverError());

    await expect.element(medication).toBeChecked();
    await expect.element(medication).toBeEnabled();
    expect(api.updateGuardianNotificationTypeSetting).toHaveBeenCalledTimes(1);
    expect(toast.showToast).toHaveBeenCalledWith(expect.stringContaining('저장하지 못했어요'), { variant: 'error' });
  });
});

describe('알림 방법 (채널)', () => {
  it('네 채널을 디자인 순서로 보여 주고 이메일도 켤 수 있다', async () => {
    const screen = render(withClient(<NotificationSettingsSection />));
    await expect.element(screen.getByRole('switch', { name: '푸시 알림' })).toBeChecked();

    const labels = screen.getByRole('switch').elements().map(el => el.getAttribute('aria-label'));
    expect(labels).toEqual(['카카오톡 알림톡', '푸시 알림', 'SMS 문자', '이메일 알림']);
    await expect.element(screen.getByRole('switch', { name: '이메일 알림' })).toBeEnabled();
    expect(document.body.textContent).not.toContain('준비 중');
  });

  it('서버 오류면 화면 값을 되돌리고 안내한다', async () => {
    const pending = deferred<unknown>();
    api.updateMyNotificationSettings.mockReturnValue(pending.promise);
    const screen = render(withClient(<NotificationSettingsSection />));
    const sms = screen.getByRole('switch', { name: 'SMS 문자' });
    await expect.element(sms).not.toBeChecked();

    await sms.click();
    await expect.element(sms).toBeChecked();
    // 저장 중 다시 누르기 방지
    await expect.element(screen.getByRole('switch', { name: '이메일 알림' })).toBeDisabled();

    pending.reject(serverError());

    await expect.element(sms).not.toBeChecked();
    expect(api.updateMyNotificationSettings).toHaveBeenCalledWith({ settings: [{ channelType: 'SMS', enabled: true }] });
    expect(toast.showToast).toHaveBeenCalledWith(expect.stringContaining('저장하지 못했어요'), { variant: 'error' });
  });
});

describe('비밀번호 변경', () => {
  it('카카오 가입 계정은 변경 버튼이 없다', async () => {
    const screen = render(withClient(<PasswordChangeSection isKakaoUser />));
    await expect.element(screen.getByText('비밀번호 변경')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: '변경' }).elements()).toHaveLength(0);
    await expect.element(screen.getByText(/카카오로 가입한 계정은/)).toBeInTheDocument();
  });

  it('일반 계정은 현재 비밀번호로 변경 요청을 보낸다', async () => {
    api.changeMyPassword.mockResolvedValue({});
    const screen = render(withClient(<PasswordChangeSection isKakaoUser={false} variant="ward" />));
    await screen.getByRole('button', { name: '변경' }).click();

    await screen.getByLabelText('현재 비밀번호').fill('old-pass-1');
    await screen.getByLabelText('새 비밀번호 (8자 이상)').fill('new-pass-1');
    await screen.getByLabelText('새 비밀번호 한 번 더').fill('new-pass-1');
    await screen.getByRole('button', { name: '변경하기' }).click();

    await expect.poll(() => api.changeMyPassword.mock.calls[0]?.[0]).toEqual({
      currentPassword: 'old-pass-1',
      newPassword: 'new-pass-1',
    });
  });
});

describe('회원 탈퇴', () => {
  it('일반 계정: 확인 → 비밀번호 입력 두 단계를 거쳐야 요청한다', async () => {
    api.deleteMyAccount.mockResolvedValue({});
    const screen = render(withClient(<AccountDeleteSection isKakaoUser={false} />));

    await screen.getByRole('button', { name: '탈퇴' }).click();
    await expect.element(screen.getByText('정말 탈퇴하시겠습니까?')).toBeInTheDocument();
    await expect.element(screen.getByText('복구할 수 없습니다.')).toBeInTheDocument();
    expect(api.deleteMyAccount).not.toHaveBeenCalled();

    await screen.getByRole('button', { name: '계속하기' }).click();
    await screen.getByRole('button', { name: '탈퇴하기' }).click();
    await expect.element(screen.getByText('비밀번호를 입력해 주세요.', { exact: true })).toBeInTheDocument();
    expect(api.deleteMyAccount).not.toHaveBeenCalled();

    await screen.getByLabelText('비밀번호').fill('my-pass-1');
    await screen.getByRole('button', { name: '탈퇴하기' }).click();

    await expect.poll(() => api.deleteMyAccount.mock.calls[0]?.[0]).toEqual({ password: 'my-pass-1' });
    await expect.poll(() => nav.replace.mock.calls[0]?.[0]).toBe('/login');
  });

  it('카카오 계정: "탈퇴"를 입력해야 하고 "회원탈퇴"도 받는다', async () => {
    api.deleteMyAccount.mockResolvedValue({});
    const screen = render(withClient(<AccountDeleteSection isKakaoUser variant="ward" />));

    await screen.getByRole('button', { name: '탈퇴' }).click();
    await expect.element(screen.getByText('정말 탈퇴하시겠어요?')).toBeInTheDocument();
    await expect.element(screen.getByText(/보호자와의 연결도 끊어져요/)).toBeInTheDocument();
    await screen.getByRole('button', { name: '계속하기' }).click();

    const input = screen.getByLabelText('탈퇴 확인 문구');
    await input.fill('탈 퇴');
    await screen.getByRole('button', { name: '탈퇴하기' }).click();
    await expect.element(screen.getByText('"탈퇴"를 정확히 입력해 주세요.')).toBeInTheDocument();
    expect(api.deleteMyAccount).not.toHaveBeenCalled();

    await input.fill(' 회원탈퇴 ');
    await screen.getByRole('button', { name: '탈퇴하기' }).click();
    await expect.poll(() => api.deleteMyAccount.mock.calls[0]?.[0]).toEqual({ confirmation: '회원탈퇴' });
  });

  it('카카오 계정: "탈퇴" 입력으로 요청한다', async () => {
    api.deleteMyAccount.mockResolvedValue({});
    const screen = render(withClient(<AccountDeleteSection isKakaoUser />));

    await screen.getByRole('button', { name: '탈퇴' }).click();
    await screen.getByRole('button', { name: '계속하기' }).click();
    await screen.getByLabelText('탈퇴 확인 문구').fill('탈퇴');
    await screen.getByRole('button', { name: '탈퇴하기' }).click();

    await expect.poll(() => api.deleteMyAccount.mock.calls[0]?.[0]).toEqual({ confirmation: '탈퇴' });
  });
});

describe('레이아웃 (375px)', () => {
  // 앱 레이아웃처럼 스크롤 영역 안에 두고, 숨김 input이 바깥 문서를 늘리지 않는지 본다(#114)
  it('설정 섹션이 가로로 넘치지 않고 바깥 문서 스크롤을 만들지 않는다', async () => {
    await page.viewport(375, 812);
    const scroller = document.createElement('div');
    scroller.style.cssText = 'position:fixed;inset:0;overflow:auto;padding:16px;box-sizing:border-box;';
    document.body.style.margin = '0';
    document.body.appendChild(scroller);

    const screen = render(
      withClient(
        <>
          <AlertTypeSettingsSection />
          <NotificationSettingsSection />
          <PasswordChangeSection isKakaoUser={false} />
          <AccountDeleteSection isKakaoUser={false} />
        </>,
      ),
      { container: scroller },
    );
    await expect.element(screen.getByRole('switch', { name: '푸시 알림' })).toBeInTheDocument();
    await expect.element(screen.getByRole('switch', { name: '복약 알림' })).toBeInTheDocument();

    expect(window.innerWidth).toBe(375);
    expect(document.documentElement.scrollHeight).toBe(window.innerHeight);
    expect(document.documentElement.scrollWidth).toBe(window.innerWidth);
    expect(scroller.scrollWidth).toBe(scroller.clientWidth);

    // 숨김 input은 토글 안에 갇혀 있다
    for (const input of screen.getByRole('switch').elements()) {
      const box = input.getBoundingClientRect();
      const toggle = input.parentElement!.getBoundingClientRect();
      expect(box.left).toBeGreaterThanOrEqual(toggle.left);
      expect(box.right).toBeLessThanOrEqual(toggle.right);
      expect(box.bottom).toBeLessThanOrEqual(toggle.bottom);
    }
  });
});
