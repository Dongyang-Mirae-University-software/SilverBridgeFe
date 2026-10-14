import { describe, expect, it, vi } from 'vitest';

import { createWardAuthVerifier } from './wardAuth';

function jsonResponse(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

const WARD_BODY = { data: { data: { role: 'WARD' } } };

function setup(fetcher: ReturnType<typeof vi.fn>, extra: { now?: () => number; maxEntries?: number } = {}) {
  return createWardAuthVerifier({ apiDomain: 'https://api.test/', fetcher, ...extra });
}

describe('wardAuth 캐시', () => {
  it('성공은 TTL 안에서 /user/me를 다시 부르지 않는다', async () => {
    const fetcher = vi.fn().mockImplementation(async () => jsonResponse(200, WARD_BODY));
    let t = 0;
    const verify = setup(fetcher, { now: () => t });

    expect(await verify('tok')).toEqual({ status: 'ok' });
    t = 29_000;
    expect(await verify('tok')).toEqual({ status: 'ok' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('TTL이 지나면 다시 확인한다', async () => {
    const fetcher = vi.fn().mockImplementation(async () => jsonResponse(200, WARD_BODY));
    let t = 0;
    const verify = setup(fetcher, { now: () => t });

    await verify('tok');
    t = 30_001;
    await verify('tok');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('토큰 원문은 캐시 키로 쓰지 않는다 - 다른 토큰은 따로 확인한다', async () => {
    const fetcher = vi.fn().mockImplementation(async () => jsonResponse(200, WARD_BODY));
    const verify = setup(fetcher);

    await verify('a');
    await verify('b');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][0]).toBe('https://api.test/api/user/me');
  });

  it('실패(401·429·5xx·예외·다른 역할)는 캐시하지 않는다', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401))
      .mockResolvedValueOnce(jsonResponse(429, {}, { 'retry-after': '7' }))
      .mockResolvedValueOnce(jsonResponse(500))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(jsonResponse(200, { data: { role: 'GUARDIAN' } }))
      .mockResolvedValueOnce(jsonResponse(200, WARD_BODY));
    const verify = setup(fetcher);

    expect(await verify('t')).toEqual({ status: 'unauthorized' });
    expect(await verify('t')).toEqual({ status: 'rate_limited', retryAfter: '7' });
    expect(await verify('t')).toEqual({ status: 'unavailable' });
    expect(await verify('t')).toEqual({ status: 'unavailable' });
    expect(await verify('t')).toEqual({ status: 'forbidden' });
    expect(await verify('t')).toEqual({ status: 'ok' });
    expect(fetcher).toHaveBeenCalledTimes(6);
  });

  it('같은 토큰의 동시 요청은 한 번만 호출한다', async () => {
    let release: (r: Response) => void = () => {};
    const fetcher = vi.fn().mockImplementation(() => new Promise<Response>(r => (release = r)));
    const verify = setup(fetcher);

    const all = Promise.all([verify('t'), verify('t'), verify('t')]);
    release(jsonResponse(200, WARD_BODY));
    expect(await all).toEqual([{ status: 'ok' }, { status: 'ok' }, { status: 'ok' }]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('항목 수 상한을 넘으면 오래된 것부터 버린다', async () => {
    const fetcher = vi.fn().mockImplementation(async () => jsonResponse(200, WARD_BODY));
    const verify = setup(fetcher, { maxEntries: 2 });

    await verify('a');
    await verify('b');
    await verify('c'); // a가 밀려남
    await verify('b'); // 캐시 히트
    await verify('a'); // 다시 확인
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});
