'use client';

import classNames from 'classnames/bind';

import { WardCameraRoom } from '@/service/interface/ward/camera';
import styles from './RoomPicker.module.css';

const cx = classNames.bind(styles);

interface Props {
  rooms: WardCameraRoom[];
  selectedLabel: string;
  // 방 이름 바꾸기일 때만 넘긴다 — 지금 카메라가 쓰는 방은 registered:true로 와도 선택 가능해야 함
  currentLabel?: string;
  disabled?: boolean;
  onSelect: (label: string) => void;
}

export function RoomPicker({ rooms, selectedLabel, currentLabel, disabled, onSelect }: Props) {
  return (
    <div className={cx('grid')} role="radiogroup" aria-label="방 선택">
      {rooms.map(room => {
        const isCurrent = room.label === currentLabel;
        const isLocked = room.registered && !isCurrent;

        return (
          <button
            key={room.label}
            type="button"
            className={cx('chip', { active: room.label === selectedLabel, locked: isLocked })}
            disabled={disabled || isLocked}
            onClick={() => onSelect(room.label)}
          >
            {room.label}
            {isLocked && <span className={cx('badge')}>· 등록됨</span>}
          </button>
        );
      })}
    </div>
  );
}
