import { describe, expect, it } from 'vitest';

import { getCameraPrimaryAction, getModalTitle } from './cameraAction';

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
