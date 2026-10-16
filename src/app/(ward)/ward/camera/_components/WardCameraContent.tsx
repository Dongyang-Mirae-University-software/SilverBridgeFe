'use client';

import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { WardCameraList } from './WardCameraList';
import { useWardCameraStream } from './WardCameraStreamProvider';
import styles from './WardCameraContent.module.css';

const cx = classNames.bind(styles);

// '내 카메라' 화면. 송출 엔진(송출 창·송출 루프)은 피보호자 웹 레이아웃의 WardCameraStreamProvider 에 있어
// 이 화면을 떠나도 송출이 이어진다 - 여기서는 그 엔진을 조작만 한다.
export function WardCameraContent() {
  const {
    cameras,
    isLiveError,
    myCamera,
    primaryAction,
    isConnecting,
    isPrimaryBusy,
    isStreamUnstable,
    isSurveillanceLost,
    onPrimary,
    openRegister,
    onThisDeviceDeleted,
  } = useWardCameraStream();

  return (
    <section className={cx('page')}>
      {isSurveillanceLost && (
        <div className={cx('lostBanner')} role="alert">
          다시 연결 중입니다. 화면을 켜 둔 채 잠시 기다려 주세요.
        </div>
      )}
      {isStreamUnstable && !isSurveillanceLost && <p className={cx('registerHint')}>송출이 끊기고 있어요. 화면을 켜 둔 채 잠시 기다려 주세요.</p>}
      {isLiveError && cameras.length === 0 && <p className={cx('registerHint')}>카메라 연결 상태를 확인하는 중이에요. 잠시만 기다려 주세요.</p>}
      {cameras.length > 0 && !myCamera && (
        <div className={cx('registerRow')}>
          <button type="button" className={cx('registerButton')} onClick={openRegister}>
            <Icon name="plus" size={22} decorative />
            이 기기를 카메라로 등록
          </button>
        </div>
      )}

      <WardCameraList
        onRegister={openRegister}
        primaryAction={primaryAction}
        isConnecting={isConnecting}
        isPrimaryBusy={isPrimaryBusy}
        onPrimary={() => void onPrimary()}
        onThisDeviceDeleted={onThisDeviceDeleted}
      />
    </section>
  );
}
