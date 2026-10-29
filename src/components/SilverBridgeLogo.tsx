import { Fredoka } from 'next/font/google';
import classNames from 'classnames/bind';

import styles from './SilverBridgeLogo.module.css';

const cx = classNames.bind(styles);

const fredoka = Fredoka({ subsets: ['latin'], weight: ['600'] });

type SilverBridgeLogoProps = {
  className?: string;
  name?: string;
  subtitle?: string;
  variant?: 'sidebar' | 'compactHeader' | 'wardHeader';
};

// 이름은 기존 컴포넌트명을 유지하되, v13 사용자 웹 브랜드는 CareAI로 통일한다.
export function SilverBridgeLogo({ className, name = 'CareAI', subtitle, variant = 'sidebar' }: SilverBridgeLogoProps) {
  return (
    <div className={cx('brand', className)}>
      <div className={cx('title', variant, fredoka.className)}>
        {name}
        {subtitle && <small className={cx('subtitle')}>{subtitle}</small>}
      </div>
    </div>
  );
}
