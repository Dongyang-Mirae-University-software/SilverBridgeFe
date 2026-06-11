'use client';

import type { CSSProperties } from 'react';
import classNames from 'classnames/bind';

import AlertIcon from '@/assets/icons/alert.svg';
import BrainIcon from '@/assets/icons/brain.svg';
import CakeIcon from '@/assets/icons/cake.svg';
import CameraFlipIcon from '@/assets/icons/camera-flip.svg';
import CameraIcon from '@/assets/icons/camera.svg';
import GearIcon from '@/assets/icons/gear.svg';
import HandshakeIcon from '@/assets/icons/handshake.svg';
import MailIcon from '@/assets/icons/mail.svg';
import MapPinIcon from '@/assets/icons/map-pin.svg';
import MessageCircleIcon from '@/assets/icons/message-circle.svg';
import MonitorIcon from '@/assets/icons/monitor.svg';
import PhoneIcon from '@/assets/icons/phone.svg';
import PillIcon from '@/assets/icons/pill.svg';
import TagIcon from '@/assets/icons/tag.svg';
import UserIcon from '@/assets/icons/user.svg';
import WarningIcon from '@/assets/icons/warning.svg';
import styles from './Icon.module.css';

const cx = classNames.bind(styles);

const ICONS = {
  alert: AlertIcon,
  brain: BrainIcon,
  cake: CakeIcon,
  cameraFlip: CameraFlipIcon,
  camera: CameraIcon,
  gear: GearIcon,
  handshake: HandshakeIcon,
  mail: MailIcon,
  mapPin: MapPinIcon,
  messageCircle: MessageCircleIcon,
  monitor: MonitorIcon,
  phone: PhoneIcon,
  pill: PillIcon,
  tag: TagIcon,
  user: UserIcon,
  warning: WarningIcon,
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
    '--icon-src': `url("${resolveSvgSrc(asset)}")`,
    ...(color ? { color } : {}),
  };

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
