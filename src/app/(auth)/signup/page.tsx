import classNames from 'classnames/bind';

import styles from './page.module.css';
import SignupContent from './_component/SignupContent';

const cx = classNames.bind(styles);

export default function Sginup() {
  return (
    <div className={cx('signup-wrap')}>
      <SignupContent />
    </div>
  );
}
