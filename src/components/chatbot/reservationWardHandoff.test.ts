import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RESERVATION_WARD_STORAGE_KEY, saveReservationWardId, takeReservationWardId } from './reservationWardHandoff';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => map.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => void map.set(key, value)),
    removeItem: vi.fn((key: string) => void map.delete(key)),
    map,
  };
}

let storage: ReturnType<typeof memoryStorage>;

beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal('window', { sessionStorage: storage });
});
afterEach(() => vi.unstubAllGlobals());

describe('reservationWardHandoff', () => {
  it('담은 피보호자 ID를 한 번만 꺼내고 바로 지운다', () => {
    saveReservationWardId('ward-2');
    expect(storage.map.get(RESERVATION_WARD_STORAGE_KEY)).toBe('ward-2');
    expect(takeReservationWardId()).toBe('ward-2');
    expect(storage.map.size).toBe(0);
    expect(takeReservationWardId()).toBeNull();
  });

  it('피보호자가 없으면 담지 않는다', () => {
    saveReservationWardId(null);
    saveReservationWardId(undefined);
    saveReservationWardId('');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each([
    ['빈 값', ''],
    ['너무 긴 값', 'w'.repeat(65)],
    ['앞뒤 공백', ' ward-2 '],
  ])('%s은 null로 보고 저장소에서는 지운다', (_label, value) => {
    storage.map.set(RESERVATION_WARD_STORAGE_KEY, value);
    expect(takeReservationWardId()).toBeNull();
    expect(storage.map.size).toBe(0);
  });

  it('저장소 예외는 삼킨다(담기 실패·꺼내기 null)', () => {
    storage.setItem.mockImplementation(() => {
      throw new Error('quota');
    });
    storage.getItem.mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => saveReservationWardId('ward-2')).not.toThrow();
    expect(takeReservationWardId()).toBeNull();
  });

  it('window가 없는 서버 렌더링에서도 던지지 않는다', () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('window', undefined);
    expect(() => saveReservationWardId('ward-2')).not.toThrow();
    expect(takeReservationWardId()).toBeNull();
  });
});
