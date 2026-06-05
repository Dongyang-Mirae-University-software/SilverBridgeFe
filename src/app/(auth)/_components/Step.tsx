'use client';

import clsx from 'clsx';

import styles from './Step.module.css';

interface IProps {
  stepList: string[];
  step: number;
}
export default function Step({ stepList, step }: IProps) {
  return (
    <div className={styles['step-list']}>
      {stepList.map((label, index) => {
        const currentStep = index + 1;

        return (
          <div key={label} className={clsx(styles['step-item'], { [styles.active]: step >= currentStep })}>
            <span className={styles['step-number']}>{currentStep}</span>
            <span className={styles['step-label']}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
