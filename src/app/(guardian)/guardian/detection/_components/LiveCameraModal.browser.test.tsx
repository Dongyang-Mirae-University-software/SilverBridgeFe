// 실시간 카메라 모달 컴포넌트 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import type { GuardianCameraLiveStatus, GuardianLiveCamera } from '@/service/interface/guardian/camera';
import { LiveCameraModal } from './LiveCameraModal';

const monitorState = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('./useGuardianMonitor', () => ({ useGuardianMonitor: () => monitorState.value }));

const CAMERA: GuardianLiveCamera = {
  sessionId: 'ward_abc',
  wardId: 'W1',
  wardName: '김순자',
  label: '거실',
  status: 'running',
  lastFrameAt: null,
};

function setMonitor({
  frameSrc = null,
  status = 'running',
  streamErrorMessage = null,
}: {
  frameSrc?: string | null;
  status?: GuardianCameraLiveStatus;
  streamErrorMessage?: string | null;
}) {
  monitorState.value = {
    isLoading: false,
    isEmpty: false,
    sessions: [{ ...CAMERA, status }],
    selectedId: CAMERA.sessionId,
    selectedSession: { ...CAMERA, status },
    sessionStatus: { status, lastFrameAt: null, fps: null, isAnalyzing: false, analysis: null },
    selectSession: vi.fn(),
    frameSrc,
    streamErrorMessage,
    onStreamError: vi.fn(),
  };
}

describe('LiveCameraModal (Chrome)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('닫으면(언마운트) 영상 <img>의 src를 지워 연결을 끊는다', async () => {
    // 응답이 끝나지 않는 주소 대신 빈 이미지 - src 속성이 지워지는지만 본다
    setMonitor({ frameSrc: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' });
    const screen = render(<LiveCameraModal onClose={() => undefined} />);
    await expect.element(screen.getByRole('img', { name: '실시간 영상' })).toBeInTheDocument();
    const img = document.querySelector('img')!;
    expect(img.hasAttribute('src')).toBe(true);

    screen.unmount();
    expect(img.hasAttribute('src')).toBe(false);
  });

  it('상태를 모르면(status=null) "확인 중"으로 보이고 켜짐·꺼짐으로 채우지 않는다', async () => {
    setMonitor({ status: null });
    const screen = render(<LiveCameraModal onClose={() => undefined} />);

    await expect.element(screen.getByText('연결 상태를 확인하고 있어요')).toBeInTheDocument();
    await expect.element(screen.getByRole('button', { name: /거실/ })).toHaveTextContent('확인 중');
    expect(screen.getByText('영상이 오지 않아요').query()).toBeNull();
  });

  it('동시 시청 상한(429) 같은 서버 안내는 그대로 보인다', async () => {
    setMonitor({ streamErrorMessage: '동시에 볼 수 있는 영상 수를 넘었습니다.' });
    const screen = render(<LiveCameraModal onClose={() => undefined} />);

    await expect.element(screen.getByText('동시에 볼 수 있는 영상 수를 넘었습니다.')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });
});
