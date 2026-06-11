import type { CSSProperties } from 'react';
import classNames from 'classnames/bind';

import styles from './SilverBridgeLogo.module.css';

const cx = classNames.bind(styles);

type SilverBridgeLogoProps = {
  className?: string;
  width?: number | string;
  height?: number | string;
  accentColor?: string;
  ariaLabel?: string;
};

export function SilverBridgeLogo({
  className,
  width = 210,
  height,
  accentColor,
  ariaLabel = 'SilverBridge',
}: SilverBridgeLogoProps) {
  return (
    <svg
      className={cx('logo', className)}
      viewBox="0 0 210 100"
      width={width}
      height={height}
      role="img"
      aria-label={ariaLabel}
      style={{ '--logo-color': accentColor } as CSSProperties}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>SilverBridge</title>
      <desc>SilverBridge 워드마크 로고 - 테마 자동 대응</desc>
      <defs>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Lora:wght@700&display=swap');
      .sb-silver {
        fill: var(--logo-color, var(--sb-brand));
        font-family: 'Lora', serif;
        font-weight: 700;
        letter-spacing: 4px;
      }
      .sb-bridge {
        fill: #1A1A1A;
        font-family: 'Lora', serif;
        font-weight: 700;
        letter-spacing: 4px;
      }`}</style>
      </defs>
      <text x="0" y="48" fontSize="44" className="sb-silver">
        SILVER
      </text>
      <text x="0" y="92" fontSize="44" className="sb-bridge">
        BRIDGE
      </text>
    </svg>
  );
}
