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
  // true면 제목·설명을 화면에서 숨긴다(스크린 리더는 제목을 그대로 읽는다).
  hideTitle?: boolean;
}

const DEFAULT_DESCRIPTION = '아직 상세 화면을 준비 중입니다.';

export default function PageLayout({ actions, children, description, fill, hideTitle, title }: PageLayoutProps) {
  return (
    <section className={cx('pageLayout', { fill })} aria-labelledby="page-layout-title">
      {hideTitle ? (
        <h1 id="page-layout-title" className={cx('srOnly')}>
          {title}
        </h1>
      ) : (
        <header className={cx('header')}>
          <div>
            <h1 id="page-layout-title">{title}</h1>
            {description && <p>{description}</p>}
          </div>
          {actions}
        </header>
      )}

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
