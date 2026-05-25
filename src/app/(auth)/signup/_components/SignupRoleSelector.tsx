import classNames from 'classnames/bind';
import { UseFormRegister } from 'react-hook-form';

import styles from './SignupForm.module.css';
import { SignupFormValues } from '@/hooks/useSignupForm';
import { RoleType } from '@/service/interface/auth';

const cx = classNames.bind(styles);

interface SignupRoleSelectorProps {
  role: RoleType;
  register: UseFormRegister<SignupFormValues>;
}

export default function SignupRoleSelector({ role, register }: SignupRoleSelectorProps) {
  return (
    <div className={cx('roleSection')}>
      <label className={cx('fieldLabel')}>가입 유형</label>
      <div className={cx('radioGroup')}>
        <label className={cx('roleCard', { active: role === 'WARD' })} htmlFor="WARD">
          <input id="WARD" type="radio" value="WARD" {...register('role')} defaultChecked />
          <span className={cx('roleEmoji')}>피</span>
          <span className={cx('roleCopy')}>
            <strong>피보호자</strong>
            <small>직접 사용</small>
          </span>
          {role === 'WARD' && <span className={cx('checkMark')}>✓</span>}
        </label>
        <label className={cx('roleCard', { active: role === 'GUARDIAN' })} htmlFor="GUARDIAN">
          <input id="GUARDIAN" type="radio" value="GUARDIAN" {...register('role')} />
          <span className={cx('roleEmoji')}>보</span>
          <span className={cx('roleCopy')}>
            <strong>보호자</strong>
            <small>가족 돌봄</small>
          </span>
          {role === 'GUARDIAN' && <span className={cx('checkMark')}>✓</span>}
        </label>
      </div>
    </div>
  );
}
