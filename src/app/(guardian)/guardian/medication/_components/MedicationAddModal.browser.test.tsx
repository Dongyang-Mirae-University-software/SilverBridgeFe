// 약 추가 모달 컴포넌트 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)
// API는 모듈 목으로 바꾸고, 사진 처리(createImageBitmap·canvas)는 Chrome 것을 그대로 쓴다

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { page, userEvent } from '@vitest/browser/context';
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

// 약 이름 대조(BE #367): 1번 = 목록에 없음 + 제안 3개(오독이 confidence high로 온 실측과 같은 모양), 2번 = 목록에 없음 + 제안 0개,
// 3번 = 대조 못 함(null), 4번 = 칸이 없는 옛 응답
const LONG_SUGGESTION = '슈도에페드린염산염·트리프롤리딘염산염복합제피린정'.repeat(2);
const OCR_NAME_CHECK: MedicationOcrResponse = {
  readable: true,
  drugs: [
    { name: '슈다페트정', perDose: 1, timesPerDay: 3, days: 3, slots: [], timing: null, confidence: 'high', inList: false, suggestions: ['슈다페드정', '슈다펜정', LONG_SUGGESTION] },
    { name: '무명약정', perDose: 1, timesPerDay: 3, days: 3, slots: [], timing: null, confidence: 'high', inList: false, suggestions: [] },
    { name: '아스피린정', perDose: 1, timesPerDay: 3, days: 3, slots: [], timing: null, confidence: 'high', inList: null, suggestions: [] },
    { name: '코싹엘정', perDose: 1, timesPerDay: 3, days: 3, slots: [], timing: null, confidence: 'high' },
  ],
};

// 목록에 없는 이름은 노란 칸 + "비슷한 이름:" 칩만(안내 문장은 2026-10-24 사용자 요청으로 뺐다)
const NOT_IN_LIST_TEXT = '비슷한 이름:';
// 결과 문구와 노란 칸 안내는 상자 하나(2026-10-24)
const CHECK_BOX_TEXT = /노란 칸의 약 이름을 한 번 더 확인해 주세요/;

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

// withPageBehind: 모달 앞에 뒤 페이지의 버튼을 둔다(실제 화면에는 머리글·메뉴가 있다 - 없으면 body에서 Tab이 원래 모달로 간다)
function renderModal(onClose = vi.fn(), withPageBehind = false) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {withPageBehind && <button type="button">뒤 페이지 버튼</button>}
      {children}
    </QueryClientProvider>
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

// 약 행(<li>)과 그 안의 강조·안내·제안 칩
const drugRow = (screen: Screen, n: number) => (screen.getByLabelText(`${n}번째 약 이름`).element() as HTMLElement).closest('li')!;
const isHighlighted = (screen: Screen, n: number) => screen.getByLabelText(`${n}번째 약 이름`).element().className.includes('lowConfidence');
const rowSuggestionChips = (screen: Screen, n: number) =>
  [...drugRow(screen, n).querySelectorAll('button')].filter(button => button.getAttribute('aria-label')?.includes('(으)로 바꾸기'));

const chip = (screen: Screen, name: string) => screen.getByRole('button', { name, exact: true });

// 화면이 꺼지고 켜지는 것을 흉내 낸다(visibilityState를 명시해야 브라우저 기본값에 기대지 않는다)
function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

// 서버가 응답한 실패(apiClient는 AxiosError를 그대로 넘기고 message만 서버 문구로 바꾼다)
function httpError(status: number, message = '오류') {
  return new AxiosError(message, 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: {},
  });
}

describe('MedicationAddModal (Chrome)', () => {
  beforeEach(async () => {
    // 기본은 핸드폰 폭. 탭 잠금처럼 탭이 보여야 하는 테스트는 PC 폭으로 바꿔 돈다(핸드폰은 결과 뒤 탭을 접는다)
    await page.viewport(375, 812);
    api.recognizeMedicationEnvelope.mockReset();
    api.addWardMedicationBatch.mockReset();
  });
  afterEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });

  it('인식 결과는 1/2 약 초안으로만 채우고 자동 등록하지 않는다', async () => {
    api.recognizeMedicationEnvelope.mockResolvedValue(OCR_TWO_DRUGS);
    const { screen } = renderModal();
    await choosePhoto();

    // 노란 칸이 있으면 결과 문구와 확인 안내가 상자 하나
    await expect
      .element(screen.getByText('✓ 약 2개를 찾았어요.'))
      .toBeVisible();
    // "찾았어요" 다음 줄에 노란 칸 안내(2026-10-24)
    await expect.element(screen.getByText('노란 칸의 약 이름을 한 번 더 확인해 주세요')).toBeVisible();
    await expect.element(screen.getByText('1 / 2')).toBeVisible();
    await expect.element(screen.getByLabelText('1번째 약 이름')).toHaveValue('타이레놀정');
    await expect.element(screen.getByText('반알')).toBeVisible();
    // 확신 낮은 약이 있으면 결과 문구 바로 아래 노란 박스(작은 안내 대신)
    expect(document.querySelectorAll('[role="status"]')).toHaveLength(1);
    await expect.element(screen.getByLabelText('2번째 약 이름')).toHaveAttribute('aria-describedby');
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
    expect(screen.getByText(/노란 칸의 약 이름/).query()).toBeNull();
  });

  it('목록에 없는 이름: 강조·안내·제안 칩, 칩을 누르면 그 행 이름만 바뀌고 강조가 풀린다 (BE #367)', async () => {
    const { screen } = renderModal();
    api.recognizeMedicationEnvelope.mockResolvedValue(OCR_NAME_CHECK);
    await choosePhoto();
    await expect.element(screen.getByText(/약 4개를 찾았어요/)).toBeVisible();

    // confidence high여도 목록에 없으면 노란 칸 + 확인 박스
    await expect.element(screen.getByText(CHECK_BOX_TEXT)).toBeVisible();
    expect([1, 2, 3, 4].map(n => isHighlighted(screen, n))).toEqual([true, true, false, false]);
    // 제안이 없는 2번은 노란 칸만(칩 줄 없음)
    expect([1, 2, 3, 4].map(n => drugRow(screen, n).textContent?.includes(NOT_IN_LIST_TEXT))).toEqual([true, false, false, false]);
    // 1번은 제안 3개, 2번(제안 0개)은 문구만
    expect(rowSuggestionChips(screen, 1).map(button => button.textContent)).toEqual(['슈다페드정', '슈다펜정', LONG_SUGGESTION]);
    expect(rowSuggestionChips(screen, 2)).toHaveLength(0);
    // 칩 앞 머리말은 제안이 있을 때만(점검 L-2), 칩은 손가락으로 누를 만한 높이(점검 L-3)
    expect(drugRow(screen, 1).textContent).toContain('비슷한 이름:');
    expect(drugRow(screen, 2).textContent).not.toContain('비슷한 이름:');
    expect(rowSuggestionChips(screen, 1).every(button => button.getBoundingClientRect().height >= 32)).toBe(true);
    // 자동으로 바꾸거나 미리 고르지 않는다
    await expect.element(screen.getByLabelText('1번째 약 이름')).toHaveValue('슈다페트정');
    // 375px에서 긴 제안 칩이 줄바꿈되어도 가로로 넘치지 않는다
    const dialog = screen.getByRole('dialog').element() as HTMLElement;
    expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);

    await screen.getByRole('button', { name: '1번째 약을 슈다펜정(으)로 바꾸기' }).click();
    await expect.element(screen.getByLabelText('1번째 약 이름')).toHaveValue('슈다펜정');
    expect(isHighlighted(screen, 1)).toBe(false);
    expect(drugRow(screen, 1).textContent).not.toContain(NOT_IN_LIST_TEXT);
    expect(rowSuggestionChips(screen, 1)).toHaveLength(0);
    // 다른 행은 그대로
    await expect.element(screen.getByLabelText('2번째 약 이름')).toHaveValue('무명약정');
    expect(isHighlighted(screen, 2)).toBe(true);
    await expect.element(screen.getByText(CHECK_BOX_TEXT)).toBeVisible();

    // 남은 행을 직접 고치면 그 행의 강조·안내도 풀리고, 확인할 약이 없으니 박스도 사라진다
    await screen.getByLabelText('2번째 약 이름').fill('무코스타정');
    expect(isHighlighted(screen, 2)).toBe(false);
    expect(drugRow(screen, 2).textContent).not.toContain(NOT_IN_LIST_TEXT);
    await expect.element(screen.getByText(CHECK_BOX_TEXT)).not.toBeInTheDocument();
  });

  it('다시 찍으면 목록에 없는 이름 안내·칩도 새 결과로 바뀐다', async () => {
    api.recognizeMedicationEnvelope
      .mockResolvedValueOnce(OCR_NAME_CHECK)
      .mockResolvedValueOnce({ readable: true, drugs: [{ ...OCR_NAME_CHECK.drugs[2] }] });
    const { screen } = renderModal();
    await choosePhoto();
    await expect.element(screen.getByText(/약 4개를 찾았어요/)).toBeVisible();
    await expect.element(screen.getByText(CHECK_BOX_TEXT)).toBeVisible();

    await screen.getByRole('button', { name: '다시 찍기' }).click();
    await choosePhoto();
    await expect.element(screen.getByText(/약 1개를 찾았어요/)).toBeVisible();
    await expect.element(screen.getByLabelText('1번째 약 이름')).toHaveValue('아스피린정');
    expect(isHighlighted(screen, 1)).toBe(false);
    expect(screen.getByText(NOT_IN_LIST_TEXT).query()).toBeNull();
    expect(rowSuggestionChips(screen, 1)).toHaveLength(0);
    await expect.element(screen.getByText(CHECK_BOX_TEXT)).not.toBeInTheDocument();
  });

  it('대조 못 함(inList=null)·옛 응답은 경고하지 않고, 목록에 있음 + 확신 low는 노란 칸만', async () => {
    const { screen } = renderModal();
    api.recognizeMedicationEnvelope.mockResolvedValue({
      readable: true,
      drugs: [
        { ...OCR_NAME_CHECK.drugs[2] },
        { ...OCR_NAME_CHECK.drugs[3] },
        { ...OCR_TWO_DRUGS.drugs[1], inList: true, suggestions: [] }, // 무코스타정, low
      ],
    } satisfies MedicationOcrResponse);
    await choosePhoto();
    await expect.element(screen.getByText(/약 3개를 찾았어요/)).toBeVisible();
    expect([1, 2, 3].map(n => isHighlighted(screen, n))).toEqual([false, false, true]);
    expect(screen.getByText(NOT_IN_LIST_TEXT).query()).toBeNull();
    await expect.element(screen.getByText(CHECK_BOX_TEXT)).toBeVisible();
  });

  it('제안 칩을 누르지 않으면 인식된 이름 그대로 등록한다', async () => {
    api.addWardMedicationBatch.mockResolvedValue([]);
    const { screen, onClose } = renderModal();
    api.recognizeMedicationEnvelope.mockResolvedValue({ readable: true, drugs: [OCR_NAME_CHECK.drugs[0]] });
    await choosePhoto();
    await expect.element(screen.getByText(NOT_IN_LIST_TEXT)).toBeVisible();
    await screen.getByRole('button', { name: '다음' }).click();
    const submit = screen.getByRole('button', { name: '등록', exact: true });
    await expect.element(submit, { timeout: 3000 }).toBeEnabled();
    await submit.click();
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(api.addWardMedicationBatch.mock.calls[0][1].drugs).toEqual([{ name: '슈다페트정', doseAmount: 1 }]);
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

  it('핸드폰: 모달로 보이고, 처음엔 탭이 보이며 사진 결과가 나오거나 2/2에 들어가면 탭을 접는다 (2026-10-24)', async () => {
    api.recognizeMedicationEnvelope.mockResolvedValue(OCR_TWO_DRUGS);
    const { screen } = renderModal();
    await expect.element(screen.getByRole('tab', { name: '직접 쓰기' })).toBeVisible();

    await choosePhoto();
    await expect.element(screen.getByText(/약 2개를 찾았어요/)).toBeVisible();
    expect(screen.getByRole('tab', { name: '직접 쓰기' }).query()).toBeNull();
    // 핸드폰에서도 모달(화면 전체가 아니다 - 2026-10-24 사용자 요청으로 되돌림), 가로 넘침 없음
    const dialog = screen.getByRole('dialog').element() as HTMLElement;
    expect(dialog.getBoundingClientRect().width).toBeLessThan(window.innerWidth);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);

    await screen.getByRole('button', { name: '다음' }).click();
    await expect.element(screen.getByRole('heading', { name: '언제 드세요?' })).toBeVisible();
    expect(screen.getByRole('tab', { name: '직접 쓰기' }).query()).toBeNull();
  });

  it('복용량 −/+는 약마다 바로 보인다 - 접지 않는다 (2026-10-24 사용자 요청)', async () => {
    api.recognizeMedicationEnvelope.mockResolvedValue(OCR_TWO_DRUGS);
    const { screen } = renderModal();
    await choosePhoto();

    await expect.element(screen.getByRole('button', { name: '1번째 약 복용량 늘리기' })).toBeVisible();
    await expect.element(screen.getByRole('button', { name: '2번째 약 복용량 늘리기' })).toBeVisible();
    await screen.getByRole('button', { name: '1번째 약 복용량 늘리기' }).click();
    await expect.element(screen.getByText('1알', { exact: true }).first()).toBeVisible();
    expect(screen.getByRole('button', { name: /바꾸기$/ }).query()).toBeNull();
  });

  it('읽는 중에는 탭을 바꿀 수 없다 (점검 M-1)', async () => {
    await page.viewport(1280, 900);
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

    // 봉투 횟수와 다르게 골라도 칩 아래에 안내 문구를 붙이지 않는다(2026-10-23 사용자 결정)
    await chip(screen, '자기 전 오후 9시').click();
    expect(screen.getByText(/봉투에는 하루|봉투에 적힌 약은/).query()).toBeNull();

    await screen.getByRole('button', { name: '이전' }).click();
    await expect.element(screen.getByLabelText('1번째 약 이름')).toHaveValue('타이레놀정500');
    await screen.getByRole('button', { name: '다음' }).click();
    await expect.element(chip(screen, '자기 전 오후 9시')).toHaveAttribute('aria-pressed', 'true');
  });

  it('하루 횟수가 다른 약도 "언제 드세요?" 한 줄로 고른다 - 칩 아래 횟수 안내 문구는 없다', async () => {
    api.recognizeMedicationEnvelope.mockResolvedValue(OCR_MIXED_TIMES);
    api.addWardMedicationBatch.mockResolvedValue([]);
    const { screen, onClose } = renderModal();
    await choosePhoto();
    await screen.getByRole('button', { name: '다음' }).click();

    // 칩은 4개 한 줄뿐(줄 제목 없음), 봉투 표시(아침·점심·저녁) 그대로
    expect(document.querySelectorAll('button[aria-pressed]')).toHaveLength(4);
    await expect.element(chip(screen, '아침 오전 8시')).toHaveAttribute('aria-pressed', 'true');
    await expect.element(chip(screen, '점심 낮 12시')).toHaveAttribute('aria-pressed', 'true');
    await expect.element(chip(screen, '저녁 오후 7시')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/다른 약과 하루 횟수가 달라요/).query()).toBeNull();

    await screen.getByRole('button', { name: '등록', exact: true }).click();
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(api.addWardMedicationBatch.mock.calls).toEqual([
      [
        'W1',
        {
          drugs: [
            { name: '신일이부프로펜정', doseAmount: 1 },
            { name: '코싹엘정', doseAmount: 1 },
            { name: '뮤테란캡슐', doseAmount: 1 },
          ],
          times: [{ doseTime: '08:00:00' }, { doseTime: '12:00:00' }, { doseTime: '19:00:00' }],
        },
      ],
    ]);
  });

  it('2/2에 들어온 직후에는 [등록]이 잠겨, [다음]을 한 번 더 누른 탭이 등록되지 않는다 (2026-10-22 gosky)', async () => {
    api.addWardMedicationBatch.mockResolvedValue([]);
    const { screen } = renderModal();
    await screen.getByRole('tab', { name: '직접 쓰기' }).click();
    await screen.getByLabelText('1번째 약 이름').fill('혈압약');
    await screen.getByRole('button', { name: '다음' }).click();

    const submit = screen.getByRole('button', { name: '등록', exact: true });
    await expect.element(submit).toBeDisabled();
    (submit.element() as HTMLButtonElement).click(); // 같은 자리에 한 번 더 닿은 탭
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(api.addWardMedicationBatch).not.toHaveBeenCalled();

    // 잠깐 뒤에는 누를 수 있다
    await expect.element(submit, { timeout: 3000 }).toBeEnabled();
  });

  it('화면이 다시 켜진 직후에도 [등록]이 잠깐 잠긴다(화면을 깨우려던 탭이 등록되지 않게)', async () => {
    const { screen } = renderModal();
    await screen.getByRole('tab', { name: '직접 쓰기' }).click();
    await screen.getByLabelText('1번째 약 이름').fill('혈압약');
    await screen.getByRole('button', { name: '다음' }).click();
    const submit = screen.getByRole('button', { name: '등록', exact: true });
    await expect.element(submit, { timeout: 3000 }).toBeEnabled();

    // 화면이 꺼질 때(hidden)는 잠그지 않고, 다시 켜질 때(visible) 잠근다 (점검 L-4: 상태를 명시)
    setVisibility('hidden');
    await new Promise(resolve => setTimeout(resolve, 50));
    expect((submit.element() as HTMLButtonElement).disabled).toBe(false);
    setVisibility('visible');
    await expect.element(submit).toBeDisabled();
    await expect.element(submit, { timeout: 3000 }).toBeEnabled();
    expect(api.addWardMedicationBatch).not.toHaveBeenCalled();
  });

  it('서버 응답이 504여도 결과를 모르므로 다시 보내지 않는다 (점검 #89 M-1)', async () => {
    api.addWardMedicationBatch.mockRejectedValueOnce(httpError(504));
    const { screen } = renderModal();
    await screen.getByRole('tab', { name: '직접 쓰기' }).click();
    await screen.getByLabelText('1번째 약 이름').fill('혈압약');
    await screen.getByRole('button', { name: '다음' }).click();
    await screen.getByRole('button', { name: '등록', exact: true }).click();

    await expect.element(screen.getByText(/등록됐는지 확인하지 못했어요/)).toBeVisible();
    await new Promise(resolve => setTimeout(resolve, 1200)); // 잠금이 풀린 뒤에도
    await expect.element(screen.getByRole('button', { name: '등록', exact: true })).toBeDisabled();
    expect(api.addWardMedicationBatch).toHaveBeenCalledTimes(1);
  });

  it('400(서버가 처리 전에 거절)은 고쳐서 다시 등록할 수 있다', async () => {
    api.addWardMedicationBatch.mockRejectedValueOnce(httpError(400, '같은 이름의 약이 두 번 들어 있습니다.')).mockResolvedValueOnce([]);
    const { screen, onClose } = renderModal();
    await screen.getByRole('tab', { name: '직접 쓰기' }).click();
    await screen.getByLabelText('1번째 약 이름').fill('혈압약');
    await screen.getByRole('button', { name: '다음' }).click();
    await screen.getByRole('button', { name: '등록', exact: true }).click();
    await expect.element(screen.getByText('같은 이름의 약이 두 번 들어 있습니다.')).toBeVisible();

    await screen.getByRole('button', { name: '등록', exact: true }).click();
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(api.addWardMedicationBatch).toHaveBeenCalledTimes(2);
  });

  it('칩을 모두 끄면 "시간을 하나 이상 골라 주세요" (점검 L-2)', async () => {
    const { screen } = renderModal();
    await screen.getByRole('tab', { name: '직접 쓰기' }).click();
    await screen.getByLabelText('1번째 약 이름').fill('혈압약');
    await screen.getByRole('button', { name: '다음' }).click();
    await chip(screen, '아침 오전 8시').click();
    await expect.element(screen.getByText('시간을 하나 이상 골라 주세요')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: '등록', exact: true })).toBeDisabled();
  });

  it('잠금이 [등록]을 끌 때 포커스는 단계 제목으로 간다 (점검 L-3)', async () => {
    const { screen } = renderModal();
    await screen.getByRole('tab', { name: '직접 쓰기' }).click();
    await screen.getByLabelText('1번째 약 이름').fill('혈압약');
    await screen.getByRole('button', { name: '다음' }).click();
    const submit = screen.getByRole('button', { name: '등록', exact: true });
    await expect.element(submit, { timeout: 3000 }).toBeEnabled();
    (submit.element() as HTMLButtonElement).focus();

    setVisibility('visible');
    await expect.element(submit).toBeDisabled();
    await expect.element(screen.getByRole('heading', { name: '언제 드세요?' })).toHaveFocus();
  });

  it('다시 찍으면 2/2 기본 선택을 새 봉투로 다시 정한다 (점검 L-4)', async () => {
    api.recognizeMedicationEnvelope.mockResolvedValueOnce(OCR_TWO_DRUGS).mockResolvedValueOnce({
      readable: true,
      drugs: [{ name: '아스피린', perDose: 1, timesPerDay: 1, days: 3, slots: [], timing: null, confidence: 'high' }],
    });
    const { screen } = renderModal();
    await choosePhoto();
    await screen.getByRole('button', { name: '다음' }).click();
    await chip(screen, '점심 낮 12시').click();
    await screen.getByRole('button', { name: '이전' }).click();

    await screen.getByRole('button', { name: '다시 찍기' }).click();
    await choosePhoto();
    await expect.element(screen.getByText('✓ 약 1개를 찾았어요.')).toBeVisible();
    await screen.getByRole('button', { name: '다음' }).click();
    await expect.element(chip(screen, '아침 오전 8시')).toHaveAttribute('aria-pressed', 'true');
    await expect.element(chip(screen, '점심 낮 12시')).toHaveAttribute('aria-pressed', 'false');
    await expect.element(chip(screen, '저녁 오후 7시')).toHaveAttribute('aria-pressed', 'false');
  });

  it('1/2 이름 칸에서 Enter는 2/2로 넘어가기만 하고 등록하지 않는다 (점검 L-4)', async () => {
    api.addWardMedicationBatch.mockResolvedValue([]);
    const { screen } = renderModal();
    await screen.getByRole('tab', { name: '직접 쓰기' }).click();
    await screen.getByLabelText('1번째 약 이름').fill('혈압약');
    await userEvent.keyboard('{Enter}');
    await expect.element(screen.getByText('2 / 2')).toBeVisible();
    await userEvent.keyboard('{Enter}');
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(api.addWardMedicationBatch).not.toHaveBeenCalled();
  });

  it('응답 전에 끊기면 "확인 필요"로 막고 다시 보내지 않는다 (점검 M-1)', async () => {
    await page.viewport(1280, 900);
    api.recognizeMedicationEnvelope.mockResolvedValue(OCR_TWO_DRUGS);
    api.addWardMedicationBatch.mockRejectedValueOnce(new AxiosError('timeout of 10000ms exceeded', 'ECONNABORTED'));
    const { screen, onClose } = renderModal();
    await choosePhoto();
    await screen.getByRole('button', { name: '다음' }).click();
    await screen.getByRole('button', { name: '등록', exact: true }).click();

    await expect.element(screen.getByText(/등록됐는지 확인하지 못했어요. 약 목록에서 확인한 뒤/)).toBeVisible();
    await expect.element(screen.getByRole('button', { name: '등록', exact: true })).toBeDisabled();
    await expect.element(chip(screen, '아침 오전 8시')).toBeDisabled();
    await expect.element(screen.getByRole('button', { name: '이전' })).toBeDisabled();
    await expect.element(screen.getByRole('tab', { name: '직접 쓰기' })).toBeDisabled();
    expect(api.addWardMedicationBatch).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('등록이 오래 걸린 뒤 실패해도 포커스가 모달 안(실패 문구)에 있고 Esc로 닫힌다 (점검 M-2)', async () => {
    await page.viewport(1280, 900);
    api.addWardMedicationBatch.mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error('잠시 후 다시 시도해 주세요.')), 600)),
    );
    const { screen, onClose } = renderModal(vi.fn(), true);
    await screen.getByRole('tab', { name: '직접 쓰기' }).click();
    await screen.getByLabelText('1번째 약 이름').fill('혈압약');
    await screen.getByRole('button', { name: '다음' }).click();
    await screen.getByRole('button', { name: '등록', exact: true }).click();

    // 등록 중: 버튼이 비활성화돼 포커스가 body로 빠져도 Tab은 모달 안으로 들어온다(닫기는 등록 중이라 막힘)
    await expect.element(screen.getByRole('button', { name: '등록 중…' })).toBeVisible();
    expect(document.activeElement).toBe(document.body);
    await userEvent.keyboard('{Tab}');
    expect(document.querySelector('[role="dialog"]')!.contains(document.activeElement)).toBe(true);
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();

    await expect.element(screen.getByText('잠시 후 다시 시도해 주세요.')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('다시 찍기가 실패해도 "전에 찍은 결과로" 고쳐 둔 초안으로 돌아간다 (점검 L-1)', async () => {
    await page.viewport(1280, 900);
    api.recognizeMedicationEnvelope.mockResolvedValueOnce(OCR_TWO_DRUGS).mockResolvedValueOnce({ readable: false, drugs: [] });
    const { screen } = renderModal();
    await choosePhoto();
    await screen.getByLabelText('1번째 약 이름').fill('타이레놀정500');

    await screen.getByRole('button', { name: '다시 찍기' }).click();
    await choosePhoto();
    await expect.element(screen.getByText(/약 봉투를 찾지 못했어요/)).toBeVisible();
    await screen.getByRole('button', { name: '전에 찍은 결과로' }).click();
    await expect.element(screen.getByText(/✓ 약 2개를 찾았어요/)).toBeVisible();
    await expect.element(screen.getByLabelText('1번째 약 이름')).toHaveValue('타이레놀정500');
  });

  it('처음 찍기가 실패하면 "전에 찍은 결과로" 버튼이 없다', async () => {
    api.recognizeMedicationEnvelope.mockResolvedValue({ readable: false, drugs: [] });
    const { screen } = renderModal();
    await choosePhoto();
    await expect.element(screen.getByText(/약 봉투를 찾지 못했어요/)).toBeVisible();
    expect(screen.getByRole('button', { name: '전에 찍은 결과로' }).query()).toBeNull();
  });

  it('고른 칩이 없으면 등록할 수 없다', async () => {
    api.recognizeMedicationEnvelope.mockResolvedValue(OCR_TWO_DRUGS);
    const { screen } = renderModal();
    await choosePhoto();
    await screen.getByRole('button', { name: '다음' }).click();

    const submit = screen.getByRole('button', { name: '등록', exact: true });
    await expect.element(submit, { timeout: 3000 }).toBeEnabled();
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
    await page.viewport(1280, 900);
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
    await page.viewport(1280, 900);
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
