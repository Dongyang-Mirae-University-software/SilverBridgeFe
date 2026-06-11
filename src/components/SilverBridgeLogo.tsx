import type { CSSProperties } from 'react';
import classNames from 'classnames/bind';

import styles from './SilverBridgeLogo.module.css';

const cx = classNames.bind(styles);

type SilverBridgeLogoProps = {
  className?: string;
  width?: number | string;
  height?: number | string;
  accentColor?: string;
  secondaryColor?: string;
  ariaLabel?: string;
};

export function SilverBridgeLogo({
  className,
  width = 140,
  height,
  accentColor,
  secondaryColor,
  ariaLabel = 'SilverBridge',
}: SilverBridgeLogoProps) {
  return (
    <svg
      className={cx('logo', className)}
      viewBox="0 0 300 100"
      width={width}
      height={height}
      role="img"
      aria-label={ariaLabel}
      style={
        {
          '--logo-color': accentColor,
          '--logo-secondary-color': secondaryColor,
        } as CSSProperties
      }
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>SilverBridge</title>
      <desc>SilverBridge 워드마크 로고 - 테마 자동 대응</desc>
      <text x="0" y="48" fontSize="44" className={cx('text', 'silver')}>
        SILVER
      </text>
      <text x="0" y="92" fontSize="44" className={cx('text', 'bridge')}>
        BRIDGE
      </text>
    </svg>
  );
}
