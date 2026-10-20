import classNames from 'classnames/bind';
import Image from 'next/image';
import { ReactNode } from 'react';

import { Icon } from '@/components/Icon';
import styles from './AuthShell.module.css';

const cx = classNames.bind(styles);

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
            <Image
              alt="CareAI 토끼 캐릭터"
              className={cx('character')}
              height={425}
              priority
              src="/images/login-bunny.png"
              width={555}
            />
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
