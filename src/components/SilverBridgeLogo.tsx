import { Fredoka } from 'next/font/google';
import classNames from 'classnames/bind';

import styles from './SilverBridgeLogo.module.css';

const cx = classNames.bind(styles);

const fredoka = Fredoka({ subsets: ['latin'], weight: ['600'] });

type SilverBridgeLogoProps = {
  className?: string;
  name?: string;
  subtitle?: string;
};

export function SilverBridgeLogo({ className, name = 'SilverBridge', subtitle }: SilverBridgeLogoProps) {
  return (
    <div className={cx('brand', className)}>
      <div className={cx('title', fredoka.className)}>
        {name}
        {subtitle && <small className={cx('subtitle')}>{subtitle}</small>}
      </div>
    </div>
  );
}
