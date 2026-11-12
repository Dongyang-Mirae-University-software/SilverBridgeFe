import { MoodFace } from '@/components/MoodFace';
import styles from './ChatPeach.module.css';

/**
 * 챗봇 복숭아 얼굴 - 안부 말벗과 같은 캐릭터(MoodFace)를 쓴다. 크기는 className(CSS)으로 정한다(화면 폭마다 다르다).
 * badge = 오른쪽 아래 초록 십자(의료 챗봇 표시, 처음 화면). 장식이라 읽지 않는다.
 */
export default function ChatPeach({ className, badge = false }: { className?: string; badge?: boolean }) {
  return (
    <span className={`${styles.peach} ${className ?? ''}`} aria-hidden="true">
      <MoodFace mood="calm" />
      {badge && (
        <svg className={styles.badge} viewBox="0 0 20 20" focusable="false">
          <circle cx="10" cy="10" r="8.5" fill="#fff" stroke="var(--sb-safe-soft)" strokeWidth="1.2" />
          <path d="M10 5.8v8.4M5.8 10h8.4" stroke="var(--sb-safe)" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}
