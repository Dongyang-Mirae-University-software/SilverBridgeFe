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

export function WardIdSharePanel({ userId }: Props) {
  const [notice, setNotice] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [isKakaoAvailable, setIsKakaoAvailable] = useState(true);

  if (!isValidMemberId(userId)) return null;

  const handleNativeShare = async () => {
    const { text, url } = getShareContent(userId);
    if (!navigator.share) {
      await handleCopy();
      return;
    }

    setIsSharing(true);
    setNotice('');
    try {
      await navigator.share({ title: '실버브릿지 가족 등록', text, url });
    } catch (error) {
      // 공유창을 닫은 것은 실패 안내를 띄울 일이 아니다.
      if ((error as DOMException | undefined)?.name !== 'AbortError') {
        try {
          await copyText(text);
          setNotice('공유창을 열지 못해 내용을 복사했어요.');
        } catch {
          setNotice('공유 기능을 사용할 수 없어요. 아래 복사하기를 이용해 주세요.');
        }
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleKakaoShare = async () => {
    const { text, url } = getShareContent(userId);
    setIsSharing(true);
    setNotice('');
    try {
      await shareToKakao(text, url);
    } catch {
      // SDK를 불러오지 못한 환경에서는 버튼을 감추고 다른 공유 방법을 남긴다.
      setIsKakaoAvailable(false);
      try {
        await copyText(text);
        setNotice('카카오톡 공유를 열지 못해 내용을 복사했어요.');
      } catch {
        setNotice('카카오톡 공유를 사용할 수 없어요.');
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleSms = () => {
    const { text } = getShareContent(userId);
    window.location.href = `sms:?body=${encodeURIComponent(text)}`;
  };

  const handleCopy = async () => {
    const { text } = getShareContent(userId);
    setNotice('');
    try {
      await copyText(text);
      setNotice('가족 등록 안내를 복사했어요.');
    } catch {
      setNotice('복사하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  return (
    <section className={cx('sharePanel')} aria-labelledby="ward-id-share-title">
      <div className={cx('heading')}>
        <span className={cx('headingIcon')}><Icon name="users" size={19} decorative /></span>
        <div>
          <h3 id="ward-id-share-title">가족에게 내 ID 보내기</h3>
          <p>가족이 링크를 열면 회원 ID가 자동으로 입력돼요.</p>
        </div>
      </div>

      <div className={cx('idBox')}>
        <span>내 회원 ID</span>
        <strong>{userId}</strong>
      </div>

      <button className={cx('nativeShareButton')} type="button" disabled={isSharing} onClick={() => void handleNativeShare()}>
        <Icon name="users" size={18} decorative />
        {isSharing ? '공유 준비 중...' : '가족에게 내 ID 보내기'}
      </button>

      <div className={cx('shareMethods')}>
        {isKakaoAvailable && (
          <button type="button" disabled={isSharing} onClick={() => void handleKakaoShare()}>
            <Icon name="kakaoLogo" size={17} color="#3C1E1E" decorative /> 카카오톡으로 보내기
          </button>
        )}
        <button type="button" onClick={handleSms}>
          <Icon name="message" size={17} decorative /> 문자로 보내기
        </button>
        <button type="button" onClick={() => void handleCopy()}>
          <Icon name="fileText" size={16} decorative /> 복사하기
        </button>
      </div>

      <p className={cx('notice')} aria-live="polite">{notice}</p>
    </section>
  );
}
