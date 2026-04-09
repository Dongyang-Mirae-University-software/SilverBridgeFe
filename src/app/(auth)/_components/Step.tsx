'use client';

import classNames from 'classnames/bind';

import styles from './Step.module.css';

const cx = classNames.bind(styles);

interface IProps {
  stepList: string[];
  step: number;
}
export default function Step({ stepList, step }: IProps) {
  return (
    <div className={cx('step-list')}>
      {stepList.map((label, index) => {
        const currentStep = index + 1;

        return (
          <div key={label} className={cx('step-item', { active: step >= currentStep })}>
            <span className={cx('step-number')}>{currentStep}</span>
            <span className={cx('step-label')}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
