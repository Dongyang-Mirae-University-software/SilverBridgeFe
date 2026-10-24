'use client';

import classNames from 'classnames/bind';
import dayjs from 'dayjs';

import { Icon } from '@/components/Icon';
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
  WAITING: '답변 기다리는 중',
  ANSWERED: '답변 완료',
};

// 목록은 "8월 7일"처럼 짧게, 올해가 아니면 연도를 붙인다
export function formatInquiryDate(value: string) {
  const date = dayjs(value);
  if (!date.isValid()) return '';
  return date.year() === dayjs().year() ? date.format('M월 D일') : date.format('YYYY년 M월 D일');
}

export function GuardianInquiryCard({ inquiry, onClick }: { inquiry: GuardianInquiry; onClick: () => void }) {
  const answered = inquiry.status === 'ANSWERED' && Boolean(inquiry.answer);

  return (
    <li>
      <button type="button" className={cx('card')} onClick={onClick} aria-label={`${inquiry.title} 문의 자세히 보기`}>
        <div className={cx('head')}>
          <span className={cx('statusBadge', inquiry.status.toLowerCase())}>{INQUIRY_STATUS_LABEL[inquiry.status]}</span>
          <span className={cx('date')}>{formatInquiryDate(inquiry.createdAt)}</span>
          <span className={cx('category')}>{INQUIRY_CATEGORY_LABEL[inquiry.category]}</span>
          <Icon name="chevronRight" size={18} className={cx('chevron')} />
        </div>

        <strong className={cx('title')}>{inquiry.title}</strong>
        {/* 목록 본문은 서버가 앞 100자로 줄여 준다 - 전체는 상세에서만 */}
        <p className={cx('preview')}>{inquiry.content}</p>

        {answered && (
          <div className={cx('replyBox')}>
            <div className={cx('replyLabel')}>답변</div>
            <p className={cx('replyText')}>{inquiry.answer}</p>
          </div>
        )}
      </button>
    </li>
  );
}
