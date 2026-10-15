import { describe, expect, it } from 'vitest';

import { getStreamResumeAction, needsReselect, pickInitialSessionId } from './monitorUtils';

const bedroomOff = { sessionId: 'bed', wardId: 'w1', status: 'offline' as const };
const livingOn = { sessionId: 'living', wardId: 'w1', status: 'running' as const };
const otherWardOn = { sessionId: 'other', wardId: 'w2', status: 'running' as const };

describe('pickInitialSessionId', () => {
  it('지정한 카메라가 목록에 있으면 그 카메라', () => {
    expect(pickInitialSessionId([bedroomOff, livingOn], 'bed')).toBe('bed');
  });
  it('지정이 없으면 꺼진 카메라보다 송출 중인 카메라를 먼저 고른다', () => {
    expect(pickInitialSessionId([bedroomOff, livingOn])).toBe('living');
  });
  it('송출 중인 카메라가 없으면 첫 카메라', () => {
    expect(pickInitialSessionId([bedroomOff, { ...livingOn, status: null }])).toBe('bed');
  });
  it('피보호자를 지정하면 그 피보호자의 카메라 중에서만 고른다', () => {
    expect(pickInitialSessionId([otherWardOn, bedroomOff, livingOn], null, 'w1')).toBe('living');
    expect(pickInitialSessionId([otherWardOn], null, 'w1')).toBeUndefined();
  });
  it('지정한 카메라가 목록에 없으면 기본 규칙을 따른다', () => {
    expect(pickInitialSessionId([bedroomOff, livingOn], 'gone')).toBe('living');
  });
  it('카메라가 없으면 고르지 않는다', () => {
    expect(pickInitialSessionId([])).toBeUndefined();
  });
});

describe('getStreamResumeAction', () => {
  const at = (sessionId: string | null, status: 'running' | 'disconnected' | 'offline' | null | undefined) => ({
    sessionId,
    status,
  });
  it('보던 카메라가 끊기면 써 버린 영상 주소를 버린다', () => {
    expect(getStreamResumeAction(at('k', 'running'), at('k', 'offline'))).toBe('drop');
    expect(getStreamResumeAction(at('k', 'running'), at('k', 'disconnected'))).toBe('drop');
  });
  it('끊겼던 카메라가 다시 송출되면 새 티켓으로 다시 연다(끄기 → 다시 켜기)', () => {
    expect(getStreamResumeAction(at('k', 'offline'), at('k', 'running'))).toBe('reopen');
    expect(getStreamResumeAction(at('k', 'disconnected'), at('k', 'running'))).toBe('reopen');
  });
  it('상태가 그대로면 아무것도 하지 않는다(반복 요청 없음)', () => {
    expect(getStreamResumeAction(at('k', 'running'), at('k', 'running'))).toBe('none');
    expect(getStreamResumeAction(at('k', 'offline'), at('k', 'offline'))).toBe('none');
  });
  it('다른 카메라로 바꾸는 중이면 카메라 선택에 맡긴다', () => {
    expect(getStreamResumeAction(at('bed', 'offline'), at('kitchen', 'running'))).toBe('none');
  });
  it('상태를 모르거나 조회 전에서 송출 중으로 바뀌면 다시 열지 않는다(선택 때 이미 열었다)', () => {
    expect(getStreamResumeAction(at('k', undefined), at('k', 'running'))).toBe('none');
    expect(getStreamResumeAction(at('k', null), at('k', 'running'))).toBe('none');
  });
  it('끊김에서 상태 모름(null)으로 바뀌면 기다린다', () => {
    expect(getStreamResumeAction(at('k', 'offline'), at('k', null))).toBe('none');
  });
  it('선택한 카메라가 없으면 아무것도 하지 않는다', () => {
    expect(getStreamResumeAction(at(null, 'offline'), at(null, 'running'))).toBe('none');
  });
});

describe('needsReselect', () => {
  it('보던 카메라가 목록에서 사라지면(등록 해제 후 재등록) 다시 고른다', () => {
    expect(needsReselect([{ sessionId: 'new' }], 'old')).toBe(true);
  });
  it('처음 열 때 아무것도 고르지 않았으면 고른다', () => {
    expect(needsReselect([{ sessionId: 'a' }], null)).toBe(true);
  });
  it('보던 카메라가 그대로 있거나 목록이 비면 그대로 둔다', () => {
    expect(needsReselect([{ sessionId: 'a' }, { sessionId: 'b' }], 'b')).toBe(false);
    expect(needsReselect([], 'old')).toBe(false);
  });
});
