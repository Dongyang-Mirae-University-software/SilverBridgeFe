'use client';

import classNames from 'classnames/bind';

import { Icon, type IconName } from '@/components/Icon';
import { UserAvatar } from '@/components/UserAvatar';
import type { IConnectionItem } from '@/service/interface/connection';
import {
  formatPartnerGender,
  getActivePartnerValue,
  getConnectionStatusClass,
  getConnectionStatusLabel,
  getPartnerPhoneValue,
} from './ConnectionShared';
import styles from './ConnectionCard.module.css';

const cx = classNames.bind(styles);

type ConnectionRole = 'guardian' | 'ward';
type ConnectionActionVariant = 'primary' | 'secondary';

interface ConnectionAction {
  label: string;
  onClick: () => void;
  variant?: ConnectionActionVariant;
}

interface ConnectionDetailProps {
  icon: IconName;
  label: string;
  value?: string | null;
}

interface ConnectionCardProps {
  actions?: ConnectionAction[];
  connection: IConnectionItem;
  isPending: boolean;
  role: ConnectionRole;
}

interface ConnectionListProps {
  connections: IConnectionItem[];
  getActions?: (connection: IConnectionItem) => ConnectionAction[];
  isPending: boolean;
  role: ConnectionRole;
}

function getConnectionAddress(connection: IConnectionItem) {
  return [connection.partnerAddress, connection.partnerAddressDetail].filter(Boolean).join(' ');
}

function ConnectionDetail({ icon, label, value }: ConnectionDetailProps) {
  return (
    <li className={cx('connectionDetailRow')}>
      <span className={cx('connectionDetailLabel')}>
        <Icon name={icon} size={18} className={cx('connectionDetailIcon')} />
        {label}
      </span>
      <strong className={cx('connectionDetailValue')}>{value || '정보 없음'}</strong>
    </li>
  );
}

function ConnectionActions({ actions = [], isPending }: Pick<ConnectionCardProps, 'actions' | 'isPending'>) {
  const visibleActions = actions.filter(action => action.label);

  if (visibleActions.length === 0) return null;

  return (
    <div className={cx('connectionActions')}>
      {visibleActions.map(action => (
        <button
          key={action.label}
          className={cx(action.variant === 'secondary' ? 'connectionSecondaryButton' : 'connectionPrimaryButton')}
          type="button"
          disabled={isPending}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

function WardActiveConnectionCard({ actions, connection, isPending }: ConnectionCardProps) {
  const address = getConnectionAddress(connection);

  return (
    <li className={cx('connectionCard')} data-role="ward" data-status="ACTIVE">
      <div className={cx('wardProfile')}>
        <UserAvatar imageUrl={connection.partnerProfileImage} size="w-76" userName={connection.partnerName} />
        <strong>{connection.partnerName || '이름 확인 전'}</strong>
        <span className={cx('connectionStatus', 'active')}>연결됨</span>
      </div>
      <ul className={cx('connectionDetailList')}>
        <ConnectionDetail icon="handshake" label="관계" value={connection.relation || '정보 없음'} />
        <ConnectionDetail icon="phone" label="전화번호" value={getPartnerPhoneValue(connection)} />
        <ConnectionDetail icon="mail" label="이메일" value={connection.partnerEmail} />
        <ConnectionDetail icon="user" label="성별" value={formatPartnerGender(connection.partnerGender)} />
        <ConnectionDetail icon="cake" label="생년월일" value={connection.partnerBirthDate} />
        <ConnectionDetail icon="tag" label="우편번호" value={connection.partnerPostcode} />
        <ConnectionDetail icon="mapPin" label="주소" value={address} />
      </ul>
      <ConnectionActions actions={actions} isPending={isPending} />
    </li>
  );
}

function WardPendingConnectionCard({ actions, connection, isPending }: ConnectionCardProps) {
  const address = getConnectionAddress(connection) || '주소 정보가 없습니다.';
  const requestedAt = connection.createdAt ? `${connection.createdAt.slice(0, 10)} 요청` : '연결 요청';

  return (
    <li className={cx('connectionCard')} data-role="ward" data-status={connection.status}>
      <UserAvatar imageUrl={connection.partnerProfileImage} size="w-48" userName={connection.partnerName} />
      <div className={cx('pendingInfo')}>
        <div className={cx('pendingTitleRow')}>
          <strong>{connection.partnerName || '이름 확인 전'}</strong>
          {connection.relation && <span className={cx('pendingRelation')}>{connection.relation}</span>}
          <time>{requestedAt}</time>
        </div>
        <p>
          <Icon name="mapPin" size={15} decorative />
          <span>{address}</span>
        </p>
      </div>
      <ConnectionActions actions={actions} isPending={isPending} />
    </li>
  );
}

export function ConnectionCard({ actions = [], connection, isPending, role }: ConnectionCardProps) {
  const address = connection.status === 'ACTIVE' ? getConnectionAddress(connection) : '';
  const profileLabel = getConnectionStatusLabel(connection.status);
  if (role === 'ward' && connection.status === 'ACTIVE') {
    return <WardActiveConnectionCard actions={actions} connection={connection} isPending={isPending} role={role} />;
  }

  if (role === 'ward') {
    return <WardPendingConnectionCard actions={actions} connection={connection} isPending={isPending} role={role} />;
  }

  return (
    <li className={cx('connectionCard')} data-role={role} data-status={connection.status}>
      <div className={cx('connectionCardMain')}>
        <UserAvatar size="w-120" imageUrl={connection.partnerProfileImage} userName={connection.partnerName} />
        <div className={cx('connectionInfo')}>
          <div className={cx('connectionTitleRow')}>
            <div className={cx('connectionNameBlock')}>
              <strong>{connection.partnerName || '이름 확인 전'}</strong>
            </div>
            <span className={cx('connectionStatus', getConnectionStatusClass(connection.status))}>{profileLabel}</span>
          </div>

          <ul className={cx('connectionDetailList')}>
            <ConnectionDetail icon="handshake" label="관계" value={connection.relation || '정보 없음'} />
            <ConnectionDetail icon="phone" label="전화번호" value={getPartnerPhoneValue(connection)} />
            <ConnectionDetail icon="mapPin" label="주소" value={getActivePartnerValue(connection, address)} />
            <ConnectionDetail
              icon="mail"
              label="이메일"
              value={getActivePartnerValue(connection, connection.partnerEmail)}
            />
            <ConnectionDetail
              icon="user"
              label="성별"
              value={getActivePartnerValue(connection, formatPartnerGender(connection.partnerGender))}
            />
            <ConnectionDetail
              icon="cake"
              label="생년월일"
              value={getActivePartnerValue(connection, connection.partnerBirthDate)}
            />
            <ConnectionDetail
              icon="tag"
              label="우편번호"
              value={getActivePartnerValue(connection, connection.partnerPostcode)}
            />
          </ul>
        </div>
      </div>
      <ConnectionActions actions={actions} isPending={isPending} />
    </li>
  );
}

export function ConnectionList({ connections, getActions, isPending, role }: ConnectionListProps) {
  return (
    <ul className={cx('connectionList')}>
      {connections.map(connection => (
        <ConnectionCard
          key={connection.id}
          actions={getActions?.(connection)}
          connection={connection}
          isPending={isPending}
          role={role}
        />
      ))}
    </ul>
  );
}
