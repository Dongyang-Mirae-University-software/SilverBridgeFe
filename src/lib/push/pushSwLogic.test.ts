import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// 서비스 워커가 importScripts로 읽는 public/push-sw-logic.js 를 그대로 시험한다
const require = createRequire(import.meta.url);
const push = require('../../../public/push-sw-logic.js');

function jwt(claims: Record<string, unknown>) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode(claims)}.signature`;
}

describe('두 번 표시 방어', () => {
  it('notification 블록이 있으면 라이브러리가 이미 띄웠으므로 그리지 않는다', () => {
    expect(push.shouldDraw({ notification: { title: '긴급 SOS' }, data: { type: 'WARD_SOS' } })).toBe(false);
  });

  it('data만 오면 서비스 워커가 직접 그린다', () => {
    expect(push.shouldDraw({ data: { type: 'WARD_SOS', title: '긴급 SOS', body: '도와주세요' } })).toBe(true);
  });
});

describe('알림 모양', () => {
  it('제목·본문은 data를 먼저 쓰고 줄바꿈을 그대로 둔다', () => {
    const { title, options } = push.buildNotification(
      { data: { type: 'MEDICATION_MISSED', title: '복약 확인', body: '첫 줄\n둘째 줄', wardId: 'w1', doseDate: '2026-10-30' } },
      'GUARDIAN',
    );
    expect(title).toBe('복약 확인');
    expect(options.body).toBe('첫 줄\n둘째 줄');
    expect(options.icon).toBe('/icons/push/icon-medication.png');
    expect(options.badge).toBe('/icons/push/badge.png');
    expect(options.tag).toBe('MEDICATION_MISSED:w1-2026-10-30');
    expect(options.renotify).toBe(false);
    expect(options.actions).toEqual([]);
  });

  it('data에 문구가 없으면 예비 문구를 쓴다', () => {
    expect(push.getContent({ data: { type: 'WARD_SOS', wardName: '김순자' } })).toEqual({
      title: '긴급 SOS',
      body: '김순자님이 긴급 도움을 요청했습니다.',
    });
  });

  it('SOS는 피보호자 단위로 묶고(누를 때마다 sosEventId가 달라도) 다시 울리며 닫을 때까지 남는다', () => {
    const first = push.buildNotification({ data: { type: 'WARD_SOS', sosEventId: '7', wardId: 'w1' } }, 'GUARDIAN');
    const second = push.buildNotification({ data: { type: 'WARD_SOS', sosEventId: '8', wardId: 'w1' } }, 'GUARDIAN');
    expect(first.options.tag).toBe('WARD_SOS:w1');
    expect(second.options.tag).toBe(first.options.tag);
    expect(push.getTag({ type: 'WARD_SOS', sosEventId: '7' })).toBe('WARD_SOS:7');
    const { options } = second;
    expect(options.renotify).toBe(true);
    expect(options.requireInteraction).toBe(true);
    expect(options.icon).toBe('/icons/push/icon-sos.png');
    expect(options.actions.map((a: { action: string }) => a.action)).toEqual(['open-sos', 'family-contacts']);
  });

  it('복약 재알림은 회차마다 tag가 다르고 다시 울린다 - 남아 있는 첫 알림을 소리 없이 덮지 않게', () => {
    const base = { type: 'MEDICATION_REMINDER', medicationId: '3', doseDate: '2026-10-30' };
    const first = push.buildNotification({ data: { ...base, attempt: '1' } }, 'WARD');
    const retry = push.buildNotification({ data: { ...base, attempt: '2' } }, 'WARD');
    expect(first.options.tag).toBe('MEDICATION_REMINDER:3:2026-10-30:1');
    expect(retry.options.tag).not.toBe(first.options.tag);
    expect(retry.options.renotify).toBe(true);
  });

  it.each([
    ['FIRE', 'icon-fire'],
    ['FALL', 'icon-fall'],
    ['WEAPON', 'icon-weapon'],
    [undefined, 'icon-anomaly'],
  ])('이상감지 %s 는 %s 그림', (detectedType, icon) => {
    expect(push.getIcon({ type: 'ANOMALY_DETECTED', detectedType })).toBe(`/icons/push/${icon}.png`);
  });

  it('이상감지 버튼은 보호자에게만 보인다', () => {
    expect(push.getActions({ type: 'ANOMALY_DETECTED' }, 'GUARDIAN')).toHaveLength(2);
    expect(push.getActions({ type: 'ANOMALY_DETECTED' }, null)).toHaveLength(2);
    expect(push.getActions({ type: 'ANOMALY_DETECTED' }, 'WARD')).toEqual([]);
  });

  it('모르는 종류는 다리 로고와 기본 제목', () => {
    const { title, options } = push.buildNotification({ data: { type: 'SOMETHING_NEW' } }, null);
    expect(title).toBe('알림');
    expect(options.icon).toBe('/icons/push/icon-default.png');
    expect(options.tag).toBe('SOMETHING_NEW');
  });
});

describe('클릭 경로', () => {
  it('라이브러리가 띄운 알림은 FCM_MSG 안의 data를 쓴다', () => {
    const data = { type: 'WARD_SOS', sosEventId: '1' };
    expect(push.getClickData({ FCM_MSG: { data, notification: { title: 'x' } } })).toEqual(data);
    expect(push.getClickData(data)).toEqual(data);
    expect(push.getClickData(undefined)).toEqual({});
  });

  it.each([
    [{ type: 'WARD_SOS' }, 'GUARDIAN', undefined, '/guardian/sos'],
    [{ type: 'WARD_SOS' }, 'GUARDIAN', 'family-contacts', '/guardian/wards'],
    [{ type: 'ANOMALY_DETECTED', sessionId: 'ward_abc' }, 'GUARDIAN', undefined, '/guardian/detection?session=ward_abc'],
    [{ type: 'ANOMALY_DETECTED', sessionId: 'ward_abc' }, 'GUARDIAN', 'view-clip', '/guardian/detection'],
    [{ type: 'ANOMALY_DETECTED', sessionId: 'ward_abc' }, 'GUARDIAN', 'view-live', '/guardian/detection?session=ward_abc'],
    [{ type: 'ANOMALY_DETECTED', sessionId: 'ward_abc' }, 'WARD', undefined, '/ward'],
    [{ type: 'ANOMALY_REVIEW_REQUIRED' }, 'GUARDIAN', undefined, '/guardian/detection'],
    [{ type: 'MEDICATION_REMINDER' }, 'WARD', undefined, '/ward/medication'],
    [{ type: 'MEDICATION_MISSED' }, 'GUARDIAN', undefined, '/guardian/medication'],
    [{ type: 'CONNECTION_REQUEST' }, 'WARD', undefined, '/ward/guardians'],
    [{ type: 'CONNECTION_ACCEPTED' }, 'GUARDIAN', undefined, '/guardian/wards'],
    [{ type: 'CONNECTION_CANCELLED' }, 'WARD', undefined, '/ward/guardians'],
    [{ type: 'CONNECTION_CANCELLED' }, 'GUARDIAN', undefined, '/guardian/wards'],
    [{ type: 'CONNECTION_FORCED' }, 'WARD', undefined, '/ward/guardians'],
    [{ type: 'INQUIRY_ANSWERED' }, 'GUARDIAN', undefined, '/guardian/inquiries'],
    [{ type: 'UNKNOWN' }, 'WARD', undefined, '/ward'],
    [{ type: 'UNKNOWN' }, null, undefined, '/guardian'],
  ])('%o (%s, %s) → %s', (data, role, action, path) => {
    expect(push.getPath(data, role, action)).toBe(path);
  });
});

describe('역할 판단', () => {
  it('access token의 role만 읽는다', () => {
    expect(push.getRoleFromToken(jwt({ sub: 'u1', role: 'WARD' }))).toBe('WARD');
    expect(push.getRoleFromToken(jwt({ sub: 'u1', role: 'ADMIN' }))).toBeNull();
    expect(push.getRoleFromToken('broken')).toBeNull();
    expect(push.getRoleFromToken(undefined)).toBeNull();
  });

  it('열린 탭 경로로 역할을 고른다', () => {
    expect(push.getRoleFromPath('https://example.com/ward/medication')).toBe('WARD');
    expect(push.getRoleFromPath('https://example.com/guardian')).toBe('GUARDIAN');
    expect(push.getRoleFromPath('https://example.com/login')).toBeNull();
  });
});
