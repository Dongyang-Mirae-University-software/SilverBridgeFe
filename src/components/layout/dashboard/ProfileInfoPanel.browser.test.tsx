// 프로필 수정 칸 - 칸 이름이 입력칸과 이어져 화면 읽기 프로그램·자동 점검이 이름으로 찾는다. 실제 Chrome에서 돈다
import { describe, expect, it, vi } from 'vitest';
import { page } from '@vitest/browser/context';
import { render } from 'vitest-browser-react';

import { ProfileInfoPanel } from './ProfileInfoPanel';

const idleMutation = { isPending: false, mutate: vi.fn() } as never;

describe('ProfileInfoPanel 수정 칸 이름 (Chrome)', () => {
  it('이름·전화번호·성별·주소·휴대폰 인증번호 칸을 이름으로 찾을 수 있다', async () => {
    render(
      <ProfileInfoPanel
        form={{ name: '박보호', phone: '01012345678', gender: 'FEMALE', postcode: '12345', address: '서울', addressDetail: '', birthDate: '1960-01-01' }}
        isEditing
        isPhoneChanged
        isProfilePending={false}
        onAddressSearch={vi.fn()}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        phoneCode=""
        phoneNonce={null}
        setPhoneCode={vi.fn()}
        smsSendMutation={idleMutation}
        smsVerifyMutation={idleMutation}
      />,
    );

    await expect.element(page.getByRole('textbox', { name: '이름' })).toHaveValue('박보호');
    await expect.element(page.getByRole('textbox', { name: '전화번호' })).toHaveValue('010-1234-5678');
    await expect.element(page.getByRole('combobox', { name: '성별' })).toHaveValue('FEMALE');
    await expect.element(page.getByRole('textbox', { name: '우편번호' })).toHaveValue('12345');
    await expect.element(page.getByRole('textbox', { name: '주소', exact: true })).toHaveValue('서울');
    await expect.element(page.getByRole('textbox', { name: '상세 주소' })).toBeVisible();
    await expect.element(page.getByRole('textbox', { name: '휴대폰 인증번호' })).toBeVisible();
  });
});
