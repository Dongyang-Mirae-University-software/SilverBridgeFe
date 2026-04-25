'use client';

import classNames from 'classnames/bind';

import { IFindEmailResponse } from '@/service/interface/auth';
import FindEmailResultActions from './FindEmailResultActions';
import FindEmailResultDisplay from './FindEmailResultDisplay';
import styles from './FindEmailContent.module.css';

const cx = classNames.bind(styles);

interface Props {
  result: IFindEmailResponse;
  onBack?: () => void;
}

export default function FindEmailResultStep({ result, onBack }: Props) {
  return (
    <div className={cx('section')}>
      <FindEmailResultDisplay result={result} />
      <FindEmailResultActions onBack={onBack} />
    </div>
  );
}
