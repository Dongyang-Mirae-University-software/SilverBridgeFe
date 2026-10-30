import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

import { formatReceivedAt, getMedicationProgress, getPushIconName, getPushKind } from './PushNotificationListener.kind';

const require = createRequire(import.meta.url);
const swPush = require('../../public/push-sw-logic.js');

const TYPES = [
  'WARD_SOS',
  'ANOMALY_DETECTED',
  'ANOMALY_REVIEW_REQUIRED',
  'ANOMALY_REVIEW_SUMMARY',
  'ANOMALY_REVIEW_CONFLICTED',
  'CAMERA_LINK_LOST',
  'MEDICATION_REMINDER',
  'MEDICATION_MISSED',
  'MEDICATION_STOPPED',
  'CONNECTION_REQUEST',
  'CONNECTION_ACCEPTED',
  'CONNECTION_REFUSED',
  'CONNECTION_FORCED',
  'CONNECTION_CANCELLED',
  'CONNECTION_DISCONNECTED',
  'INQUIRY_ANSWERED',
  'UNKNOWN',
];

describe('토스트와 브라우저 알림은 같은 종류·그림을 쓴다', () => {
  it.each(TYPES)('%s', type => {
    for (const detectedType of [undefined, 'FIRE', 'FALL', 'WEAPON', 'NORMAL']) {
      const data = { type, detectedType };
      expect(getPushKind(data)).toBe(swPush.getKind(data));
      expect(`/icons/push/${getPushIconName(data)}.png`).toBe(swPush.getIcon(data));
    }
  });
});

describe('복약 미복용 막대', () => {
  it('두 값이 있으면 체크한 횟수를 계산한다', () => {
    expect(getMedicationProgress({ type: 'MEDICATION_MISSED', totalCount: '3', missedCount: '1' })).toEqual({
      total: 3,
      taken: 2,
      missed: 1,
    });
  });

  it.each([
    { type: 'MEDICATION_MISSED' },
    { type: 'MEDICATION_MISSED', totalCount: '2', missedCount: '3' },
    { type: 'MEDICATION_MISSED', totalCount: 'x', missedCount: '1' },
    { type: 'MEDICATION_REMINDER', totalCount: '3', missedCount: '1' },
  ])('값이 없거나 맞지 않으면 그리지 않는다 %o', data => {
    expect(getMedicationProgress(data)).toBeNull();
  });
});

describe('받은 시각', () => {
  it.each([
    [10_000, '방금'],
    [5 * 60_000, '5분 전'],
    [125 * 60_000, '2시간 전'],
  ])('%i ms 전 → %s', (elapsed, label) => {
    expect(formatReceivedAt(0, elapsed)).toBe(label);
  });
});
