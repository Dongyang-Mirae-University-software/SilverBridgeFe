'use client';

import type { CSSProperties } from 'react';
import classNames from 'classnames/bind';

import AlertIcon from '@/assets/icons/alert.svg';
import AvatarEditIcon from '@/assets/icons/avatar-edit.svg';
import BackIcon from '@/assets/icons/back.svg';
import BellIcon from '@/assets/icons/bell.svg';
import BrainIcon from '@/assets/icons/brain.svg';
import CakeIcon from '@/assets/icons/cake.svg';
import CameraFlipIcon from '@/assets/icons/camera-flip.svg';
import CameraIcon from '@/assets/icons/camera.svg';
import DashboardIcon from '@/assets/icons/dashboard.svg';
import GameIcon from '@/assets/icons/game.svg';
import GearIcon from '@/assets/icons/gear.svg';
import HandshakeIcon from '@/assets/icons/handshake.svg';
import HeartIcon from '@/assets/icons/heart.svg';
import HomeIcon from '@/assets/icons/home.svg';
import HospitalIcon from '@/assets/icons/hospital.svg';
import InquiryIcon from '@/assets/icons/inquiry.svg';
import KakaoLogoIcon from '@/assets/icons/kakao-logo.svg';
import MailIcon from '@/assets/icons/mail.svg';
import MapPinIcon from '@/assets/icons/map-pin.svg';
import MenuIcon from '@/assets/icons/menu.svg';
import MessageCircleIcon from '@/assets/icons/message-circle.svg';
import MessageIcon from '@/assets/icons/message.svg';
import MonitorIcon from '@/assets/icons/monitor.svg';
import PhoneIcon from '@/assets/icons/phone.svg';
import PillIcon from '@/assets/icons/pill.svg';
import PlusIcon from '@/assets/icons/plus.svg';
import RefreshIcon from '@/assets/icons/refresh.svg';
import SettingsIcon from '@/assets/icons/settings.svg';
import TagIcon from '@/assets/icons/tag.svg';
import UserIcon from '@/assets/icons/user.svg';
import UsersIcon from '@/assets/icons/users.svg';
import WarningIcon from '@/assets/icons/warning.svg';
import styles from './Icon.module.css';

const cx = classNames.bind(styles);

const ICONS = {
  alert: AlertIcon,
  avatarEdit: AvatarEditIcon,
  back: BackIcon,
  bell: BellIcon,
  brain: BrainIcon,
  cake: CakeIcon,
  camera: CameraIcon,
  cameraFlip: CameraFlipIcon,
  dashboard: DashboardIcon,
  game: GameIcon,
  gear: GearIcon,
  handshake: HandshakeIcon,
  heart: HeartIcon,
  home: HomeIcon,
  hospital: HospitalIcon,
  inquiry: InquiryIcon,
  kakaoLogo: KakaoLogoIcon,
  mail: MailIcon,
  mapPin: MapPinIcon,
  menu: MenuIcon,
  message: MessageIcon,
  messageCircle: MessageCircleIcon,
  monitor: MonitorIcon,
  phone: PhoneIcon,
  pill: PillIcon,
  plus: PlusIcon,
  refresh: RefreshIcon,
  settings: SettingsIcon,
  tag: TagIcon,
  user: UserIcon,
  users: UsersIcon,
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
  const style: IconStyle = {
    '--icon-size': typeof size === 'number' ? `${size}px` : size,
    '--icon-src': `url("${resolveSvgSrc(ICONS[name])}")`,
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
