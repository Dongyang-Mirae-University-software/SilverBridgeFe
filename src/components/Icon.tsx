'use client';

import type { CSSProperties } from 'react';
import classNames from 'classnames/bind';

import AlertIcon from '@/assets/icons/alert.svg';
import BrainIcon from '@/assets/icons/brain.svg';
import BackIcon from '@/assets/icons/back.svg';
import CakeIcon from '@/assets/icons/cake.svg';
import CameraFlipIcon from '@/assets/icons/camera-flip.svg';
import CameraIcon from '@/assets/icons/camera.svg';
import GearIcon from '@/assets/icons/gear.svg';
import KakaoLogoIcon from '@/assets/icons/kakao-logo.svg';
import HandshakeIcon from '@/assets/icons/handshake.svg';
import MailIcon from '@/assets/icons/mail.svg';
import MapPinIcon from '@/assets/icons/map-pin.svg';
import MessageCircleIcon from '@/assets/icons/message-circle.svg';
import MonitorIcon from '@/assets/icons/monitor.svg';
import PhoneIcon from '@/assets/icons/phone.svg';
import PillIcon from '@/assets/icons/pill.svg';
import TagIcon from '@/assets/icons/tag.svg';
import AvatarEditIcon from '@/assets/icons/avatar-edit.svg';
import UserIcon from '@/assets/icons/user.svg';
import WarningIcon from '@/assets/icons/warning.svg';
import styles from './Icon.module.css';

const cx = classNames.bind(styles);

const ICONS = {
  alert: { kind: 'asset', src: AlertIcon },
  back: { kind: 'asset', src: BackIcon },
  brain: { kind: 'asset', src: BrainIcon },
  cake: { kind: 'asset', src: CakeIcon },
  cameraFlip: { kind: 'asset', src: CameraFlipIcon },
  camera: { kind: 'asset', src: CameraIcon },
  gear: { kind: 'asset', src: GearIcon },
  kakaoLogo: { kind: 'asset', src: KakaoLogoIcon },
  handshake: { kind: 'asset', src: HandshakeIcon },
  mail: { kind: 'asset', src: MailIcon },
  mapPin: { kind: 'asset', src: MapPinIcon },
  messageCircle: { kind: 'asset', src: MessageCircleIcon },
  monitor: { kind: 'asset', src: MonitorIcon },
  phone: { kind: 'asset', src: PhoneIcon },
  pill: { kind: 'asset', src: PillIcon },
  refresh: {
    kind: 'path',
    d: 'M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5',
  },
  tag: { kind: 'asset', src: TagIcon },
  avatarEdit: { kind: 'asset', src: AvatarEditIcon },
  user: { kind: 'asset', src: UserIcon },
  warning: { kind: 'asset', src: WarningIcon },
  menu: { kind: 'path', d: 'M4 7h16M4 12h16M4 17h16' },
  home: { kind: 'path', d: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  message: {
    kind: 'path',
    d: 'M21 11.5a8.4 8.4 0 0 1-9 8.4 8.8 8.8 0 0 1-3.5-.9L3 21l1.8-5A8.3 8.3 0 0 1 3 11.5a8.6 8.6 0 0 1 9-8.4 8.6 8.6 0 0 1 9 8.4Z',
  },
  game: {
    kind: 'path',
    d: 'M6 12h4M8 10v4M15 11h.01M18 13h.01M7 17h10a4 4 0 0 0 3.8-5.3l-1.2-3.5A4 4 0 0 0 15.8 5H8.2a4 4 0 0 0-3.8 3.2l-1.2 3.5A4 4 0 0 0 7 17Z',
  },
  hospital: { kind: 'path', d: 'M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M9 21v-6h6v6M9 8h6M12 5v6' },
  heart: {
    kind: 'path',
    d: 'M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z',
  },
  users: {
    kind: 'path',
    d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  },
  bell: { kind: 'path', d: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0' },
  settings: {
    kind: 'path',
    d: 'M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2a2 2 0 1 1-4 0V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H2.8a2 2 0 1 1 0-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V2.8a2 2 0 1 1 4 0V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z',
  },
  dashboard: { kind: 'path', d: 'M3 13h8V3H3v10ZM13 21h8V11h-8v10ZM13 9h8V3h-8v6ZM3 21h8v-6H3v6Z' },
  plus: { kind: 'path', d: 'M12 5v14M5 12h14' },
  inquiry: {
    kind: 'path',
    d: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.4 1 1.1 1 1.8V17h6v-.5c0-.7.4-1.4 1-1.8A7 7 0 0 0 12 2Z',
  },
} as const;

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  size?: number | string;
  color?: string;
  label?: string;
  className?: string;
  decorative?: boolean;
};

type IconStyle = CSSProperties & {
  '--icon-size'?: string;
  '--icon-src'?: string;
};

function resolveSvgSrc(asset: string | { src: string }) {
  return typeof asset === 'string' ? asset : asset.src;
}

export function Icon({ name, size = 24, color, label, className, decorative = true }: IconProps) {
  const asset = ICONS[name];

  const style: IconStyle = {
    '--icon-size': typeof size === 'number' ? `${size}px` : size,
    ...(color ? { color } : {}),
  };

  if (asset.kind === 'asset') {
    style['--icon-src'] = `url("${resolveSvgSrc(asset.src)}")`;
  }

  if (asset.kind === 'path') {
    return (
      <svg
        className={cx('svgIcon', className)}
        style={style}
        viewBox="0 0 24 24"
        aria-hidden={decorative && !label ? true : undefined}
        aria-label={label}
        role={label ? 'img' : undefined}
      >
        <path d={asset.d} />
      </svg>
    );
  }

  return (
    <span
      className={cx('icon', className)}
      style={style}
      aria-hidden={decorative && !label ? true : undefined}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  );
}

export function getIconNameList(): IconName[] {
  return Object.keys(ICONS) as IconName[];
}
