'use client';

import classNames from 'classnames/bind';

import { UserAvatar } from '@/components/UserAvatar';
import CakeIcon from '@/assets/icons/cake.svg';
import HandshakeIcon from '@/assets/icons/handshake.svg';
import MailIcon from '@/assets/icons/mail.svg';
import MapPinIcon from '@/assets/icons/map-pin.svg';
import PhoneIcon from '@/assets/icons/phone.svg';
import TagIcon from '@/assets/icons/tag.svg';
import UserIcon from '@/assets/icons/user.svg';
import { getSvgSrc } from '@/lib/assets';
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

function getConnectionAddress(connection: IConnectionItem) {
  return [connection.partnerAddress, connection.partnerAddressDetail].filter(Boolean).join(' ');
}

function ConnectionDetail({ icon, label, value }: { icon: string | { src: string }; label: string; value?: string | null }) {
  return (
    <li className={cx('connectionDetailRow')}>
      <span className={cx('connectionDetailLabel')}>
        <img className={cx('connectionDetailIcon')} src={getSvgSrc(icon)} alt="" aria-hidden="true" />
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
  const profileLabel = getConnectionStatusLabel(connection.status);
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
            <ConnectionDetail icon={HandshakeIcon} label="관계" value={connection.relation || '정보 없음'} />
            <ConnectionDetail icon={PhoneIcon} label="전화번호" value={getPartnerPhoneValue(connection)} />
            <ConnectionDetail icon={MapPinIcon} label="주소" value={getActivePartnerValue(connection, address)} />
            <ConnectionDetail
              icon={MailIcon}
              label="이메일"
              value={getActivePartnerValue(connection, connection.partnerEmail)}
            />
            <ConnectionDetail
              icon={UserIcon}
              label="성별"
              value={getActivePartnerValue(connection, formatPartnerGender(connection.partnerGender))}
            />
            <ConnectionDetail
              icon={CakeIcon}
              label="생년월일"
              value={getActivePartnerValue(connection, connection.partnerBirthDate)}
            />
            <ConnectionDetail
              icon={TagIcon}
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
