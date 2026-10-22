// 약 추가 모달 컴포넌트 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)
// API는 모듈 목으로 바꾸고, 사진 처리(createImageBitmap·canvas)는 Chrome 것을 그대로 쓴다

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { userEvent } from '@vitest/browser/context';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import type { MedicationOcrResponse } from '@/service/interface/medication';
import { MedicationAddModal } from './MedicationAddModal';

const api = vi.hoisted(() => ({
  recognizeMedicationEnvelope: vi.fn(),
  addWardMedicationBatch: vi.fn(),
}));

vi.mock('@/service/api/guardian/medication', async importOriginal => ({
  ...(await importOriginal<object>()),
  recognizeMedicationEnvelope: api.recognizeMedicationEnvelope,
  addWardMedicationBatch: api.addWardMedicationBatch,
}));

const OCR_TWO_DRUGS: MedicationOcrResponse = {
  readable: true,
  drugs: [
    { name: '타이레놀정', perDose: 0.5, timesPerDay: 2, days: 3, slots: ['MORNING', 'DINNER'], timing: '식후 30분', confidence: 'high' },
    { name: '무코스타정', perDose: 1, timesPerDay: 2, days: 3, slots: ['MORNING', 'DINNER'], timing: '식후 30분', confidence: 'low' },
  ],
};

// 하루 횟수가 다른 봉투(2026-10-22 실제 시험과 같은 모양 - 코싹엘정만 하루 2번)
const OCR_MIXED_TIMES: MedicationOcrResponse = {
  readable: true,
  drugs: [
    { name: '신일이부프로펜정', perDose: 1, timesPerDay: 3, days: 3, slots: ['MORNING', 'LUNCH', 'DINNER'], timing: null, confidence: 'high' },
    { name: '코싹엘정', perDose: 1, timesPerDay: 2, days: 3, slots: ['MORNING', 'LUNCH', 'DINNER'], timing: null, confidence: 'high' },
    { name: '뮤테란캡슐', perDose: 1, timesPerDay: 3, days: 3, slots: ['MORNING', 'LUNCH', 'DINNER'], timing: null, confidence: 'high' },
  ],
};
const ROW_3 = '하루 3번 · 신일이부프로펜정 외 1개';
const ROW_2 = '하루 2번 · 코싹엘정';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// 약과 무관한 합성 사진(실제 약 봉투 사진은 저장소에 넣지 않는다)
async function makePhoto(width = 400, height = 300) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#000';
  context.fillText('메모', 10, 20);
  const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
  return new File([blob], 'memo.png', { type: 'image/png' });
}

function renderModal(onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const screen = render(<MedicationAddModal wardId="W1" onClose={onClose} />, { wrapper });
  return { screen, onClose };
}

type Screen = ReturnType<typeof renderModal>['screen'];

// 휴대폰 카메라로 찍은 사진을 고른 것처럼 파일 입력에 넣는다
// (브라우저 안에서 만든 File은 userEvent.upload로 넘기면 내용이 전달되지 않아 DataTransfer로 직접 넣는다)
async function choosePhoto() {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  const transfer = new DataTransfer();
  transfer.items.add(await makePhoto());
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

const chip = (screen: Screen, name: string) => screen.getByRole('button', { name, exact: true });

describe('MedicationAddModal (Chrome)', () => {
  beforeEach(() => {
    api.recognizeMedicationEnvelope.mockReset();
    api.addWardMedicationBatch.mockReset();
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('인식 결과는 1/2 약 초안으로만 채우고 자동 등록하지 않는다', async () => {
    api.recognizeMedicationEnvelope.mockResolvedValue(OCR_TWO_DRUGS);
    const { screen } = renderModal();
    await choosePhoto();

    await expect.element(screen.getByText('✓ 약 2개를 찾았어요. 맞는지 확인해 주세요')).toBeVisible();
    await expect.element(screen.getByText('1 / 2')).toBeVisible();
    await expect.element(screen.getByLabelText('1번째 약 이름')).toHaveValue('타이레놀정');
    await expect.element(screen.getByText('반알')).toBeVisible();
    await expect.element(screen.getByText(/노란 칸은 글자를 정확히 읽지 못했을 수 있어요/)).toBeVisible();
    await expect.element(screen.getByRole('button', { name: '다시 찍기' })).toBeVisible();
    // 시간 드롭다운·메모 칸은 없다
    expect(document.querySelector('select')).toBeNull();
    expect(screen.getByPlaceholder('예) 식후 30분').query()).toBeNull();
    expect(api.addWardMedicationBatch).not.toHaveBeenCalled();
  });

  it('확신 low가 없으면 노란 칸 안내를 띄우지 않는다', async () => {
    api.recognizeMedicationEnvelope.mockResolvedValue(OCR_MIXED_TIMES);
    const { screen } = renderModal();
    await choosePhoto();
    await expect.element(screen.getByText(/약 3개를 찾았어요/)).toBeVisible();
    expect(screen.getByText(/노란 칸은/).query()).toBeNull();
  });

  it('보내는 사진은 Chrome에서 JPEG로 바뀐다', async () => {
    api.recognizeMedicationEnvelope.mockResolvedValue(OCR_TWO_DRUGS);
    const { screen } = renderModal();
    await choosePhoto();
    await expect.element(screen.getByText(/약 2개를 찾았어요/)).toBeVisible();

    const [wardId, image] = api.recognizeMedicationEnvelope.mock.calls[0] as [string, Blob];
    expect(wardId).toBe('W1');
    expect(image.type).toBe('image/jpeg');
  });

  it('읽는 중에는 탭을 바꿀 수 없다 (점검 M-1)', async () => {
    const pending = deferred<MedicationOcrResponse>();
    api.recognizeMedicationEnvelope.mockReturnValue(pending.promise);
    const { screen } = renderModal();
    await choosePhoto();

    await expect.element(screen.getByText('약 이름을 읽는 중…')).toBeVisible();
    await expect.element(screen.getByRole('tab', { name: '직접 쓰기' })).toBeDisabled();
    pending.resolve(OCR_TWO_DRUGS);
    await expect.element(screen.getByRole('tab', { name: '직접 쓰기' })).toBeEnabled();
  });

  it('닫으면(언마운트) 진행 중인 인식 요청을 취소한다', async () => {
    const pending = deferred<MedicationOcrResponse>();
    api.recognizeMedicationEnvelope.mockReturnValue(pending.promise);
    const { screen } = renderModal();
    await choosePhoto();
    await expect.element(screen.getByText('약 이름을 읽는 중…')).toBeVisible();

    // 사진 변환이 끝나 요청이 나간 뒤에 닫는다
    await vi.waitFor(() => expect(api.recognizeMedicationEnvelope).toHaveBeenCalledTimes(1));
    const signal = api.recognizeMedicationEnvelope.mock.calls[0][2] as AbortSignal;
    expect(signal.aborted).toBe(false);
    screen.unmount();
    expect(signal.aborted).toBe(true);
  });

  it('2/2로 갔다 [이전]으로 돌아와도 고친 약·고른 시간이 그대로다', async () => {
    api.recognizeMedicationEnvelope.mockResolvedValue(OCR_TWO_DRUGS);
    const { screen } = renderModal();
    await choosePhoto();

    await screen.getByLabelText('1번째 약 이름').fill('타이레놀정500');
    await screen.getByRole('button', { name: '다음' }).click();
    await expect.element(screen.getByText('2 / 2')).toBeVisible();
    await expect.element(screen.getByRole('heading', { name: '언제 드세요?' })).toHaveFocus();
    // 봉투 표시(아침·저녁)가 하루 2번과 맞아 그대로 고른다
    await expect.element(chip(screen, '아침 오전 8시')).toHaveAttribute('aria-pressed', 'true');
    await expect.element(chip(screen, '점심 낮 12시')).toHaveAttribute('aria-pressed', 'false');
    await expect.element(chip(screen, '저녁 오후 7시')).toHaveAttribute('aria-pressed', 'true');
    await expect.element(screen.getByText('봉투에는 하루 2번이에요')).not.toBeInTheDocument();

    await chip(screen, '자기 전 오후 9시').click();
    await expect.element(screen.getByText('봉투에는 하루 2번이에요')).toBeVisible();

    await screen.getByRole('button', { name: '이전' }).click();
    await expect.element(screen.getByLabelText('1번째 약 이름')).toHaveValue('타이레놀정500');
    await screen.getByRole('button', { name: '다음' }).click();
    await expect.element(chip(screen, '자기 전 오후 9시')).toHaveAttribute('aria-pressed', 'true');
  });

  it('하루 횟수가 다른 약은 줄을 나누고 줄마다 기본 선택을 따로 한다', async () => {
    api.recognizeMedicationEnvelope.mockResolvedValue(OCR_MIXED_TIMES);
    const { screen } = renderModal();
    await choosePhoto();
    await screen.getByRole('button', { name: '다음' }).click();

    await expect.element(screen.getByText(ROW_3)).toBeVisible();
    await expect.element(screen.getByText(ROW_2)).toBeVisible();
    // 하루 3번 줄: 봉투 표시(아침·점심·저녁) 그대로
    await expect.element(chip(screen, `${ROW_3} - 점심 낮 12시`)).toHaveAttribute('aria-pressed', 'true');
    // 하루 2번 줄: 표시가 3칸이라 맞지 않아 횟수로(아침·저녁)
    await expect.element(chip(screen, `${ROW_2} - 아침 오전 8시`)).toHaveAttribute('aria-pressed', 'true');
    await expect.element(chip(screen, `${ROW_2} - 점심 낮 12시`)).toHaveAttribute('aria-pressed', 'false');
    await expect.element(chip(screen, `${ROW_2} - 저녁 오후 7시`)).toHaveAttribute('aria-pressed', 'true');
  });

  it('줄마다 1번씩 등록하고, 뒤 줄이 실패하면 실패한 줄만 다시 보낸다', async () => {
    api.recognizeMedicationEnvelope.mockResolvedValue(OCR_MIXED_TIMES);
    api.addWardMedicationBatch.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('잠시 후 다시 시도해 주세요.'));
    const { screen, onClose } = renderModal();
    await choosePhoto();
    await screen.getByRole('button', { name: '다음' }).click();
    await screen.getByRole('button', { name: '등록', exact: true }).click();

    await expect.element(screen.getByText(`${ROW_2} - 잠시 후 다시 시도해 주세요.`)).toBeVisible();
    await expect.element(screen.getByText('등록됨', { exact: true })).toBeVisible();
    await expect.element(chip(screen, `${ROW_3} - 아침 오전 8시`)).toBeDisabled();
    await expect.element(screen.getByRole('button', { name: '이전' })).toBeDisabled();
    await expect.element(screen.getByRole('tab', { name: '직접 쓰기' })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();

    expect(api.addWardMedicationBatch.mock.calls[0]).toEqual([
      'W1',
      {
        drugs: [
          { name: '신일이부프로펜정', doseAmount: 1 },
          { name: '뮤테란캡슐', doseAmount: 1 },
        ],
        times: [{ doseTime: '08:00:00' }, { doseTime: '12:00:00' }, { doseTime: '19:00:00' }],
      },
    ]);
    const secondBody = {
      drugs: [{ name: '코싹엘정', doseAmount: 1 }],
      times: [{ doseTime: '08:00:00' }, { doseTime: '19:00:00' }],
    };
    expect(api.addWardMedicationBatch.mock.calls[1]).toEqual(['W1', secondBody]);

    api.addWardMedicationBatch.mockResolvedValueOnce([]);
    await screen.getByRole('button', { name: '남은 약 다시 등록' }).click();
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(api.addWardMedicationBatch).toHaveBeenCalledTimes(3);
    expect(api.addWardMedicationBatch.mock.calls[2]).toEqual(['W1', secondBody]);
  });

  it('고른 칩이 없는 줄이 있으면 등록할 수 없다', async () => {
    api.recognizeMedicationEnvelope.mockResolvedValue(OCR_TWO_DRUGS);
    const { screen } = renderModal();
    await choosePhoto();
    await screen.getByRole('button', { name: '다음' }).click();

    const submit = screen.getByRole('button', { name: '등록', exact: true });
    await expect.element(submit).toBeEnabled();
    await chip(screen, '아침 오전 8시').click();
    await chip(screen, '저녁 오후 7시').click();
    await expect.element(submit).toBeDisabled();
  });

  it('등록에 실패하면 2/2에 그대로 남고, 칩을 고치면 실패 문구를 지운다', async () => {
    api.recognizeMedicationEnvelope.mockResolvedValue(OCR_TWO_DRUGS);
    api.addWardMedicationBatch.mockRejectedValue(new Error('같은 이름의 약이 두 번 들어 있습니다.'));
    const { screen, onClose } = renderModal();
    await choosePhoto();
    await screen.getByRole('button', { name: '다음' }).click();
    await screen.getByRole('button', { name: '등록', exact: true }).click();

    await expect.element(screen.getByText('같은 이름의 약이 두 번 들어 있습니다.')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: '이전' })).toBeEnabled();
    expect(onClose).not.toHaveBeenCalled();

    await chip(screen, '점심 낮 12시').click();
    await expect.element(screen.getByText('같은 이름의 약이 두 번 들어 있습니다.')).not.toBeInTheDocument();
  });

  it('직접 쓰기: 이름이 비거나 겹치면 [다음] 비활성, 기본은 아침, 등록 1회 후 닫힌다', async () => {
    api.addWardMedicationBatch.mockResolvedValue([]);
    const { screen, onClose } = renderModal();
    await screen.getByRole('tab', { name: '직접 쓰기' }).click();

    const next = screen.getByRole('button', { name: '다음' });
    await expect.element(next).toBeDisabled();
    await expect.element(screen.getByPlaceholder('약 이름을 써 주세요')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: '1번째 약 빼기' })).toBeDisabled();

    await screen.getByLabelText('1번째 약 이름').fill('혈압약');
    await expect.element(next).toBeEnabled();
    await screen.getByRole('button', { name: '+ 약 더 넣기' }).click();
    await screen.getByLabelText('2번째 약 이름').fill(' 혈압약 ');
    await expect.element(screen.getByText(/같은 이름의 약이 두 번 들어 있어요/)).toBeVisible();
    await expect.element(next).toBeDisabled();
    await screen.getByRole('button', { name: '2번째 약 빼기' }).click();

    await next.click();
    await expect.element(chip(screen, '아침 오전 8시')).toHaveAttribute('aria-pressed', 'true');
    await screen.getByRole('button', { name: '등록', exact: true }).click();
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(api.addWardMedicationBatch.mock.calls).toEqual([
      ['W1', { drugs: [{ name: '혈압약', doseAmount: 1 }], times: [{ doseTime: '08:00:00' }] }],
    ]);
  });

  it('탭을 바꾸면 처음부터 다시 쓴다', async () => {
    const { screen } = renderModal();
    await screen.getByRole('tab', { name: '직접 쓰기' }).click();
    await screen.getByLabelText('1번째 약 이름').fill('혈압약');
    await screen.getByRole('button', { name: '다음' }).click();
    await expect.element(screen.getByText('2 / 2')).toBeVisible();

    await screen.getByRole('tab', { name: '카메라로 찍기' }).click();
    await expect.element(screen.getByText('약 봉투를 카메라에 대주세요')).toBeVisible();
    await screen.getByRole('tab', { name: '직접 쓰기' }).click();
    await expect.element(screen.getByText('1 / 2')).toBeVisible();
    await expect.element(screen.getByLabelText('1번째 약 이름')).toHaveValue('');
  });

  it('등록 중에는 Esc·닫기로 닫히지 않고, 끝나면 닫힌다 (점검 L-1)', async () => {
    const pending = deferred<[]>();
    api.addWardMedicationBatch.mockReturnValue(pending.promise);
    const { screen, onClose } = renderModal();
    await screen.getByRole('tab', { name: '직접 쓰기' }).click();
    await screen.getByLabelText('1번째 약 이름').fill('혈압약');
    await screen.getByRole('button', { name: '다음' }).click();
    await screen.getByRole('button', { name: '등록', exact: true }).click();

    await expect.element(screen.getByRole('button', { name: '등록 중…' })).toBeVisible();
    await expect.element(screen.getByRole('button', { name: '닫기' })).toBeDisabled();
    await expect.element(screen.getByRole('tab', { name: '카메라로 찍기' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();

    pending.resolve([]);
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('열리면 선택된 탭에 포커스, 화살표로 탭 이동, Esc로 닫힘 (점검 L-6)', async () => {
    const { screen, onClose } = renderModal();
    await expect.element(screen.getByRole('tab', { name: '카메라로 찍기' })).toHaveFocus();

    await userEvent.keyboard('{ArrowRight}');
    await expect.element(screen.getByRole('tab', { name: '직접 쓰기' })).toHaveAttribute('aria-selected', 'true');
    await expect.element(screen.getByRole('tab', { name: '직접 쓰기' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('인식 실패(읽지 못함)면 안내하고 직접 쓰기로 넘어갈 수 있다', async () => {
    api.recognizeMedicationEnvelope.mockResolvedValue({ readable: false, drugs: [] });
    const { screen } = renderModal();
    await choosePhoto();

    await expect.element(screen.getByText(/약 봉투를 찾지 못했어요/)).toBeVisible();
    await screen.getByRole('button', { name: '직접 쓰기로' }).click();
    await expect.element(screen.getByRole('tab', { name: '직접 쓰기' })).toHaveAttribute('aria-selected', 'true');
    await expect.element(screen.getByText('1 / 2')).toBeVisible();
  });
});
