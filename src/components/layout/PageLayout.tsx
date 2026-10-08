import { ReactNode } from 'react';
import classNames from 'classnames/bind';

import styles from './PageLayout.module.css';

const cx = classNames.bind(styles);

interface PageLayoutProps {
  title: string;
  description?: string;
  children?: ReactNode;
  actions?: ReactNode;
  // true면 화면 높이에 맞춰 늘어나고(스크롤 없이) children이 남은 공간을 채운다.
  fill?: boolean;
  // 제목은 고정하고 본문만 스크롤해야 하는 화면에 사용한다.
  scrollContent?: boolean;
}

const DEFAULT_DESCRIPTION = '아직 상세 화면을 준비 중입니다.';

export default function PageLayout({ actions, children, description, fill, scrollContent, title }: PageLayoutProps) {
  return (
    <section className={cx('pageLayout', { fill, scrollContent })} aria-labelledby="page-layout-title">
      <header className={cx('header')}>
        <div>
          <h1 id="page-layout-title">{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {actions}
      </header>

      <div className={cx(children ? 'content' : 'emptyContent')}>
        {children ?? (
          <div className={cx('emptyState')}>
            <strong>{title}</strong>
            <span>{description ?? DEFAULT_DESCRIPTION}</span>
          </div>
        )}
      </div>
    </section>
  );
}
