// 피보호자 SOS 화면 흐름 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)
// 119 키패드 모양만 바뀌었고(2026-10-23) sosAction 에 따른 열기 흐름·보호자 알림 전송은 그대로임을 고정한다
// 점검 반영(2026-10-23): 보호자가 없어도 SOS 이력을 남긴다. 키패드에는 보호자 알림 문구를 띄우지 않는다(사용자 결정)
// 2026-11-19(사용자 결정): 확인 창 없이 누르면 바로 보낸다 - 연타해도 한 번만 보내는지 함께 고정한다

import { Fragment, useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import useModalStore from '@/store/modalStore';
import WardSosContent from './WardSosContent';

const mocks = vi.hoisted(() => ({
  sosAction: 'CALL_119_AND_NOTIFY' as 'CALL_119_AND_NOTIFY' | 'NOTIFY_GUARDIAN_FIRST',
  hasActiveGuardians: true,
  guardiansError: false,
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
    isError: mocks.guardiansError,
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

// 누르면 확인 창 없이 바로 보낸다(2026-11-19)
async function pressSos(screen: Awaited<ReturnType<typeof render>>) {
  await screen.getByRole('button', { name: /도움이 필요하면 누르세요/ }).click();
  expect(screen.getByText('긴급 SOS를 보낼까요?').query()).toBeNull();
}

// 같은 작업 안에서 두 번 누른다 - 렌더(버튼 비활성) 전에 두 번째 클릭이 들어오는 연타
function doubleTapSos(screen: Awaited<ReturnType<typeof render>>) {
  const hero = screen.getByRole('button', { name: /도움이 필요하면 누르세요/ }).element() as HTMLButtonElement;
  hero.click();
  hero.click();
}

describe('WardSosContent (Chrome)', () => {
  beforeEach(() => {
    mocks.hasActiveGuardians = true;
    mocks.guardiansError = false;
    mocks.triggerSosAsync.mockReset().mockResolvedValue({ sosEventId: 7, triggeredAt: '2026-10-23T06:00:00Z' });
    mocks.triggerSos.mockReset();
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('CALL_119_AND_NOTIFY - 누르면 확인 창 없이 119 키패드가 응답 전에 열리고, 응답 뒤에도 보호자 알림 문구 없이 키패드만 보인다', async () => {
    mocks.sosAction = 'CALL_119_AND_NOTIFY';
    let resolveSos: (value: unknown) => void = () => {};
    mocks.triggerSosAsync.mockReturnValue(new Promise(resolve => (resolveSos = resolve)));
    const screen = await renderPage();

    await pressSos(screen);

    await expect.element(screen.getByRole('dialog', { name: /119 신고 키패드/ })).toBeVisible();
    await expect.element(screen.getByLabelText('입력된 번호')).toMatchTextContent('119');
    expect(screen.getByText(/보호자에게/).query()).toBeNull();
    expect(mocks.triggerSosAsync).toHaveBeenCalledTimes(1);

    resolveSos({ sosEventId: 7, triggeredAt: '2026-10-23T06:00:00Z' });
    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: /도움이 필요하면 누르세요/ }).element()).toBeEnabled(),
    );
    await expect.element(screen.getByRole('dialog', { name: /119 신고 키패드/ })).toBeVisible();
    expect(screen.getByText(/보호자에게/).query()).toBeNull();
  });

  it('CALL_119_AND_NOTIFY - 전송이 실패하면 키패드 위에 실패 안내가 뜬다', async () => {
    mocks.sosAction = 'CALL_119_AND_NOTIFY';
    mocks.triggerSosAsync.mockRejectedValue({ message: '서버 오류' });
    const screen = await renderPage();

    await pressSos(screen);

    await expect.element(screen.getByText('SOS 전송 실패')).toBeVisible();
    await expect.element(screen.getByRole('dialog', { name: /119 신고 키패드/ })).toBeInTheDocument();
  });

  it('NOTIFY_GUARDIAN_FIRST - 실패 창에서 [119 화면 열기]·[다시 보내기]를 고를 수 있다 (QA CONN-A19)', async () => {
    mocks.sosAction = 'NOTIFY_GUARDIAN_FIRST';
    mocks.triggerSosAsync.mockRejectedValueOnce({ message: '서버 오류' });
    const screen = await renderPage();

    await pressSos(screen);
    await expect.element(screen.getByText('SOS 전송 실패')).toBeVisible();

    await screen.getByRole('button', { name: '다시 보내기' }).click();
    await expect.element(screen.getByText('보호자에게 알렸어요')).toBeVisible();
    expect(mocks.triggerSosAsync).toHaveBeenCalledTimes(2);
  });

  it('NOTIFY_GUARDIAN_FIRST - 실패 창의 [119 화면 열기]로 키패드를 연다', async () => {
    mocks.sosAction = 'NOTIFY_GUARDIAN_FIRST';
    mocks.triggerSosAsync.mockRejectedValue({ message: '서버 오류' });
    const screen = await renderPage();

    await pressSos(screen);
    await screen.getByRole('button', { name: '119 화면 열기' }).click();

    await expect.element(screen.getByRole('dialog', { name: /119 신고 키패드/ })).toBeVisible();
  });

  it('인터넷이 끊겼으면 보내는 중에 갇히지 않고 바로 실패 창을 띄운다 (QA CONN-A19)', async () => {
    mocks.sosAction = 'NOTIFY_GUARDIAN_FIRST';
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const screen = await renderPage();

    await pressSos(screen);

    await expect.element(screen.getByText('인터넷이 끊겼어요. 119 화면을 열어 직접 전화해 주세요.')).toBeVisible();
    expect(mocks.triggerSosAsync).not.toHaveBeenCalled();
    await expect.element(screen.getByRole('button', { name: /도움이 필요하면 누르세요/ })).toBeEnabled();
    onLine.mockRestore();
  });

  it('NOTIFY_GUARDIAN_FIRST - 알림 완료 뒤 [119 화면 열기]를 눌러야 키패드가 열린다', async () => {
    mocks.sosAction = 'NOTIFY_GUARDIAN_FIRST';
    const screen = await renderPage();

    await pressSos(screen);

    await expect.element(screen.getByText('보호자에게 알렸어요')).toBeVisible();
    expect(screen.getByRole('dialog', { name: /119 신고 키패드/ }).query()).toBeNull();
    expect(mocks.triggerSosAsync).toHaveBeenCalledTimes(1);

    await screen.getByRole('button', { name: '119 화면 열기' }).click();
    await expect.element(screen.getByRole('dialog', { name: /119 신고 키패드/ })).toBeVisible();
    expect(screen.getByText('보호자에게도 알렸어요').query()).toBeNull();
  });

  it('연결된 보호자가 없어도 SOS 이력을 남기고(전송 1회) 119 키패드를 바로 연다 - 보호자 안내는 없다', async () => {
    mocks.sosAction = 'NOTIFY_GUARDIAN_FIRST';
    mocks.hasActiveGuardians = false;
    const screen = await renderPage();

    await pressSos(screen);

    await expect.element(screen.getByRole('dialog', { name: /119 신고 키패드/ })).toBeVisible();
    expect(mocks.triggerSosAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/보호자에게/).query()).toBeNull();
    expect(screen.getByText('보호자에게 알렸어요').query()).toBeNull();
  });

  it('연결된 보호자가 없을 때 전송이 실패해도 실패 창을 띄우지 않는다(알릴 사람이 없다)', async () => {
    mocks.hasActiveGuardians = false;
    mocks.triggerSosAsync.mockRejectedValue({ message: '서버 오류' });
    const screen = await renderPage();

    await pressSos(screen);

    await expect.element(screen.getByRole('dialog', { name: /119 신고 키패드/ })).toBeVisible();
    await vi.waitFor(() => expect(mocks.triggerSosAsync).toHaveBeenCalledTimes(1));
    expect(screen.getByText('SOS 전송 실패').query()).toBeNull();
  });

  it('누르는 즉시 버튼이 잠기고 "보내는 중이에요…"가 보인다', async () => {
    mocks.sosAction = 'NOTIFY_GUARDIAN_FIRST';
    mocks.triggerSosAsync.mockReturnValue(new Promise(() => {}));
    const screen = await renderPage();

    await pressSos(screen);

    const hero = screen.getByRole('button', { name: /보내는 중이에요/ });
    await expect.element(hero).toBeDisabled();
    expect(mocks.triggerSosAsync).toHaveBeenCalledTimes(1);
  });

  it.each(['CALL_119_AND_NOTIFY', 'NOTIFY_GUARDIAN_FIRST'] as const)('%s - 연타해도 SOS는 한 번만 보낸다', async action => {
    mocks.sosAction = action;
    mocks.triggerSosAsync.mockReturnValue(new Promise(() => {}));
    const screen = await renderPage();

    doubleTapSos(screen);

    await vi.waitFor(() => expect(mocks.triggerSosAsync).toHaveBeenCalledTimes(1));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(mocks.triggerSosAsync).toHaveBeenCalledTimes(1);
    if (action === 'CALL_119_AND_NOTIFY') {
      await vi.waitFor(() => expect(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).toHaveLength(1));
    }
  });

  it('연결된 보호자가 없을 때 연타해도 한 번만 보내고 키패드도 하나만 연다', async () => {
    mocks.hasActiveGuardians = false;
    mocks.triggerSosAsync.mockReturnValue(new Promise(() => {}));
    const screen = await renderPage();

    doubleTapSos(screen);

    await vi.waitFor(() => expect(mocks.triggerSosAsync).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).toHaveLength(1));
  });

  it('전송이 끝나면 잠금이 풀려 다시 보낼 수 있다', async () => {
    mocks.sosAction = 'NOTIFY_GUARDIAN_FIRST';
    const screen = await renderPage();

    await pressSos(screen);
    await expect.element(screen.getByText('보호자에게 알렸어요')).toBeVisible();
    await screen.getByRole('button', { name: '닫기' }).click();
    await pressSos(screen);

    await vi.waitFor(() => expect(mocks.triggerSosAsync).toHaveBeenCalledTimes(2));
  });

  describe('보호자 목록 조회가 실패했을 때 (점검 H-1) - 보호자가 있다고 보고 실패를 알린다', () => {
    beforeEach(() => {
      mocks.hasActiveGuardians = false;
      mocks.guardiansError = true;
    });

    it('NOTIFY_GUARDIAN_FIRST - 전송이 실패하면 실패 창을 띄운다(조용히 묻히지 않는다)', async () => {
      mocks.sosAction = 'NOTIFY_GUARDIAN_FIRST';
      mocks.triggerSosAsync.mockRejectedValue({ message: '서버 오류' });
      const screen = await renderPage();

      await pressSos(screen);

      await expect.element(screen.getByText('SOS 전송 실패')).toBeVisible();
      expect(screen.getByRole('dialog', { name: /119 신고 키패드/ }).query()).toBeNull();
    });

    it('NOTIFY_GUARDIAN_FIRST - 전송이 되면 "보호자에게 알렸어요"를 띄운다', async () => {
      mocks.sosAction = 'NOTIFY_GUARDIAN_FIRST';
      const screen = await renderPage();

      await pressSos(screen);

      await expect.element(screen.getByText('보호자에게 알렸어요')).toBeVisible();
      expect(mocks.triggerSosAsync).toHaveBeenCalledTimes(1);
    });

    it('CALL_119_AND_NOTIFY - 키패드를 바로 열고, 전송이 실패하면 키패드 위에 실패 창을 띄운다', async () => {
      mocks.sosAction = 'CALL_119_AND_NOTIFY';
      mocks.triggerSosAsync.mockRejectedValue({ message: '서버 오류' });
      const screen = await renderPage();

      await pressSos(screen);

      await expect.element(screen.getByText('SOS 전송 실패')).toBeVisible();
      await expect.element(screen.getByRole('dialog', { name: /119 신고 키패드/ })).toBeInTheDocument();
    });
  });

  it('CALL_119_AND_NOTIFY - 인터넷이 끊겼으면 키패드를 열고 그 위에 실패 창을 띄우며 전송하지 않는다', async () => {
    mocks.sosAction = 'CALL_119_AND_NOTIFY';
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const screen = await renderPage();

    await pressSos(screen);

    await expect.element(screen.getByText('인터넷이 끊겼어요. 119 화면을 열어 직접 전화해 주세요.')).toBeVisible();
    await expect.element(screen.getByRole('dialog', { name: /119 신고 키패드/ })).toBeInTheDocument();
    expect(mocks.triggerSosAsync).not.toHaveBeenCalled();
    // 키패드가 이미 열려 있으니 [119 화면 열기]는 실패 창만 닫는다(키패드를 하나 더 열지 않는다)
    await screen.getByRole('button', { name: '119 화면 열기' }).click();
    expect(document.querySelectorAll('[role="dialog"][aria-label^="119 신고 키패드"]')).toHaveLength(1);
    onLine.mockRestore();
  });

  it('보이지 않는 h1 "긴급 전화"를 둔다(시안에는 제목이 없다)', async () => {
    const screen = await renderPage();
    await expect.element(screen.getByRole('heading', { name: '긴급 전화', level: 1 })).toBeInTheDocument();
  });
});
