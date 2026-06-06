import clsx from 'clsx';
import { UseFormRegister } from 'react-hook-form';

import styles from './SignupRoleSelector.module.css';
import { SignupFormValues } from '@/hooks/useSignupForm';
import { RoleType } from '@/service/interface/auth';

interface SignupRoleSelectorProps {
  role: RoleType;
  register: UseFormRegister<SignupFormValues>;
}

export default function SignupRoleSelector({ role, register }: SignupRoleSelectorProps) {
  return (
    <div className={styles.roleSection}>
      <label className={styles.fieldLabel}>가입 유형</label>
      <div className={styles.radioGroup}>
        <label className={clsx(styles.roleCard, styles.wardRole, { [styles.active]: role === 'WARD' })} htmlFor="WARD">
          <input id="WARD" type="radio" value="WARD" {...register('role')} defaultChecked />
          <span className={styles.roleEmoji} aria-hidden="true">
            🌷
          </span>
          <span className={styles.roleCopy}>
            <strong>피보호자</strong>
            <small>직접 사용</small>
          </span>
          {role === 'WARD' && <span className={styles.checkMark}>✓</span>}
        </label>
        <label className={clsx(styles.roleCard, styles.guardianRole, { [styles.active]: role === 'GUARDIAN' })} htmlFor="GUARDIAN">
          <input id="GUARDIAN" type="radio" value="GUARDIAN" {...register('role')} />
          <span className={styles.roleEmoji} aria-hidden="true">
            👨‍👩‍👧
          </span>
          <span className={styles.roleCopy}>
            <strong>보호자</strong>
            <small>가족 돌봄</small>
          </span>
          {role === 'GUARDIAN' && <span className={styles.checkMark}>✓</span>}
        </label>
      </div>
    </div>
  );
}
