import { ReactNode } from 'react';
import classNames from 'classnames/bind';

import styles from './AuthShell.module.css';

const cx = classNames.bind(styles);

function FriendCharacter() {
  return (
    <svg className={cx('character')} viewBox="0 0 200 200" aria-hidden="true">
      <ellipse cx="100" cy="180" rx="55" ry="6" fill="#000000" opacity="0.08" />
      <ellipse cx="72" cy="38" rx="14" ry="32" fill="#f8e0d4" stroke="#1f1916" strokeWidth="3" />
      <ellipse cx="72" cy="42" rx="6" ry="20" fill="#f4b8a0" />
      <ellipse cx="128" cy="38" rx="14" ry="32" fill="#f8e0d4" stroke="#1f1916" strokeWidth="3" />
      <ellipse cx="128" cy="42" rx="6" ry="20" fill="#f4b8a0" />
      <ellipse cx="100" cy="92" rx="58" ry="52" fill="#f8e0d4" stroke="#1f1916" strokeWidth="3.5" />
      <ellipse cx="62" cy="106" rx="10" ry="6" fill="#f4a48a" opacity="0.65" />
      <ellipse cx="138" cy="106" rx="10" ry="6" fill="#f4a48a" opacity="0.65" />
      <path d="M 78 88 Q 84 80 90 88" stroke="#1f1916" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M 110 88 Q 116 80 122 88" stroke="#1f1916" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M 92 108 Q 100 116 108 108" stroke="#1f1916" strokeWidth="3" fill="#ffffff" strokeLinejoin="round" />
      <line x1="100" y1="108" x2="100" y2="115" stroke="#1f1916" strokeWidth="1.5" />
      <path d="M 60 138 Q 100 162 140 138 L 148 196 L 52 196 Z" fill="#d97757" stroke="#1f1916" strokeWidth="3" />
      <circle cx="100" cy="170" r="3" fill="#1f1916" />
      <g opacity="0.85">
        <path d="M 30 50 l 2 6 l 6 0 l -5 4 l 2 6 l -5 -4 l -5 4 l 2 -6 l -5 -4 l 6 0 z" fill="#e8b84a" />
        <path d="M 170 60 l 1.5 4 l 4 0 l -3 3 l 1 4 l -3.5 -2.5 l -3.5 2.5 l 1 -4 l -3 -3 l 4 0 z" fill="#e8b84a" />
      </g>
    </svg>
  );
}

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className={cx('shell')}>
      <section className={cx('hero')} aria-label="SilverBridge 소개">
        <div className={cx('warmCircle')} />
        <div className={cx('greenCircle')} />
        <div className={cx('heroVisual')}>
          <FriendCharacter />
        </div>
        <div className={cx('copy')}>
          <span className={cx('badge')}>SilverBridge · 시니어 케어</span>
          <h1 className={cx('headline')}>
            가족이 가까이 있는 것처럼,
            <br />
            <span>안심하고 매일을 보내요</span>
          </h1>
          <p className={cx('body')}>
            낙상 감지 · AI 말벗 · 병원 예약 · 보호자 연결까지
            <br />
            하나의 앱에서 함께 돌봅니다.
          </p>
        </div>
      </section>

      <section className={cx('formPane')}>
        <div className={cx('card')}>{children}</div>
      </section>
    </main>
  );
}
