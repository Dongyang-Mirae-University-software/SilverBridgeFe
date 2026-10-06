'use client';

import Link from 'next/link';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { UserAvatar } from '@/components/UserAvatar';
import { formatPhoneText, makeTelHref } from '@/utils/format/phone';
import type { IConnectionItem } from '@/service/interface/connection';
import styles from './WardGuardianCallSection.module.css';

const cx = classNames.bind(styles);

interface Props {
  activeGuardians: IConnectionItem[];
  isGuardiansError: boolean;
  isLoadingGuardians: boolean;
  onGuardianCall: () => void;
}

function GuardianCard({ connection, onCall }: { connection: IConnectionItem; onCall: () => void }) {
  const telHref = makeTelHref(connection.partnerPhone);

  return (
    <article className={cx('guardianCard')}>
      <div className={cx('guardianBody')}>
        <UserAvatar imageUrl={connection.partnerProfileImage} size="w-120" />
        <div className={cx('guardianInfo')}>
          <strong>{connection.partnerName}</strong>
          <span>{connection.relation || '보호자'}</span>
        </div>
      </div>

      <div className={cx('guardianFooter')}>
        <span className={cx('guardianPhoneNumber')}>{formatPhoneText(connection.partnerPhone)}</span>
        {telHref && (
          <span className={cx('callBadge')} aria-hidden="true">
            <Icon name="phone" size={16} decorative />
            전화 걸기
          </span>
        )}
      </div>

      {telHref ? (
        <a
          className={cx('cardLink')}
          href={telHref}
          aria-label={`${connection.partnerName}에게 전화하기`}
          onClick={onCall}
        />
      ) : null}
    </article>
  );
}

export function WardGuardianCallSection({
  activeGuardians,
  isGuardiansError,
  isLoadingGuardians,
  onGuardianCall,
}: Props) {
  const currentGuardians = activeGuardians
    .slice()
    .sort(
      (a, b) => new Date(b.connectedAt ?? b.createdAt).getTime() - new Date(a.connectedAt ?? a.createdAt).getTime(),
    );

  return (
    <section className={cx('phoneSection')}>
      <div className={cx('sectionHeader')}>
        <h3>보호자에게 직접 전화하기</h3>
        <p>아래 보호자 카드를 누르면 바로 전화가 걸립니다.</p>
      </div>

      {isGuardiansError ? (
        <div className={cx('emptyState')}>
          <div className={cx('emptyIcon')}>
            <Icon name="users" size={20} decorative />
          </div>
          <div className={cx('emptyCopy')}>
            <strong>보호자 목록을 불러오지 못했습니다.</strong>
            <span>잠시 후 다시 시도해주세요.</span>
          </div>
        </div>
      ) : isLoadingGuardians ? (
        <div className={cx('emptyState')}>
          <div className={cx('emptyIcon')}>
            <Icon name="users" size={20} decorative />
          </div>
          <div className={cx('emptyCopy')}>
            <strong>보호자 리스트를 불러오는 중입니다.</strong>
            <span>연결된 보호자가 있으면 곧 표시됩니다.</span>
          </div>
        </div>
      ) : currentGuardians.length > 0 ? (
        <div className={cx('guardianGrid')}>
          {currentGuardians.map(connection => (
            <GuardianCard key={connection.id} connection={connection} onCall={onGuardianCall} />
          ))}
        </div>
      ) : (
        <div className={cx('emptyState')}>
          <div className={cx('emptyIcon')}>
            <Icon name="users" size={20} decorative />
          </div>
          <div className={cx('emptyCopy')}>
            <strong>현재 연결된 보호자가 없습니다.</strong>
            <span>보호자를 연결하면 이곳에 바로 전화할 수 있는 카드가 표시됩니다.</span>
          </div>
          <Link className={cx('emptyButton')} href="/ward/guardians">
            보호자 연결하기
          </Link>
        </div>
      )}
    </section>
  );
}
