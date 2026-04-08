import classNames from 'classnames/bind';

import styles from './SignupContent.module.css';
import SignupForm from './SignupForm';

const cx = classNames.bind(styles);

export default function SignupContent() {
  return (
    <div className={cx('content')}>
      <SignupForm />
    </div>
  );
}
