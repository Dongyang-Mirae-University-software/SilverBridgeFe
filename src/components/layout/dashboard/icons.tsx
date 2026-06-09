import classNames from 'classnames/bind';

import styles from './icons.module.css';
import { NavIconName } from './types';

const cx = classNames.bind(styles);

export function MenuIcon() {
  return (
    <svg className={cx('menuIcon')} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function NavIcon({ name }: { name: NavIconName }) {
  switch (name) {
    case 'home':
      return <Icon path="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />;
    case 'phone':
      return (
        <Icon path="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.1 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.8.7a2 2 0 0 1 1.8 2.1Z" />
      );
    case 'message':
      return (
        <Icon path="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.8 8.8 0 0 1-3.5-.9L3 21l1.8-5A8.3 8.3 0 0 1 3 11.5a8.6 8.6 0 0 1 9-8.4 8.6 8.6 0 0 1 9 8.4Z" />
      );
    case 'game':
      return (
        <Icon path="M6 12h4M8 10v4M15 11h.01M18 13h.01M7 17h10a4 4 0 0 0 3.8-5.3l-1.2-3.5A4 4 0 0 0 15.8 5H8.2a4 4 0 0 0-3.8 3.2l-1.2 3.5A4 4 0 0 0 7 17Z" />
      );
    case 'hospital':
      return <Icon path="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M9 21v-6h6v6M9 8h6M12 5v6" />;
    case 'heart':
      return (
        <Icon path="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" />
      );
    case 'users':
      return (
        <Icon path="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
      );
    case 'bell':
      return <Icon path="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0" />;
    case 'settings':
      return (
        <Icon path="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2a2 2 0 1 1-4 0V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H2.8a2 2 0 1 1 0-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V2.8a2 2 0 1 1 4 0V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z" />
      );
    case 'dashboard':
      return <Icon path="M3 13h8V3H3v10ZM13 21h8V11h-8v10ZM13 9h8V3h-8v6ZM3 21h8v-6H3v6Z" />;
    case 'alert':
      return <Icon path="m10.3 3.9-8.5 14.9A2 2 0 0 0 3.5 22h17a2 2 0 0 0 1.7-3.2L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01" />;
    case 'plus':
      return <Icon path="M12 5v14M5 12h14" />;
    case 'inquiry':
      return (
        <Icon path="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.4 1 1.1 1 1.8V17h6v-.5c0-.7.4-1.4 1-1.8A7 7 0 0 0 12 2Z" />
      );
    case 'camera':
      return <Icon path="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />;
    default:
      return null;
  }
}

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}
