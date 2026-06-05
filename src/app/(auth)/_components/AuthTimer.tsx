import styles from './AuthTimer.module.css';

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
      {isExpired && <span className={styles.expired}>시간 만료</span>}
    </div>
  );
}
