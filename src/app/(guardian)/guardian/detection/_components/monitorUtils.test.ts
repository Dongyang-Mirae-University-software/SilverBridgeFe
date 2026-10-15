import { describe, expect, it } from 'vitest';

import { pickInitialSessionId } from './monitorUtils';

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
