'use client';

import classNames from 'classnames/bind';

import { UserAvatar } from '@/components/UserAvatar';
import { IConnectionItem } from '@/service/interface/connection';
import {
  formatPartnerGender,
  getActivePartnerValue,
  getConnectionStatusClass,
  getConnectionStatusLabel,
  getPartnerPhoneValue,
} from './ConnectionShared';
import styles from './ConnectionShared.module.css';

const cx = classNames.bind(styles);

function formatDate(value: string | null) {
  if (!value) return '미연결';

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getConnectionAddress(connection: IConnectionItem) {
  return [connection.partnerAddress, connection.partnerAddressDetail].filter(Boolean).join(' ');
}

function ConnectionDetail({ icon, label, value }: { icon: string; label: string; value?: string | null }) {
  return (
    <li className={cx('connectionDetailRow')}>
      <span className={cx('connectionDetailLabel')}>
        <span className={cx('connectionDetailIcon')} aria-hidden="true">
          {icon}
        </span>
        {label}
      </span>
      <strong className={cx('connectionDetailValue')}>{value || '정보 없음'}</strong>
    </li>
  );
}

export function ConnectionCard({
  connection,
  isPending,
  role,
  primaryAction,
  primaryLabel,
  secondaryAction,
  secondaryLabel,
}: {
  connection: IConnectionItem;
  isPending: boolean;
  role: 'guardian' | 'ward';
  primaryAction?: () => void;
  primaryLabel?: string;
  secondaryAction?: () => void;
  secondaryLabel?: string;
}) {
  const address = connection.status === 'ACTIVE' ? getConnectionAddress(connection) : '';
  const dateLabel = connection.status === 'ACTIVE' ? '연결일' : '요청일';
  const dateValue =
    connection.status === 'ACTIVE' ? formatDate(connection.connectedAt) : formatDate(connection.createdAt);
  const profileLabel = connection.status === 'ACTIVE' ? '연결됨' : getConnectionStatusLabel(connection.status);
  return (
    <li className={cx('connectionCard')} data-role={role}>
      <div className={cx('connectionCardMain')}>
        <UserAvatar size="w-120" imageUrl={connection.partnerProfileImage} />
        <div className={cx('connectionInfo')}>
          <div className={cx('connectionTitleRow')}>
            <div className={cx('connectionNameBlock')}>
              <strong>{connection.partnerName || '이름 확인 전'}</strong>
              <span>{connection.relation || '관계 정보 없음'}</span>
            </div>
            <span className={cx('connectionStatus', getConnectionStatusClass(connection.status))}>{profileLabel}</span>
          </div>

          <div className={cx('connectionSummaryRow')}>
            <span>🗓 {dateValue}</span>
          </div>

          <ul className={cx('connectionDetailList')}>
            <ConnectionDetail icon="📞" label="전화번호" value={getPartnerPhoneValue(connection)} />
            <ConnectionDetail icon="📍" label="주소" value={getActivePartnerValue(connection, address)} />
            <ConnectionDetail
              icon="📧"
              label="이메일"
              value={getActivePartnerValue(connection, connection.partnerEmail)}
            />
            <ConnectionDetail
              icon="👤"
              label="성별"
              value={getActivePartnerValue(connection, formatPartnerGender(connection.partnerGender))}
            />
            <ConnectionDetail
              icon="🎂"
              label="생년월일"
              value={getActivePartnerValue(connection, connection.partnerBirthDate)}
            />
            <ConnectionDetail
              icon="🏷"
              label="우편번호"
              value={getActivePartnerValue(connection, connection.partnerPostcode)}
            />
          </ul>
        </div>
      </div>
      {primaryAction && primaryLabel ? (
        <div className={cx('connectionActions')}>
          <button className={cx('connectionPrimaryButton')} type="button" disabled={isPending} onClick={primaryAction}>
            {primaryLabel}
          </button>
          {secondaryAction && secondaryLabel ? (
            <button
              className={cx('connectionSecondaryButton')}
              type="button"
              disabled={isPending}
              onClick={secondaryAction}
            >
              {secondaryLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
