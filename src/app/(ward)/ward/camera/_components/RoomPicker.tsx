'use client';

import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { WardCameraRoom } from '@/service/interface/ward/camera';
import styles from './RoomPicker.module.css';

const cx = classNames.bind(styles);

interface Props {
  rooms: WardCameraRoom[];
  selectedLabel: string;
  disabled?: boolean;
  onSelect: (label: string) => void;
}

export function RoomPicker({ rooms, selectedLabel, disabled, onSelect }: Props) {
  return (
    <div className={cx('grid')} role="radiogroup" aria-label="방 선택">
      {rooms.map(room => {
        const isLocked = room.registered;

        return (
          <button
            key={room.label}
            type="button"
            className={cx('chip', { active: room.label === selectedLabel, locked: isLocked })}
            disabled={disabled || isLocked}
            onClick={() => onSelect(room.label)}
          >
            <span>{room.label}</span>
            {isLocked && (
              <span className={cx('badge')}>
                <Icon name="alert" size={14} decorative />등록됨
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
