// 챗봇 "새 답이 길면 질문부터 보이게" 스크롤(FE #299) 브라우저 테스트 공용 도우미.
import { expect, vi } from 'vitest';

/** 대화 영역(.messageList) - 질문 말풍선(data-message-id)의 스크롤 조상 */
export function messageList(): HTMLElement {
  const bubble = document.querySelector('[data-message-id]');
  return bubble!.closest('[class*="messageList"]') as HTMLElement;
}

/**
 * smooth 스크롤이 멈출 때까지 기다린 대화 영역.
 * 움직이는 도중에 판정하면 지나가는 순간을 잡아 통과할 수 있어, 멈춘 뒤 한 번만 본다.
 */
export async function settledMessageList(): Promise<HTMLElement> {
  let previous = -1;
  let stable = 0;
  await vi.waitFor(
    () => {
      const top = messageList().scrollTop;
      stable = top === previous ? stable + 1 : 0;
      previous = top;
      expect(stable).toBeGreaterThanOrEqual(4);
    },
    { timeout: 5000, interval: 100 },
  );
  return messageList();
}

export function isAtBottom(list: HTMLElement): boolean {
  return list.scrollTop + list.clientHeight >= list.scrollHeight - 2;
}

/** 질문 말풍선 윗부분이 대화 영역 맨 위 근처에 있고, 맨 아래까지 내린 상태가 아니다(답은 아래로 이어 읽는다) */
export function expectQuestionAtTop(list: HTMLElement, question: HTMLElement) {
  // 전제: 질문+답이 대화 영역보다 길다(짧으면 이 판정이 보려는 상황이 아니다)
  expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
  const listTop = list.getBoundingClientRect().top;
  const questionTop = question.getBoundingClientRect().top;
  expect(questionTop).toBeGreaterThanOrEqual(listTop - 1);
  expect(questionTop).toBeLessThan(listTop + 60);
  expect(isAtBottom(list)).toBe(false);
}

/** 질문 말풍선이 대화 영역 안에 보인다 */
export function expectInside(list: HTMLElement, element: HTMLElement) {
  const box = list.getBoundingClientRect();
  const target = element.getBoundingClientRect();
  expect(target.top).toBeGreaterThanOrEqual(box.top - 1);
  expect(target.bottom).toBeLessThanOrEqual(box.bottom + 1);
}
