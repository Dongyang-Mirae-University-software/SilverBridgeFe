import { describe, expect, it } from 'vitest';

import {
  getCameraPrimaryAction,
  getCardStatus,
  getModalTitle,
  getVisibleFacings,
  parseStoredFacing,
} from './cameraAction';

describe('getCameraPrimaryAction', () => {
  it('이 기기의 카메라가 없으면 등록', () => {
    expect(getCameraPrimaryAction(undefined)).toEqual({ kind: 'register' });
  });
  it('송출 중이면 화면 보기', () => {
    expect(getCameraPrimaryAction({ status: 'running' })).toMatchObject({ kind: 'view', label: '카메라 화면 보기' });
  });
  it('끊김·오프라인이면 카메라 켜기', () => {
    expect(getCameraPrimaryAction({ status: 'disconnected' })).toMatchObject({ kind: 'turnOn', label: '카메라 켜기' });
    expect(getCameraPrimaryAction({ status: 'offline' })).toMatchObject({ kind: 'turnOn' });
  });
  it('상태를 모르면(null) 켜기로 취급하지 않는다', () => {
    expect(getCameraPrimaryAction({ status: null })).toMatchObject({ kind: 'checking' });
  });
});

describe('getModalTitle', () => {
  it('카메라가 없으면 등록', () => {
    expect(getModalTitle(undefined, false)).toBe('이 기기를 카메라로 등록');
  });
  it('이 탭이 송출 중일 때만 화면 보기', () => {
    expect(getModalTitle('거실', true)).toBe('"거실" 카메라 화면 보기');
    expect(getModalTitle('거실', false)).toBe('"거실" 카메라 켜기');
  });
});

describe('parseStoredFacing', () => {
  it('저장된 세 방식을 그대로 돌려준다', () => {
    expect(parseStoredFacing('user')).toBe('user');
    expect(parseStoredFacing('environment')).toBe('environment');
    expect(parseStoredFacing('screen')).toBe('screen');
  });
  it('없거나 알 수 없는 값은 전면', () => {
    expect(parseStoredFacing(null)).toBe('user');
    expect(parseStoredFacing(undefined)).toBe('user');
    expect(parseStoredFacing('rear')).toBe('user');
  });
});

describe('getCardStatus', () => {
  const base = { isThisDevice: false, isConnecting: false };
  it('연결됨은 안내 문구가 없다', () => {
    expect(getCardStatus({ ...base, status: 'running' })).toMatchObject({ label: '연결됨', tone: 'connected', message: null });
  });
  it('상태를 모르면 확인 중', () => {
    expect(getCardStatus({ ...base, status: null })).toMatchObject({ label: '확인 중', tone: 'checking' });
  });
  it('이 기기가 시작하는 중이면 연결하는 중(서버 상태보다 우선)', () => {
    expect(getCardStatus({ status: 'disconnected', isThisDevice: true, isConnecting: true })).toMatchObject({
      label: '연결하는 중...',
      tone: 'connecting',
    });
  });
  it('다른 기기 카드는 시작 중 상태를 따르지 않는다', () => {
    expect(getCardStatus({ status: 'disconnected', isThisDevice: false, isConnecting: true })).toMatchObject({
      label: '연결 안 됨',
    });
  });
  it('끊김 안내는 이 기기와 다른 기기가 다르다', () => {
    expect(getCardStatus({ status: 'disconnected', isThisDevice: true, isConnecting: false }).message).toContain('카메라 켜기');
    expect(getCardStatus({ ...base, status: 'offline' }).message).toContain('화면을 켜 두세요');
  });
});

describe('getVisibleFacings', () => {
  it('기본은 전면·후면만', () => {
    expect(getVisibleFacings('user', false)).toEqual(['user', 'environment']);
  });
  it('화면 공유를 쓰고 있거나 허용하면 화면 공유도 보인다', () => {
    expect(getVisibleFacings('screen', false)).toContain('screen');
    expect(getVisibleFacings('user', true)).toContain('screen');
  });
});
