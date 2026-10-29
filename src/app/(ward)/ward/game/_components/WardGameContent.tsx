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
  { slug: 'memory_match', label: '짝 맞추기', description: '카드 짝을 맞춰보세요', icon: '🃏', tone: 'brand' },
  { slug: 'maze', label: '미로 찾기', description: '길을 따라 도착해 보세요', icon: '🧩', tone: 'sun' },
  { slug: 'arithmetic', label: '사칙연산', description: '숫자를 재미있게 풀어보세요', icon: '➕', tone: 'accent' },
  { slug: 'initials_quiz', label: '초성 퀴즈', description: '초성을 보고 낱말을 맞혀보세요', icon: '✏️', tone: 'safe' },
] as const;

type GameSlug = (typeof GAMES)[number]['slug'];

function getEmbedUrl(userId: number, gameSlug: GameSlug) {
  const domain = process.env.NEXT_PUBLIC_AI_API_DOMAIN ?? '';
  const params = new URLSearchParams({ userId: String(userId), gameSlug });
  return `${domain.replace(/\/$/, '')}/api/v1/games/embed?${params}`;
}

export function WardGameContent() {
  const { data: profileResponse } = useQuery(myProfileQueryOptions);
  const profileId = getUserProfileData(profileResponse)?.id;
  const [gameSlug, setGameSlug] = useState<GameSlug>('memory_match');

  const gameCards = (
    <section className={cx('gameSelection')} aria-labelledby="game-selection-title">
      <h2 id="game-selection-title" className={cx('selectionTitle')}>게임을 골라 보세요</h2>
      <div className={cx('picker')} role="group" aria-label="게임 선택">
        {GAMES.map(game => (
          <button
            key={game.slug}
            type="button"
            aria-pressed={game.slug === gameSlug}
            className={cx('gameButton', game.tone, { active: game.slug === gameSlug })}
            onClick={() => setGameSlug(game.slug)}
          >
            <span className={cx('gameIcon')} aria-hidden="true">{game.icon}</span>
            <span className={cx('gameCopy')}>
              <strong>{game.label}</strong>
              <span>{game.description}</span>
            </span>
            <span className={cx('arrow')} aria-hidden="true">›</span>
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <PageLayout title="치매 예방 게임" fill>
      {gameCards}
      {profileId ? (
        <iframe
          key={gameSlug}
          className={cx('frame')}
          title="치매 예방 게임"
          src={getEmbedUrl(toGameUserId(profileId), gameSlug)}
        />
      ) : (
        <p className={cx('emptyText')}>사용자 정보를 불러오는 중입니다.</p>
      )}
    </PageLayout>
  );
}
