'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames/bind';

import PageLayout from '@/components/layout/PageLayout';
import { myProfileQueryOptions } from '@/service/query/user';
import { getUserProfileData } from '@/utils/auth/userProfile';
import { toGameUserId } from '@/utils/game/userId';
import styles from './WardGameContent.module.css';

const cx = classNames.bind(styles);

const GAMES = [
  { slug: 'memory_match', label: '짝 맞추기', description: '카드 짝을 맞춰보세요', icon: '🃏', art: 'pick-memory', tone: 'brand' },
  { slug: 'maze', label: '미로 찾기', description: '길을 따라 도착해 보세요', icon: '🧩', art: 'pick-maze', tone: 'sun' },
  { slug: 'arithmetic', label: '사칙연산', description: '숫자를 재미있게 풀어보세요', icon: '➕', art: 'pick-arithmetic', tone: 'accent' },
  { slug: 'initials_quiz', label: '초성 퀴즈', description: '초성을 보고 낱말을 맞혀보세요', icon: '✏️', art: 'pick-initials', tone: 'safe' },
] as const;

type GameSlug = (typeof GAMES)[number]['slug'];

const AI_ROOT = (process.env.NEXT_PUBLIC_AI_API_DOMAIN ?? '').replace(/\/$/, '');

function getEmbedUrl(userId: number, gameSlug: GameSlug) {
  const params = new URLSearchParams({ userId: String(userId), gameSlug });
  return `${AI_ROOT}/api/v1/games/embed?${params}`;
}

export function WardGameContent() {
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profileId = getUserProfileData(profileResponse)?.id;
  // null이면 고르기 화면, 고르면 같은 자리에서 그 게임만 꽉 차게 보인다(태블릿 한 화면 고정)
  const [gameSlug, setGameSlug] = useState<GameSlug | null>(null);
  // 실수로 나가지 않게 '다른 게임 하기'는 한 번 더 묻는다
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  // 그림은 AI 서버가 준다. 하나라도 못 받으면 예전 이모지로 돌아간다
  const [artFailed, setArtFailed] = useState(false);

  const game = GAMES.find(item => item.slug === gameSlug);

  const pickGame = (slug: GameSlug) => {
    setConfirmingLeave(false);
    setGameSlug(slug);
  };

  if (!game) {
    return (
      <PageLayout title="치매 예방 게임" fill hideTitle>
        <section className={cx('gameSelection')} aria-labelledby="game-selection-title">
          <h2 id="game-selection-title" className={cx('selectionTitle')}>게임을 골라 보세요</h2>
          <div className={cx('picker')} role="group" aria-label="게임 선택">
            {GAMES.map(item => (
              <button
                key={item.slug}
                type="button"
                className={cx('gameButton', item.tone)}
                onClick={() => pickGame(item.slug)}
              >
                {artFailed ? (
                  <span className={cx('gameIcon')} aria-hidden="true">{item.icon}</span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- 다른 출처(AI 서버) 정적 그림
                  <img className={cx('gameArt')} src={`${AI_ROOT}/api/v1/games/assets/${item.art}.png`} alt="" onError={() => setArtFailed(true)} />
                )}
                <span className={cx('gameCopy')}>
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="치매 예방 게임" fill hideTitle>
      <section className={cx('playing')} aria-label={`${game.label} 게임`}>
        <div className={cx('playBar')}>
          <button type="button" className={cx('barButton')} onClick={() => setConfirmingLeave(true)}>
            <span aria-hidden="true">‹</span> 다른 게임 하기
          </button>
          <h2 className={cx('playTitle', game.tone)}>{game.label}</h2>
        </div>
        {/* 게임 위에 덮어 묻는다. 게임 칸 크기가 그대로라 게임이 다시 배치되지 않는다 */}
        {confirmingLeave && (
          <div className={cx('confirmLayer')} role="alertdialog" aria-modal="true" aria-labelledby="leave-game-text">
            <div className={cx('confirmBox')}>
              <p id="leave-game-text" className={cx('confirmText')}>게임을 그만하고 다른 게임을 고를까요?</p>
              <button type="button" className={cx('barButton', 'leave')} onClick={() => setGameSlug(null)}>
                네, 다른 게임 고르기
              </button>
              <button type="button" className={cx('barButton')} onClick={() => setConfirmingLeave(false)} autoFocus>
                계속하기
              </button>
            </div>
          </div>
        )}
        {profileId ? (
          <iframe
            key={game.slug}
            className={cx('frame')}
            title="치매 예방 게임"
            // 게임 화면은 다른 출처(AI 서버)다. 스크립트·자기 출처 요청·확인 창만 허용하고 우리 탭 이동·새 창은 막는다
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
            src={getEmbedUrl(toGameUserId(profileId), game.slug)}
          />
        ) : (
          <p className={cx('emptyText')}>사용자 정보를 불러오는 중입니다.</p>
        )}
      </section>
    </PageLayout>
  );
}
