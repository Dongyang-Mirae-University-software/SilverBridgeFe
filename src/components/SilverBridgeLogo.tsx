import { Playfair_Display } from 'next/font/google';
import classNames from 'classnames/bind';

import styles from './SilverBridgeLogo.module.css';

const cx = classNames.bind(styles);

const playfairDisplay = Playfair_Display({ subsets: ['latin'], weight: ['500'] });

type SilverBridgeLogoProps = {
  className?: string;
  subtitle?: string;
};

export function SilverBridgeLogo({ className, subtitle }: SilverBridgeLogoProps) {
  return (
    <div className={cx('logo', className)}>
      <span className={cx('mark', playfairDisplay.className)} aria-hidden="true">
        SB
      </span>
      <span className={cx('text')}>
        <strong className={cx('name')}>SilverBridge</strong>
        {subtitle && <span className={cx('subtitle')}>{subtitle}</span>}
      </span>
    </div>
  );
}
