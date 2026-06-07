'use client';

import classNames from 'classnames/bind';

import { IFindEmailResponse } from '@/service/interface/auth';
import FindEmailResultActions from './FindEmailResultActions';
import FindEmailResultDisplay from './FindEmailResultDisplay';
import styles from './FindEmailResultStep.module.css';

const cx = classNames.bind(styles);

interface Props {
  result: IFindEmailResponse;
}

export default function FindEmailResultStep({ result }: Props) {
  return (
    <div className={cx('section')}>
      <FindEmailResultDisplay result={result} />
      <FindEmailResultActions />
    </div>
  );
}
