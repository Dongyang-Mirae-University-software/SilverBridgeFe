'use client';

import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { WardCameraRoom } from '@/service/interface/ward/camera';
import styles from './RoomPicker.module.css';

const cx = classNames.bind(styles);

interface Props {
  rooms: WardCameraRoom[];
  selectedLabel: string;
  /** 현재 기기에 이미 등록된 방은 재송출·이름 변경 대상으로 다시 선택할 수 있다. */
  availableRegisteredLabel?: string;
  disabled?: boolean;
  onSelect: (label: string) => void;
}

export function RoomPicker({ rooms, selectedLabel, availableRegisteredLabel, disabled, onSelect }: Props) {
  return (
    <div className={cx('grid')} role="radiogroup" aria-label="방 선택">
      {rooms.map(room => {
        // 다른 기기가 점유한 방만 막는다. 현재 기기의 방은 다시 켜기 위해 선택 가능해야 한다.
        const isLocked = room.registered && room.label !== availableRegisteredLabel;

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
