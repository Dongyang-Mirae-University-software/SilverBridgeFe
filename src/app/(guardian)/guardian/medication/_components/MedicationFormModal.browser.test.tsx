// 약 수정 모달 컴포넌트 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)

import { userEvent } from '@vitest/browser/context';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import type { MedicationItem } from '@/service/interface/medication';
import { MedicationFormModal } from './MedicationFormModal';

function medication(doseAmount: number, overrides: Partial<MedicationItem> = {}): MedicationItem {
  return {
    medicationId: 1,
    name: '혈압약',
    timeSlot: 'MORNING',
    doseTime: '08:00:00',
    doseAmount,
    memo: null,
    taken: false,
    takenAt: null,
    ...overrides,
  };
}

function renderModal(doseAmount: number, isSubmitting = false, overrides: Partial<MedicationItem> = {}) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  const screen = render(
    <MedicationFormModal
      wardName="테스트"
      initial={medication(doseAmount, overrides)}
      isSubmitting={isSubmitting}
      onSubmit={onSubmit}
      onClose={onClose}
    />,
  );
  return { screen, onSubmit, onClose };
}

describe('MedicationFormModal (Chrome)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // 시간대는 시각으로 정한다(2026-10-30) - 따로 움직이면 "점심 01:40" 같은 약이 생겼다
  it('시각을 바꾸면 복용 시간(시간대)이 따라가고, 저장 본문도 둘이 맞는다', async () => {
    const { screen, onSubmit } = renderModal(1);
    const slot = screen.getByRole('combobox', { name: '복용 시간' });

    await userEvent.fill(screen.getByLabelText('복용 시각'), '20:30');
    await expect.element(slot).toHaveValue('DINNER');
    await screen.getByRole('button', { name: '수정' }).click();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ timeSlot: 'DINNER', doseTime: '20:30' }));
  });

  it('복용 시간(시간대)을 고르면 시각이 그 시간대의 기본 시각으로 바뀐다', async () => {
    const { screen } = renderModal(1);

    await screen.getByRole('combobox', { name: '복용 시간' }).selectOptions('LUNCH');
    await expect.element(screen.getByLabelText('복용 시각')).toHaveValue('12:00');
  });

  // 경계값 - BE MedicationTimeSlot.fromDoseTime(DoseAmountsAndTimeSlotTest)과 같은 규칙이어야 한다(점검 L-3)
  it.each([
    ['03:59', 'BEDTIME'],
    ['04:00', 'MORNING'],
    ['10:59', 'MORNING'],
    ['11:00', 'LUNCH'],
    ['15:59', 'LUNCH'],
    ['16:00', 'DINNER'],
    ['20:59', 'DINNER'],
    ['21:00', 'BEDTIME'],
    ['00:00', 'BEDTIME'],
  ])('시각 %s → 복용 시간 %s', async (time, slot) => {
    const { screen } = renderModal(1);

    await userEvent.fill(screen.getByLabelText('복용 시각'), time);
    await expect.element(screen.getByRole('combobox', { name: '복용 시간' })).toHaveValue(slot);
  });

  it('이미 어긋나 저장된 약(점심 01:40)은 열 때부터 시각에 맞는 시간대로 보이고, 그대로 저장하면 바로잡힌다', async () => {
    const { screen, onSubmit } = renderModal(1, false, { timeSlot: 'LUNCH', doseTime: '01:40:00' });

    await expect.element(screen.getByRole('combobox', { name: '복용 시간' })).toHaveValue('BEDTIME');
    await screen.getByRole('button', { name: '수정' }).click();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ timeSlot: 'BEDTIME', doseTime: '01:40' }));
  });

  it('반 알 약: 반 알로 보이고 줄이기는 막히며, 늘리면 1정으로 저장된다', async () => {
    const { screen, onSubmit } = renderModal(0.5);
    await expect.element(screen.getByText('반 알')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: '복용량 줄이기' })).toBeDisabled();

    await screen.getByRole('button', { name: '복용량 늘리기' }).click();
    await expect.element(screen.getByText('1정', { exact: true })).toBeVisible();
    await screen.getByRole('button', { name: '수정' }).click();
    expect(onSubmit.mock.calls[0][0].doseAmount).toBe(1);
  });

  it('1정 반 약: 줄이면 1정, 다시 줄이면 반 알 (입력 칸도 목록·알림과 같은 표기)', async () => {
    const { screen, onSubmit } = renderModal(1.5);
    await expect.element(screen.getByText('1정 반')).toBeVisible();
    await screen.getByRole('button', { name: '복용량 줄이기' }).click();
    await expect.element(screen.getByText('1정', { exact: true })).toBeVisible();
    await screen.getByRole('button', { name: '복용량 줄이기' }).click();
    await expect.element(screen.getByText('반 알')).toBeVisible();
    await screen.getByRole('button', { name: '수정' }).click();
    expect(onSubmit.mock.calls[0][0].doseAmount).toBe(0.5);
  });

  it('열리면 약 이름 칸에 포커스, Esc로 닫힘', async () => {
    const { screen, onClose } = renderModal(1);
    await expect.element(screen.getByPlaceholder('예) 혈압약 (암로디핀 5mg)')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('저장 중에는 Esc·닫기로 닫히지 않는다', async () => {
    const { screen, onClose } = renderModal(1, true);
    await expect.element(screen.getByRole('button', { name: '닫기' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Tab 키 포커스가 모달 밖으로 나가지 않는다', async () => {
    const { screen } = renderModal(1);
    for (let i = 0; i < 12; i += 1) await userEvent.keyboard('{Tab}');
    expect(document.activeElement?.closest('[role="dialog"]')).not.toBeNull();
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement?.closest('[role="dialog"]')).not.toBeNull();
    expect(screen.container).toBeTruthy();
  });
});
