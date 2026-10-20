import classNames from 'classnames/bind';
import { ReactNode } from 'react';

import { Icon } from '@/components/Icon';
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
      <path d="M78 88Q84 80 90 88M110 88q6-8 12 0" stroke="#1f1916" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M92 108q8 8 16 0" stroke="#1f1916" strokeWidth="3" fill="#fff" strokeLinejoin="round" />
      <line x1="100" y1="108" x2="100" y2="115" stroke="#1f1916" strokeWidth="1.5" />
      <path d="M60 138q40 24 80 0l8 58H52Z" fill="#d97757" stroke="#1f1916" strokeWidth="3" />
      <circle cx="100" cy="170" r="3" fill="#1f1916" />
    </svg>
  );
}

function Feature({ icon, label }: { icon: 'camera' | 'hospital' | 'messageCircle' | 'heart'; label: string }) {
  return (
    <div className={cx('feature')}>
      <span className={cx('featureIcon')}>
        <Icon name={icon} size={24} color="var(--sb-brand)" decorative />
      </span>
      <span>{label}</span>
    </div>
  );
}

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className={cx('shell')}>
      <div className={cx('background')} aria-hidden="true">
        <span className={cx('drift', 'driftOne')} />
        <span className={cx('drift', 'driftTwo')} />
        <span className={cx('drift', 'driftThree')} />
      </div>

      <div className={cx('content')}>
        <section className={cx('hero')} aria-label="CareAI 소개">
          <div className={cx('heroVisual')}>
            <FriendCharacter />
            <span className={cx('characterShadow')} />
            <span className={cx('heart', 'heartOne')}>♥</span>
            <span className={cx('heart', 'heartTwo')}>♥</span>
            <span className={cx('star', 'starOne')}>✦</span>
            <span className={cx('star', 'starTwo')}>✦</span>
          </div>

          <div className={cx('copy')}>
            <div className={cx('brand')}>CareAI</div>
            <h1 className={cx('headline')}>
              떨어져 살아도,
              <br />
              <span>마음은 늘 곁에 있어요</span>
            </h1>
            <div className={cx('features')}>
              <Feature icon="camera" label="AI 이상 감지" />
              <Feature icon="hospital" label="AI 의료 챗봇" />
              <Feature icon="messageCircle" label="AI 안부 말벗" />
              <Feature icon="heart" label="AI 정서 분석" />
            </div>
          </div>
        </section>

        <section className={cx('formPane')}>
          <div className={cx('card')}>
            <svg className={cx('bunnyEars')} aria-hidden="true" viewBox="0 0 120 58">
              <g className={cx('ear')}>
                <path d="M24 58C18 30 22 6 34 4c12-2 16 26 16 54Z" />
                <path className={cx('innerEar')} d="M31 56c-3-20-1-40 5-42 6-1 7 22 7 42Z" />
              </g>
              <path d="M70 58c0-28 4-52 16-52 12 0 14 26 8 52Z" />
              <path className={cx('innerEar')} d="M77 56c0-20 3-38 9-39 6 0 6 21 2 39Z" />
              <rect x="14" y="54" width="94" height="6" />
            </svg>
            {children}
          </div>
        </section>
      </div>

      <footer className={cx('footer')}>
        <div>본 데모는 학습 목적으로 제작되었으며, 화면에 등장하는 환자·병원·통계는 모두 가상의 데이터입니다.</div>
        <div>© 2026 Team SilverBridge · 학생 프로젝트</div>
      </footer>
    </main>
  );
}
