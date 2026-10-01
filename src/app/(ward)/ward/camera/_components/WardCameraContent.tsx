'use client';

import classNames from 'classnames/bind';

import { CameraRegisterSection } from './CameraRegisterSection';
import { WardCameraList } from './WardCameraList';
import styles from './WardCameraContent.module.css';

const cx = classNames.bind(styles);

export function WardCameraContent() {
  return (
    <section className={cx('page')}>
      <CameraRegisterSection />
      <WardCameraList />
    </section>
  );
}
