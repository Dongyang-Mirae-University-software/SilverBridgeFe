// 피보호자 환경설정 - 안부 대화 내용 가족 공유 동의 토글. 실제 Chrome에서 돈다
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { COMPANION_CONSENT_LABEL, WardCompanionConsentSection } from './WardCompanionConsentSection';

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('@/service/api/ward/companion', () => ({
  getWardCompanionTranscriptConsent: api.get,
  updateWardCompanionTranscriptConsent: api.put,
  getWardCompanionToday: vi.fn(),
}));

const OFF = { consented: false, consentedAt: null, retentionDays: 30, notice: ['보유 기간: 30일'] };
const ON = { ...OFF, consented: true, consentedAt: '2026-11-12T10:00:00+09:00' };

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WardCompanionConsentSection />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.removeItem('sb-companion-consent-asked');
  api.get.mockReset();
  api.put.mockReset();
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('안부 대화 공유 동의 토글 (Chrome)', () => {
  it('꺼진 상태를 보이고, 켜면 동의를 저장한다(30일 뒤 지워짐 안내)', async () => {
    api.get.mockResolvedValue(OFF);
    api.put.mockResolvedValue(ON);
    await renderSection();

    const toggle = page.getByRole('switch', { name: COMPANION_CONSENT_LABEL });
    await expect.element(toggle).toBeEnabled();
    await expect.element(toggle).not.toBeChecked();
    await expect.element(page.getByText('30일 뒤 지워져요.', { exact: false })).toBeVisible();
    await expect.element(page.getByText('보유 기간: 30일')).toBeVisible();

    await toggle.click();
    await expect.element(toggle).toBeChecked();
    expect(api.put).toHaveBeenCalledWith(true);
    // 본인이 정했으니 말벗 화면에서 동의 카드를 다시 띄우지 않는다(점검 M-1)
    expect(window.localStorage.getItem('sb-companion-consent-asked')).toBe('1');
  });

  it('끄면 바로 지워진다고 한 번 더 묻고, 끄고 지우기를 눌러야 철회를 저장한다(점검 M-2)', async () => {
    api.get.mockResolvedValue(ON);
    api.put.mockResolvedValue({ ...ON, consented: false, consentedAt: null });
    await renderSection();

    const toggle = page.getByRole('switch', { name: COMPANION_CONSENT_LABEL });
    await expect.element(toggle).toBeChecked();
    await toggle.click();
    await expect.element(page.getByText('끄면 지금까지 보관한 대화 내용이 바로 지워져요. 끌까요?')).toBeVisible();
    expect(api.put).not.toHaveBeenCalled();
    await expect.element(toggle).toBeChecked();

    await page.getByRole('button', { name: '끄고 지우기' }).click();
    await expect.element(toggle).not.toBeChecked();
    expect(api.put).toHaveBeenCalledWith(false);
    expect(window.localStorage.getItem('sb-companion-consent-asked')).toBe('1');
  });

  it('그대로 두기를 누르면 켜진 채로 두고 저장하지 않는다', async () => {
    api.get.mockResolvedValue(ON);
    await renderSection();

    const toggle = page.getByRole('switch', { name: COMPANION_CONSENT_LABEL });
    await expect.element(toggle).toBeChecked();
    await toggle.click();
    await page.getByRole('button', { name: '그대로 두기' }).click();
    expect(page.getByText('끌까요?', { exact: false }).elements()).toHaveLength(0);
    await expect.element(toggle).toBeChecked();
    await expect.element(toggle).toBeEnabled();
    expect(api.put).not.toHaveBeenCalled();
  });

  it('저장에 실패하면 원래 상태로 두고 안내한다', async () => {
    api.get.mockResolvedValue(OFF);
    api.put.mockRejectedValue(new Error('down'));
    await renderSection();

    const toggle = page.getByRole('switch', { name: COMPANION_CONSENT_LABEL });
    await expect.element(toggle).toBeEnabled();
    await toggle.click();
    await expect.element(page.getByText('바꾸지 못했어요. 잠시 후 다시 눌러 주세요.')).toBeVisible();
    await expect.element(toggle).not.toBeChecked();
  });

  it('상태를 못 받으면 토글을 막고 다시 불러오기를 보인다', async () => {
    api.get.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(OFF);
    await renderSection();

    await expect.element(page.getByText('설정을 불러오지 못했어요.', { exact: false })).toBeVisible();
    await expect.element(page.getByRole('switch', { name: COMPANION_CONSENT_LABEL })).toBeDisabled();
    await page.getByRole('button', { name: '다시 불러오기' }).click();
    await expect.element(page.getByRole('switch', { name: COMPANION_CONSENT_LABEL })).toBeEnabled();
  });
});
