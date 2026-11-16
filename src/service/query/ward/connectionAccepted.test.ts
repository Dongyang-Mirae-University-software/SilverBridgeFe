import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { applyWardConnectionAccepted, wardConnectionsQueryKey } from './connection';
import { wardActiveConnectionsQueryKey } from './sos';

describe('피보호자 연결 맺어짐 반영 (QA ADM-N42)', () => {
  it('관리자 강제 연결이면 가족 목록·SOS 대상을 새로 받고 안내는 이어서 띄운다(false)', () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    expect(applyWardConnectionAccepted(client, { type: 'CONNECTION_FORCED' })).toBe(false);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: wardConnectionsQueryKey });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: wardActiveConnectionsQueryKey });
  });

  it('내가 수락한 연결은 목록만 새로 받고 안내 없이 끝낸다(true)', () => {
    const client = new QueryClient();
    expect(applyWardConnectionAccepted(client, { type: 'CONNECTION_ACCEPTED' })).toBe(true);
  });

  it('다른 신호는 건드리지 않는다', () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    expect(applyWardConnectionAccepted(client, { type: 'SOS_TRIGGERED' })).toBe(false);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
