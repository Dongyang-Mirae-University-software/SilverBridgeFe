import classNames from 'classnames/bind';
import styles from './ProfileSecurityPanel.module.css';
const cx = classNames.bind(styles);

interface Props {
  isKakaoUser: boolean;
  isPasswordPending: boolean;
  onOpenPasswordDialog: () => void;
}

export function ProfileSecurityPanel({ isKakaoUser, isPasswordPending, onOpenPasswordDialog }: Props) {
  return (
    <section className={cx('profileManageCard')}>
      <div className={cx('profileManageHeader')}>
        <div>
          <h3>보안</h3>
          <p>비밀번호 변경만 가능합니다.</p>
        </div>
        <button className={cx('profileHeaderAction')} type="button" disabled={isKakaoUser || isPasswordPending} onClick={onOpenPasswordDialog}>
          {isPasswordPending ? '변경 중' : '비밀번호 변경'}
        </button>
      </div>
    </section>
  );
}
