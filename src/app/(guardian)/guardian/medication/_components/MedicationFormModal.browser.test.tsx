// 약 수정 모달 컴포넌트 테스트 - 실제 Chrome에서 돈다(`npm run test:browser`)

import { userEvent } from '@vitest/browser/context';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import type { MedicationItem } from '@/service/interface/medication';
import { MedicationFormModal } from './MedicationFormModal';

function medication(doseAmount: number): MedicationItem {
  return {
    medicationId: 1,
    name: '혈압약',
    timeSlot: 'MORNING',
    doseTime: '08:00:00',
    doseAmount,
    memo: null,
    taken: false,
    takenAt: null,
  };
}

function renderModal(doseAmount: number, isSubmitting = false) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  const screen = render(
    <MedicationFormModal
      wardName="테스트"
      initial={medication(doseAmount)}
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

  it('반 알 약: 반알로 보이고 줄이기는 막히며, 늘리면 1알로 저장된다', async () => {
    const { screen, onSubmit } = renderModal(0.5);
    await expect.element(screen.getByText('반알')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: '복용량 줄이기' })).toBeDisabled();

    await screen.getByRole('button', { name: '복용량 늘리기' }).click();
    await expect.element(screen.getByText('1알', { exact: true })).toBeVisible();
    await screen.getByRole('button', { name: '수정' }).click();
    expect(onSubmit.mock.calls[0][0].doseAmount).toBe(1);
  });

  it('1.5알 약: 줄이면 1알, 다시 줄이면 반알', async () => {
    const { screen, onSubmit } = renderModal(1.5);
    await expect.element(screen.getByText('1알 반')).toBeVisible();
    await screen.getByRole('button', { name: '복용량 줄이기' }).click();
    await expect.element(screen.getByText('1알', { exact: true })).toBeVisible();
    await screen.getByRole('button', { name: '복용량 줄이기' }).click();
    await expect.element(screen.getByText('반알')).toBeVisible();
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
