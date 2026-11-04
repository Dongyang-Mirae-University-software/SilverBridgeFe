// 챗봇 답 말풍선 - 답 모양(layout, AI 2026-11-01)과 옛 형식 호환. 실제 Chrome에서 돈다(`npm run test:browser`)
// 합성 문장만 쓴다. 문구·이모지로 판단하지 않는지(있는지만 보는지)도 확인한다.

import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import type { ChatMessage } from '@/service/interface/chat';

vi.mock('@/components/UserAvatar', () => ({ UserAvatar: () => <span /> }));

import ChatBubble from './ChatBubble';

const base: ChatMessage = { id: 'a1', role: 'assistant', content: '', timestamp: '2026-11-01T00:00:00Z' };

function show(message: Partial<ChatMessage>, variant: 'guardian' | 'ward' = 'guardian') {
  return render(
    <div data-testid="wrap" style={{ width: 375 }}>
      <ChatBubble message={{ ...base, ...message }} isLastAssistant onUiSelect={vi.fn()} onShowList={vi.fn()} variant={variant} />
    </div>,
  );
}

function textOrder(): string[] {
  const root = page.getByTestId('wrap').element();
  return Array.from(root.querySelectorAll('p, li')).map(el => el.textContent ?? '');
}

describe('ChatBubble 답 모양', () => {
  it('핵심 한 줄·본문·카드를 칸별로 그리고 빈 칸은 그리지 않는다', async () => {
    await show({
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
    await show({
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
    await show({ content: '말씀해 주신 내용을 정리했어요.\n· 증상: 기침', layout: undefined });

    const reply = page.getByText(/· 증상: 기침/).element();
    expect(getComputedStyle(reply).whiteSpace).toBe('pre-wrap');
    expect(page.getByText('🏥 이럴 땐 병원으로').elements()).toHaveLength(0);
  });

  it('옛 형식에서도 응급 상자는 reply 글보다 위', async () => {
    await show({ content: '옛 응급 답', emergencyWarning: ['지금 바로 119에 전화하세요.'], layout: null });

    const order = textOrder();
    expect(order.indexOf('응급 주의')).toBeLessThan(order.indexOf('옛 응급 답'));
  });

  it('이상한 layout(문장 없음·문자열 아님)은 무시하고 reply 로 그린다', async () => {
    await show({
      content: '대체 답',
      layout: { headline: '', body: [1 as unknown as string], questions: [], homeCare: [], visitHospitalIf: [] },
    });

    await expect.element(page.getByText('대체 답')).toBeVisible();
  });

  it('되묻기 질문은 질문 칸에, 글자는 18px 이상', async () => {
    await show({
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
    await show(
      { content: '', layout: { headline: '🏥 내과 진료를 권해드려요.', body: ['💬 걱정되시겠어요.'], questions: [], homeCare: [], visitHospitalIf: [] } },
      'ward',
    );

    const li = page.getByText('💬 걱정되시겠어요.').element();
    expect(Number.parseFloat(getComputedStyle(li).fontSize)).toBeGreaterThanOrEqual(22);
    const wrap = page.getByTestId('wrap').element();
    expect(wrap.scrollWidth).toBeLessThanOrEqual(wrap.clientWidth + 1); // 375 폭에서 가로 넘침 없음
  });

  it('줄 머리 이모지·카드 제목 아이콘은 화면 읽기 프로그램에서 숨긴다(글은 그대로 읽힘)', async () => {
    await show({
      content: '',
      layout: {
        headline: '🏥 내과 진료를 권해드려요.',
        body: ['💧 물을 자주 드세요.', '이모지 없는 줄'],
        questions: [],
        homeCare: ['🛏️ 푹 쉬세요.'],
        visitHospitalIf: ['⚠️ 숨이 차면 119에 연락하세요.'],
      },
    });

    const root = page.getByTestId('wrap').element();
    const hidden = Array.from(root.querySelectorAll('[aria-hidden="true"]')).map(el => el.textContent?.trim());
    expect(hidden).toEqual(expect.arrayContaining(['🏥', '💧', '🛏️', '⚠️']));
    // 숨긴 것은 맨 앞 이모지뿐 - 문장 글자는 숨기지 않는다
    for (const el of root.querySelectorAll('[aria-hidden="true"]')) {
      expect(/[가-힣0-9]/.test(el.textContent ?? '')).toBe(false);
    }
    const plainLine = page.getByText('이모지 없는 줄').element();
    expect(plainLine.querySelector('[aria-hidden]')).toBeNull();
    // 카드 제목 아이콘도 숨기고 제목 글은 남긴다
    const title = page.getByText('이럴 땐 병원으로').element();
    expect(title.querySelector('[aria-hidden="true"]')?.textContent?.trim()).toBe('🏥');
    // 119 굵게 강조는 이모지를 떼어 낸 뒤에도 그대로
    expect(root.querySelector('strong')?.textContent).toBe('119');
  });

  it('layout·경고·옛 reply 안의 HTML 은 글자로만 보이고 태그로 해석하지 않는다(XSS)', async () => {
    const payload = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>';
    await show({
      content: `💬 ${payload}`,
      emergencyWarning: [payload],
      layout: {
        headline: `🚨 ${payload}`,
        body: [payload],
        questions: [`❓ ${payload}`],
        homeCare: [payload],
        visitHospitalIf: [payload],
      },
    });
    const root = page.getByTestId('wrap').element();
    expect(root.querySelectorAll('img, script, iframe').length).toBe(0);
    expect(root.textContent).toContain('<img src=x');
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();

    // 옛 형식(reply 글)도 같다
    await show({ content: payload, layout: null });
    expect(document.querySelectorAll('[data-testid="wrap"] img, [data-testid="wrap"] script').length).toBe(0);
  });
});

describe('ChatBubble 피보호자 문장 줄바꿈 (2026-11-04)', () => {
  const reply = '정형외과로 가시면 돼요. 가까운 정형외과를 찾아드릴게요. 어느 지역에서 찾을까요?';

  function lineCount(el: Element): number {
    const style = getComputedStyle(el);
    return Math.round(el.getBoundingClientRect().height / Number.parseFloat(style.lineHeight));
  }

  it('피보호자 답 본문은 문장마다 줄을 나누고 원문 메시지는 그대로다', async () => {
    const message = { content: reply };
    await show(message, 'ward');
    const p = page.getByTestId('wrap').element().querySelector('p')!;
    expect(p.textContent).toBe('정형외과로 가시면 돼요.\n가까운 정형외과를 찾아드릴게요.\n어느 지역에서 찾을까요?');
    expect(lineCount(p)).toBeGreaterThanOrEqual(3);
    expect(message.content).toBe(reply);
  });

  it('피보호자 layout 핵심 줄·본문은 나누고 카드 항목은 그대로 둔다', async () => {
    await show(
      {
        content: '',
        layout: {
          headline: '정형외과가 좋아요. 예약도 도와드려요.',
          body: ['많이 아프시죠? 조금만 기다려 주세요.'],
          questions: [],
          homeCare: ['찜질을 하세요. 쉬세요.'],
          visitHospitalIf: [],
        },
      },
      'ward',
    );
    const texts = textOrder();
    expect(texts).toContain('정형외과가 좋아요.\n예약도 도와드려요.');
    expect(texts).toContain('많이 아프시죠?\n조금만 기다려 주세요.');
    expect(texts).toContain('찜질을 하세요. 쉬세요.');
  });

  it('보호자 화면은 그대로 한 덩어리다', async () => {
    await show({ content: reply }, 'guardian');
    const p = page.getByTestId('wrap').element().querySelector('p')!;
    expect(p.textContent).toBe(reply);
  });
});

