import classNames from 'classnames/bind';

import styles from './SettingsLoadError.module.css';

const cx = classNames.bind(styles);

// 설정을 불러오지 못했을 때 - 기본값을 실제 값처럼 그리면 꺼 둔 알림이 켜진 것처럼 보이고
// 그 상태로 저장까지 되므로, 토글 대신 이 안내를 보여 준다
export function SettingsLoadError({ onRetry, isRetrying }: { onRetry: () => void; isRetrying: boolean }) {
  return (
    <div className={cx('box')} role="alert">
      <p className={cx('text')}>설정을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
      <button className={cx('retry')} type="button" disabled={isRetrying} onClick={onRetry}>
        {isRetrying ? '불러오는 중…' : '다시 시도'}
      </button>
    </div>
  );
}
