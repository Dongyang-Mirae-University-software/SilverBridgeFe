import classNames from 'classnames/bind';
import styles from './AuthTimer.module.css';
const cx = classNames.bind(styles);

interface Props {
  time: string;
  isExpired: boolean;
  content?: string;
}

export default function AuthTimer({ time, isExpired, content }: Props) {
  return (
    <div>
      {content && <p>{content}</p>}
      <span>{time}</span>
      {isExpired && <span className={cx('expired')}>시간 만료</span>}
    </div>
  );
}
