'use client';

import Link from 'next/link';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { makeTelHref } from '@/utils/format/phone';
import type { IConnectionItem } from '@/service/interface/connection';
import styles from './WardGuardianCallSection.module.css';

const cx = classNames.bind(styles);

interface Props {
  activeGuardians: IConnectionItem[];
  isGuardiansError: boolean;
  isLoadingGuardians: boolean;
  onGuardianCall: () => void;
}

// 디자인 SOS 화면(2026-10-23): 흰 카드에 "이름 (관계)"와 초록 원 전화 버튼. 카드 전체가 실제 가족 전화(tel:)이며
// 누르면 SOS 이력에 GUARDIAN_CALL로 남긴다(onCall) - 119 키패드와 달리 실제로 걸리는 것이 의도다
function GuardianCard({ connection, onCall }: { connection: IConnectionItem; onCall: () => void }) {
  const telHref = makeTelHref(connection.partnerPhone);
  const relation = connection.relation?.trim();

  return (
    <article className={cx('guardianCard', { noPhone: !telHref })}>
      <div className={cx('guardianInfo')}>
        <strong className={cx('guardianName')}>
          {connection.partnerName}
          {relation && <span className={cx('guardianRelation')}> ({relation})</span>}
        </strong>
        {!telHref && <span className={cx('noPhoneText')}>전화번호가 없어요</span>}
      </div>
      <span className={cx('callCircle')} aria-hidden="true">
        <Icon name="phone" size={34} decorative />
      </span>

      {telHref ? (
        <a
          className={cx('cardLink')}
          href={telHref}
          aria-label={`${connection.partnerName}${relation ? `(${relation})` : ''}에게 전화하기`}
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
    <section className={cx('phoneSection')} aria-label="보호자에게 직접 전화하기">
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
