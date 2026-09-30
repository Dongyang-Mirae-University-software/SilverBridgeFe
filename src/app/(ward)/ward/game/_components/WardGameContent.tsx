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
  { slug: 'memory_match', label: '짝맞추기' },
  { slug: 'maze', label: '미로찾기' },
  { slug: 'arithmetic', label: '사칙연산' },
  { slug: 'initials_quiz', label: '초성퀴즈' },
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

  const picker = (
    <div className={cx('picker')} role="tablist" aria-label="게임 선택">
      {GAMES.map(game => (
        <button
          key={game.slug}
          type="button"
          role="tab"
          aria-selected={game.slug === gameSlug}
          className={cx('gameButton', { active: game.slug === gameSlug })}
          onClick={() => setGameSlug(game.slug)}
        >
          {game.label}
        </button>
      ))}
    </div>
  );

  return (
    <PageLayout title="치매 예방 게임" actions={picker} fill>
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
