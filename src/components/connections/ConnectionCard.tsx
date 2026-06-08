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

function ConnectionDetail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className={cx('connectionDetailItem')}>
      <span>{label}</span>
      <strong>{value || '정보 없음'}</strong>
    </div>
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
  const dateValue = connection.status === 'ACTIVE' ? formatDate(connection.connectedAt) : formatDate(connection.createdAt);

  return (
    <li className={cx('connectionCard')} data-role={role}>
      <div className={cx('connectionCardMain')}>
        <UserAvatar size="w-60" imageUrl={connection.partnerProfileImage} />
        <div className={cx('connectionInfo')}>
          <div className={cx('connectionTitleRow')}>
            <div className={cx('connectionNameBlock')}>
              <strong>{connection.partnerName || '이름 확인 전'}</strong>
              <span>ID {connection.partnerUserId}</span>
            </div>
            <span className={cx('connectionStatus', getConnectionStatusClass(connection.status))}>
              {getConnectionStatusLabel(connection.status)}
            </span>
          </div>

          <div className={cx('connectionSummaryRow')}>
            {connection.relation && <span>{connection.relation}</span>}
            <span>{dateValue}</span>
          </div>

          <div className={cx('connectionDetailGrid')}>
            <ConnectionDetail label="이메일" value={getActivePartnerValue(connection, connection.partnerEmail)} />
            <ConnectionDetail label="성별" value={getActivePartnerValue(connection, formatPartnerGender(connection.partnerGender))} />
            <ConnectionDetail label="생년월일" value={getActivePartnerValue(connection, connection.partnerBirthDate)} />
            <ConnectionDetail label="연락처" value={getPartnerPhoneValue(connection)} />
            <ConnectionDetail label={dateLabel} value={dateValue} />
            <ConnectionDetail label="우편번호" value={getActivePartnerValue(connection, connection.partnerPostcode)} />
            <ConnectionDetail label="주소" value={getActivePartnerValue(connection, address)} />
          </div>
        </div>
      </div>
      {primaryAction && primaryLabel ? (
        <div className={cx('connectionActions')}>
          <button className={cx('connectionPrimaryButton')} type="button" disabled={isPending} onClick={primaryAction}>
            {primaryLabel}
          </button>
          {secondaryAction && secondaryLabel ? (
            <button className={cx('connectionSecondaryButton')} type="button" disabled={isPending} onClick={secondaryAction}>
              {secondaryLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
