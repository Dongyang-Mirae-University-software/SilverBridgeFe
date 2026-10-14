import { describe, expect, it, vi } from 'vitest';

import { buildUploadSocketUrl, selectTransport, type SelectTransportDeps } from './selectTransport';

function deps(overrides: Partial<SelectTransportDeps> = {}): Partial<SelectTransportDeps> {
  return {
    isPocEnabled: () => true,
    hasEncoder: () => true,
    isConfigSupported: async () => true,
    issueTicket: async () => ({ ticket: 'ut_abc', expiresInSeconds: 60, uploadUrl: 'wss://api.example/ws/camera-upload' }),
    ...overrides,
  };
}

const base = { cameraId: 7, serverTransport: 'ws-h264', width: 1280, height: 720, framerate: 15 };

describe('selectTransport', () => {
  it('모든 조건이 맞을 때만 h264 이다', async () => {
    const choice = await selectTransport({ ...base, deps: deps() });
    expect(choice).toEqual({ kind: 'h264', ticket: 'ut_abc', uploadUrl: 'wss://api.example/ws/camera-upload' });
  });

  it('PoC 플래그가 꺼져 있으면 서버에 아무것도 묻지 않고 jpeg 이다(현재 동작과 동일)', async () => {
    const issueTicket = vi.fn();
    const isConfigSupported = vi.fn();
    const choice = await selectTransport({
      ...base,
      deps: deps({ isPocEnabled: () => false, issueTicket, isConfigSupported }),
    });
    expect(choice).toEqual({ kind: 'jpeg', reason: 'poc_off' });
    expect(issueTicket).not.toHaveBeenCalled();
    expect(isConfigSupported).not.toHaveBeenCalled();
  });

  it('서버 transport 가 jpeg 이거나 없으면 티켓을 요청하지 않는다', async () => {
    const issueTicket = vi.fn();
    for (const serverTransport of ['jpeg', undefined, 'something-else']) {
      const choice = await selectTransport({ ...base, serverTransport, deps: deps({ issueTicket }) });
      expect(choice).toEqual({ kind: 'jpeg', reason: 'server_jpeg' });
    }
    expect(issueTicket).not.toHaveBeenCalled();
  });

  it('VideoEncoder 가 없으면 jpeg', async () => {
    const choice = await selectTransport({ ...base, deps: deps({ hasEncoder: () => false }) });
    expect(choice).toEqual({ kind: 'jpeg', reason: 'no_encoder' });
  });

  it('isConfigSupported 가 false 면 티켓을 요청하지 않고 jpeg', async () => {
    const issueTicket = vi.fn();
    const choice = await selectTransport({ ...base, deps: deps({ isConfigSupported: async () => false, issueTicket }) });
    expect(choice).toEqual({ kind: 'jpeg', reason: 'config_unsupported' });
    expect(issueTicket).not.toHaveBeenCalled();
  });

  it('티켓 발급이 실패하면(409·429·503·네트워크) jpeg', async () => {
    const choice = await selectTransport({
      ...base,
      deps: deps({ issueTicket: async () => { throw new Error('503'); } }),
    });
    expect(choice).toEqual({ kind: 'jpeg', reason: 'ticket_failed' });
  });

  it('ws(s) 가 아닌 업로드 주소는 쓰지 않는다', async () => {
    const choice = await selectTransport({
      ...base,
      deps: deps({ issueTicket: async () => ({ ticket: 'ut_abc', expiresInSeconds: 60, uploadUrl: 'https://evil.example/x' }) }),
    });
    expect(choice).toEqual({ kind: 'jpeg', reason: 'ticket_failed' });
  });
});

describe('buildUploadSocketUrl', () => {
  it('티켓을 쿼리로 붙이고 인코딩한다', () => {
    expect(buildUploadSocketUrl('wss://api.example/ws/camera-upload', 'ut_a-b_c')).toBe(
      'wss://api.example/ws/camera-upload?ticket=ut_a-b_c',
    );
    expect(buildUploadSocketUrl('wss://api.example/ws?x=1', 'a b')).toBe('wss://api.example/ws?x=1&ticket=a%20b');
  });

  it('ws·wss 외 스킴은 거절한다', () => {
    expect(buildUploadSocketUrl('https://api.example/ws', 't')).toBeNull();
    expect(buildUploadSocketUrl('javascript:alert(1)', 't')).toBeNull();
  });
});
