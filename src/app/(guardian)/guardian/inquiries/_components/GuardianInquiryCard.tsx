'use client';

import classNames from 'classnames/bind';

import { formatDateTime } from '@/utils/format/date';
import { GuardianInquiry, InquiryCategory, InquiryStatus } from '@/service/interface/guardian/inquiry';
import styles from './GuardianInquiryCard.module.css';

const cx = classNames.bind(styles);

export const INQUIRY_CATEGORY_LABEL: Record<InquiryCategory, string> = {
  ANOMALY: '이상감지',
  HOSPITAL: '병원',
  ACCOUNT: '계정·회원',
  SERVICE: '서비스 이용',
  ETC: '기타',
};

export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  WAITING: '답변 대기',
  ANSWERED: '답변 완료',
};

export function GuardianInquiryCard({ inquiry, onClick }: { inquiry: GuardianInquiry; onClick: () => void }) {
  return (
    <li>
      <button type="button" className={cx('card')} onClick={onClick}>
        <div className={cx('head')}>
          <span className={cx('categoryBadge')}>{INQUIRY_CATEGORY_LABEL[inquiry.category]}</span>
          <span className={cx('statusBadge', inquiry.status.toLowerCase())}>
            {INQUIRY_STATUS_LABEL[inquiry.status]}
          </span>
        </div>
        <strong className={cx('title')}>{inquiry.title}</strong>
        <p className={cx('preview')}>{inquiry.content}</p>
        <span className={cx('date')}>{formatDateTime(inquiry.createdAt)}</span>
      </button>
    </li>
  );
}
