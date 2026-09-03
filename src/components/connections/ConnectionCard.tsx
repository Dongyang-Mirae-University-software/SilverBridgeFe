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

export function ConnectionCard({ actions = [], connection, isPending, role }: ConnectionCardProps) {
  const address = connection.status === 'ACTIVE' ? getConnectionAddress(connection) : '';
  const profileLabel = getConnectionStatusLabel(connection.status);
  const visibleActions = actions.filter(action => action.label);

  return (
    <li className={cx('connectionCard')} data-role={role}>
      <div className={cx('connectionCardMain')}>
        <UserAvatar size="w-120" imageUrl={connection.partnerProfileImage} />
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
      {visibleActions.length > 0 ? (
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
      ) : null}
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
