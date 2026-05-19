import classNames from 'classnames/bind';

import styles from './SignupForm.module.css';

const cx = classNames.bind(styles);

interface SignupErrorPopupProps {
  message: string;
  onClose: () => void;
}

export default function SignupErrorPopup({ message, onClose }: SignupErrorPopupProps) {
  return (
    <div className={cx('popupOverlay')}>
      <div className={cx('popup')}>
        <p className={cx('popupMessage')}>{message}</p>
        <button className={cx('popupButton')} type="button" onClick={onClose}>
          확인
        </button>
      </div>
    </div>
  );
}
