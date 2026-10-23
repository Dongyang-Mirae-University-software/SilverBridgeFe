// 피보호자 SOS 화면 흐름 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)
// 119 키패드 모양만 바뀌었고(2026-10-23) sosAction 에 따른 열기 흐름·보호자 알림 전송은 그대로임을 고정한다
// 점검 반영(2026-10-23): 키패드에 보호자 알림 전송 결과를 보이고, 보호자가 없어도 SOS 이력을 남긴다

import { Fragment, useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import useModalStore from '@/store/modalStore';
import { setGuardianNotifyStatus } from './guardianNotifyStatus';
import WardSosContent from './WardSosContent';

const mocks = vi.hoisted(() => ({
  sosAction: 'CALL_119_AND_NOTIFY' as 'CALL_119_AND_NOTIFY' | 'NOTIFY_GUARDIAN_FIRST',
  hasActiveGuardians: true,
  triggerSosAsync: vi.fn(),
  triggerSos: vi.fn(),
}));

vi.mock('@/components/layout/dashboard/DashboardContext', () => ({
  useDashboard: () => ({ wardSettings: { sosAction: mocks.sosAction } }),
}));
vi.mock('@/hooks/useActiveConnections', () => ({
  useWardActiveGuardians: () => ({
    activeGuardians: [],
    hasActiveGuardians: mocks.hasActiveGuardians,
    isLoading: false,
    isError: false,
  }),
}));
vi.mock('@/service/query/ward', () => ({
  useWardSosMutation: () => ({ mutate: mocks.triggerSos, mutateAsync: mocks.triggerSosAsync }),
}));
// 보호자 전화(실제 전화 링크)는 이번 작업 범위 밖이라 그리지 않는다
vi.mock('./WardGuardianCallSection', () => ({ WardGuardianCallSection: () => null }));

// ModalHost 는 next/navigation 에 묶여 있어 테스트에서는 모달 저장소만 그린다.
// 저장소는 모듈 전역이라 테스트마다 호스트가 붙을 때 이전 테스트의 모달을 비운다
function TestModalHost() {
  const modals = useModalStore(state => state.modals);
  const resetModal = useModalStore(state => state.resetModal);
  useEffect(() => resetModal(), [resetModal]);
  return (
    <>
      {modals.map(modal => (
        <Fragment key={modal.id}>{modal.Component}</Fragment>
      ))}
    </>
  );
}

function renderPage() {
  return render(
    <>
      <WardSosContent />
      <TestModalHost />
    </>,
  );
}

describe('WardSosContent (Chrome)', () => {
  beforeEach(() => {
    mocks.hasActiveGuardians = true;
    mocks.triggerSosAsync.mockReset().mockResolvedValue({ sosEventId: 7, triggeredAt: '2026-10-23T06:00:00Z' });
    mocks.triggerSos.mockReset();
  });
  afterEach(() => {
    document.body.innerHTML = '';
    setGuardianNotifyStatus(null);
  });

  it('CALL_119_AND_NOTIFY - 119 키패드가 응답 전에 열리고, 응답을 받은 뒤에야 "알렸어요"로 바뀐다', async () => {
    mocks.sosAction = 'CALL_119_AND_NOTIFY';
    let resolveSos: (value: unknown) => void = () => {};
    mocks.triggerSosAsync.mockReturnValue(new Promise(resolve => (resolveSos = resolve)));
    const screen = renderPage();

    await screen.getByRole('button', { name: /긴급 SOS/ }).click();

    await expect.element(screen.getByRole('dialog', { name: /119 신고 키패드/ })).toBeVisible();
    await expect.element(screen.getByLabelText('입력된 번호')).toHaveTextContent('119');
    await expect.element(screen.getByText('보호자에게 알리는 중이에요…')).toBeVisible();
    expect(screen.getByText('보호자에게도 알렸어요').query()).toBeNull();
    expect(mocks.triggerSosAsync).toHaveBeenCalledTimes(1);

    resolveSos({ sosEventId: 7, triggeredAt: '2026-10-23T06:00:00Z' });
    await expect.element(screen.getByText('보호자에게도 알렸어요')).toBeVisible();
  });

  it('CALL_119_AND_NOTIFY - 전송이 실패하면 키패드에 "알리지 못했어요"가 보이고 실패 안내가 위에 뜬다', async () => {
    mocks.sosAction = 'CALL_119_AND_NOTIFY';
    mocks.triggerSosAsync.mockRejectedValue({ message: '서버 오류' });
    const screen = renderPage();

    await screen.getByRole('button', { name: /긴급 SOS/ }).click();

    await expect.element(screen.getByText('SOS 전송 실패')).toBeVisible();
    await expect.element(screen.getByText('보호자에게 알리지 못했어요')).toBeInTheDocument();
    expect(screen.getByText('보호자에게도 알렸어요').query()).toBeNull();
  });

  it('NOTIFY_GUARDIAN_FIRST - 알림 완료 뒤 [119 화면 열기]를 눌러야 키패드가 열린다', async () => {
    mocks.sosAction = 'NOTIFY_GUARDIAN_FIRST';
    const screen = renderPage();

    await screen.getByRole('button', { name: /긴급 SOS/ }).click();

    await expect.element(screen.getByText('SOS 전송 완료')).toBeVisible();
    expect(screen.getByRole('dialog', { name: /119 신고 키패드/ }).query()).toBeNull();
    expect(mocks.triggerSosAsync).toHaveBeenCalledTimes(1);

    await screen.getByRole('button', { name: '119 화면 열기' }).click();
    await expect.element(screen.getByRole('dialog', { name: /119 신고 키패드/ })).toBeVisible();
    await expect.element(screen.getByText('보호자에게도 알렸어요')).toBeVisible();
  });

  it('연결된 보호자가 없어도 SOS 이력을 남기고(전송 1회) 119 키패드를 바로 연다 - 보호자 안내는 없다', async () => {
    mocks.sosAction = 'NOTIFY_GUARDIAN_FIRST';
    mocks.hasActiveGuardians = false;
    const screen = renderPage();

    await screen.getByRole('button', { name: /긴급 SOS/ }).click();

    await expect.element(screen.getByRole('dialog', { name: /119 신고 키패드/ })).toBeVisible();
    expect(mocks.triggerSosAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/보호자에게/).query()).toBeNull();
    expect(screen.getByText('SOS 전송 완료').query()).toBeNull();
  });

  it('연결된 보호자가 없을 때 전송이 실패해도 실패 창을 띄우지 않는다(알릴 사람이 없다)', async () => {
    mocks.hasActiveGuardians = false;
    mocks.triggerSosAsync.mockRejectedValue({ message: '서버 오류' });
    const screen = renderPage();

    await screen.getByRole('button', { name: /긴급 SOS/ }).click();

    await expect.element(screen.getByRole('dialog', { name: /119 신고 키패드/ })).toBeVisible();
    await vi.waitFor(() => expect(mocks.triggerSosAsync).toHaveBeenCalledTimes(1));
    expect(screen.getByText('SOS 전송 실패').query()).toBeNull();
  });
});
