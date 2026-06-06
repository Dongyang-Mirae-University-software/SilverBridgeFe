'use client';


import styles from './FindPasswordMethodStep.module.css';
const cx = classNames.bind(styles);

type Method = 'email' | 'sms';

interface Props {
  onSelectMethod: (method: Method) => void;
}

export default function FindPasswordMethodStep({ onSelectMethod }: Props) {
  return (
    <div className={cx('section')}>
      <h2 className={cx('stepTitle')}>비밀번호 찾기 방식 선택</h2>
      <p className={cx('description')}>비밀번호를 찾을 방법을 선택하세요.</p>
      <div className={cx('methodButtons')}>
        <button className={cx('methodButton')} onClick={() => onSelectMethod('email')}>
          <span className={cx('methodIcon')}>✉</span>
          <span>
            <strong>이메일 인증</strong>
            <small>가입 이메일로 코드 발송</small>
          </span>
        </button>
        <button className={cx('methodButton')} onClick={() => onSelectMethod('sms')}>
          <span className={cx('methodIcon')}>▣</span>
          <span>
            <strong>SMS 인증</strong>
            <small>등록한 휴대폰으로 발송</small>
          </span>
        </button>
      </div>
    </div>
  );
}
