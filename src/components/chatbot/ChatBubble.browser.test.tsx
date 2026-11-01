// 챗봇 답 말풍선 - 답 모양(layout, AI 2026-11-01)과 옛 형식 호환. 실제 Chrome에서 돈다(`npm run test:browser`)
// 합성 문장만 쓴다. 문구·이모지로 판단하지 않는지(있는지만 보는지)도 확인한다.

import { describe, expect, it, vi } from 'vitest';
import { page } from '@vitest/browser/context';
import { render } from 'vitest-browser-react';

import type { ChatMessage } from '@/service/interface/chat';

vi.mock('@/components/UserAvatar', () => ({ UserAvatar: () => <span /> }));

import ChatBubble from './ChatBubble';

const base: ChatMessage = { id: 'a1', role: 'assistant', content: '', timestamp: '2026-11-01T00:00:00Z' };

function show(message: Partial<ChatMessage>, variant: 'guardian' | 'ward' = 'guardian') {
  return render(
    <div data-testid="wrap" style={{ width: 375 }}>
      <ChatBubble message={{ ...base, ...message }} isLastAssistant onUiSelect={vi.fn()} variant={variant} />
    </div>,
  );
}

function textOrder(): string[] {
  const root = page.getByTestId('wrap').element();
  return Array.from(root.querySelectorAll('p, li')).map(el => el.textContent ?? '');
}

describe('ChatBubble 답 모양', () => {
  it('핵심 한 줄·본문·카드를 칸별로 그리고 빈 칸은 그리지 않는다', async () => {
    show({
      content: '🏥 정형외과 진료를 권해드려요.\n💬 많이 불편하시겠어요.',
      layout: {
        headline: '🏥 정형외과 진료를 권해드려요.',
        body: ['💬 많이 불편하시겠어요.', '📝 증상: 무릎 통증'],
        questions: [],
        homeCare: [],
        visitHospitalIf: ['🏥 붓거나 열감이 있으면 꼭 진료를 받아 보세요.'],
      },
    });

    await expect.element(page.getByText('🏥 정형외과 진료를 권해드려요.')).toBeVisible();
    await expect.element(page.getByText('🏥 이럴 땐 병원으로')).toBeVisible();
    expect(page.getByText('🏠 집에서 이렇게').elements()).toHaveLength(0); // 빈 칸은 안 그림
    expect(page.getByText('❓ 이렇게 알려 주세요').elements()).toHaveLength(0);
    // layout 이 있으면 reply 글은 따로 그리지 않는다(중복 없음)
    expect(page.getByText('💬 많이 불편하시겠어요.').elements()).toHaveLength(1);
    const headline = page.getByText('🏥 정형외과 진료를 권해드려요.').element();
    expect(Number.parseFloat(getComputedStyle(headline).fontWeight)).toBeGreaterThanOrEqual(700);
  });

  it('응급 답은 빨간 상자가 맨 위, 그다음 119 핵심 줄', async () => {
    show({
      content: '🚨 바로 119에 전화해 주세요.\n지금은 병원 예약보다 119 연락이 먼저예요.',
      emergencyWarning: ['지금은 응급 상황일 수 있어요.', '지금 바로 119에 전화하세요.'],
      layout: { headline: '🚨 바로 119에 전화해 주세요.', body: ['지금은 병원 예약보다 119 연락이 먼저예요.'], questions: [], homeCare: [], visitHospitalIf: [] },
    });

    await expect.element(page.getByRole('alert')).toBeVisible();
    const order = textOrder();
    expect(order[0]).toBe('응급 주의');
    const headlineIdx = order.indexOf('🚨 바로 119에 전화해 주세요.');
    const warningIdx = order.indexOf('지금 바로 119에 전화하세요.');
    expect(warningIdx).toBeGreaterThan(0);
    expect(headlineIdx).toBeGreaterThan(warningIdx);
    // 119는 굵게(보이는 모양만)
    const strong = page.getByTestId('wrap').element().querySelector('strong');
    expect(strong?.textContent).toBe('119');
  });

  it('옛 형식(layout 없음)은 지금처럼 reply 글로 그린다 - 옛 AI·옛 기록 호환', async () => {
    show({ content: '말씀해 주신 내용을 정리했어요.\n· 증상: 기침', layout: undefined });

    const reply = page.getByText(/· 증상: 기침/).element();
    expect(getComputedStyle(reply).whiteSpace).toBe('pre-wrap');
    expect(page.getByText('🏥 이럴 땐 병원으로').elements()).toHaveLength(0);
  });

  it('옛 형식에서도 응급 상자는 reply 글보다 위', async () => {
    show({ content: '옛 응급 답', emergencyWarning: ['지금 바로 119에 전화하세요.'], layout: null });

    const order = textOrder();
    expect(order.indexOf('응급 주의')).toBeLessThan(order.indexOf('옛 응급 답'));
  });

  it('이상한 layout(문장 없음·문자열 아님)은 무시하고 reply 로 그린다', async () => {
    show({
      content: '대체 답',
      layout: { headline: '', body: [1 as unknown as string], questions: [], homeCare: [], visitHospitalIf: [] },
    });

    await expect.element(page.getByText('대체 답')).toBeVisible();
  });

  it('되묻기 질문은 질문 칸에, 글자는 18px 이상', async () => {
    show({
      content: '',
      layout: {
        headline: '🏥 신경과 진료를 생각해 보셔도 좋아요.',
        body: ['💬 몇 가지 여쭤볼게요.'],
        questions: ['❓ 언제부터 그러셨나요?', '❓ 얼마나 심하신가요? (참을 만한지, 점점 심해지는지)'],
        homeCare: [],
        visitHospitalIf: [],
      },
    });

    await expect.element(page.getByText('❓ 이렇게 알려 주세요')).toBeVisible();
    for (const el of page.getByTestId('wrap').element().querySelectorAll('li')) {
      expect(Number.parseFloat(getComputedStyle(el).fontSize)).toBeGreaterThanOrEqual(18);
    }
  });

  it('피보호자 화면은 더 크게(22px 이상)', async () => {
    show(
      { content: '', layout: { headline: '🏥 내과 진료를 권해드려요.', body: ['💬 걱정되시겠어요.'], questions: [], homeCare: [], visitHospitalIf: [] } },
      'ward',
    );

    const li = page.getByText('💬 걱정되시겠어요.').element();
    expect(Number.parseFloat(getComputedStyle(li).fontSize)).toBeGreaterThanOrEqual(22);
    const wrap = page.getByTestId('wrap').element();
    expect(wrap.scrollWidth).toBeLessThanOrEqual(wrap.clientWidth + 1); // 375 폭에서 가로 넘침 없음
  });
});
