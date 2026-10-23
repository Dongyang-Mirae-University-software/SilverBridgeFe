// 토큰·세션 단위 테스트용 가짜 브라우저 환경(node). document.cookie 를 흉내 내 쿠키별 max-age 를 기록한다
import { vi } from 'vitest';

export interface StoredCookie {
  value: string;
  maxAge?: number;
}

export function installCookieJar() {
  const jar = new Map<string, StoredCookie>();

  vi.stubGlobal('document', {
    get cookie() {
      return [...jar.entries()].map(([name, cookie]) => `${name}=${cookie.value}`).join('; ');
    },
    set cookie(raw: string) {
      const [pair, ...attributes] = raw.split(';').map(part => part.trim());
      const separator = pair.indexOf('=');
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      const maxAgeAttribute = attributes.find(attribute => attribute.toLowerCase().startsWith('max-age='));
      const maxAge = maxAgeAttribute ? Number(maxAgeAttribute.split('=')[1]) : undefined;

      if (maxAge === 0) jar.delete(name);
      else jar.set(name, { value: decodeURIComponent(value), maxAge });
    },
  });

  return jar;
}

// 서명 없는 JWT 모양 토큰(화면 이동·만료 판단용 클레임만)
export function fakeJwt(claims: { role?: string; exp?: number }) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode(claims)}.sig`;
}

export function validAccessToken(role = 'GUARDIAN') {
  return fakeJwt({ role, exp: Math.floor(Date.now() / 1000) + 1800 });
}

export function expiredAccessToken(role = 'GUARDIAN') {
  return fakeJwt({ role, exp: Math.floor(Date.now() / 1000) - 60 });
}
