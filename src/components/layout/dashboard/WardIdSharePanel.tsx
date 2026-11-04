'use client';

import { useState } from 'react';
import classNames from 'classnames/bind';

import { Icon } from '@/components/Icon';
import { isValidMemberId } from '@/utils/connection/connectionView';
import { shareToKakao } from '@/lib/kakao/share';
import styles from './WardIdSharePanel.module.css';

const cx = classNames.bind(styles);

interface Props {
  userId: string;
}

function getShareContent(userId: string) {
  const link = new URL('/guardian/wards/register', window.location.origin);
  link.searchParams.set('targetId', userId);
  const url = link.toString();
  const text = `[실버브릿지] 저를 가족으로 등록해 주세요.\n내 ID: ${userId}\n아래 링크에서 로그인한 뒤 '가족 등록'에 ID를 넣어 주세요.\n${url}`;

  return { text, url };
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('복사하지 못했습니다.');
}

// v13.0 시안: 내 ID 카드 - 큰 ID, 점선, 카카오톡 공유하기, ID 복사하기
export function WardIdSharePanel({ userId }: Props) {
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  if (!isValidMemberId(userId)) return null;

  // 카카오톡 공유를 열지 못하면 기기 공유 창 → 그것도 없으면 안내 문구를 복사한다
  const handleShare = async () => {
    const { text, url } = getShareContent(userId);
    setIsSharing(true);
    setNotice('');
    try {
      await shareToKakao(text, url);
    } catch {
      try {
        if (navigator.share) {
          await navigator.share({ title: '실버브릿지 가족 등록', text, url });
        } else {
          await copyText(text);
          setNotice('카카오톡을 열지 못해 가족 등록 안내를 복사했어요.');
        }
      } catch (error) {
        // 공유창을 닫은 것은 실패 안내를 띄울 일이 아니다
        if ((error as DOMException | undefined)?.name !== 'AbortError') setNotice('공유하지 못했어요. ID 복사하기를 이용해 주세요.');
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopy = async () => {
    setNotice('');
    try {
      await copyText(userId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice('복사하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  return (
    <section className={cx('sharePanel')} aria-labelledby="ward-id-share-title">
      <div className={cx('idBox')}>
        <h3 id="ward-id-share-title">내 ID · 가족에게 알려 주세요</h3>
        <strong>{userId}</strong>
      </div>
      <div className={cx('divider')} />
      <div className={cx('actions')}>
        <button className={cx('kakaoButton')} type="button" disabled={isSharing} onClick={() => void handleShare()}>
          <Icon name="kakaoLogo" size={22} color="#3C1E1E" decorative />
          카카오톡 공유하기
        </button>
        <button className={cx('copyButton')} type="button" onClick={() => void handleCopy()}>
          {copied ? (
            <>
              <Icon name="check" size={18} decorative />
              ID를 복사했어요
            </>
          ) : (
            'ID 복사하기'
          )}
        </button>
        {notice && <p className={cx('notice')} aria-live="polite">{notice}</p>}
      </div>
    </section>
  );
}
