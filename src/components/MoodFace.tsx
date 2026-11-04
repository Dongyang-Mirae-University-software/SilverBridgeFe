import { useId } from 'react';

export type MoodFaceKind = 'happy' | 'calm' | 'worried' | 'sad';

const INK = '#2e2420';

function DotEyes({ y = 32, r = 3.2 }: { y?: number; r?: number }) {
  return (
    <>
      <circle cx="24.5" cy={y} r={r} fill={INK} />
      <circle cx="35.5" cy={y} r={r} fill={INK} />
      <circle cx="25.6" cy={y - 1.1} r="1.1" fill="#fff" />
      <circle cx="36.6" cy={y - 1.1} r="1.1" fill="#fff" />
    </>
  );
}

const FACES: Record<MoodFaceKind, React.ReactNode> = {
  happy: (
    <>
      <path d="M21 33q3.5-4.4 7 0M32 33q3.5-4.4 7 0" fill="none" stroke={INK} strokeLinecap="round" strokeWidth="2.1" />
      <path d="M25.2 37h9.6q-.6 6.2-4.8 6.2T25.2 37Z" fill="#3a2a22" />
      <path d="M27.2 41.6q2.8-2 5.6 0-1.2 1.6-2.8 1.6t-2.8-1.6Z" fill="#f07a86" />
    </>
  ),
  calm: (
    <>
      <DotEyes />
      <path d="M26.4 37.6Q28.2 39.8 30 37.6Q31.8 39.8 33.6 37.6" fill="none" stroke={INK} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </>
  ),
  worried: (
    <>
      <DotEyes y={32.5} r={2.9} />
      <path d="M21 28.6Q24 26.2 27.2 26.8M32.8 26.8Q36 26.2 39 28.6" fill="none" stroke={INK} strokeLinecap="round" strokeWidth="1.5" />
      <path d="M26.4 39.8Q28.2 38.4 30 39.8Q31.8 41.2 33.6 39.8" fill="none" stroke={INK} strokeLinecap="round" strokeWidth="1.6" />
    </>
  ),
  sad: (
    <>
      <DotEyes y={32.5} r={2.8} />
      <path d="M20.5 27.6Q23.5 26.4 27 28.2M33 28.2Q36.5 26.4 39.5 27.6" fill="none" stroke={INK} strokeLinecap="round" strokeWidth="1.5" />
      <path d="M26.5 40.6Q30 37.4 33.5 40.6" fill="none" stroke={INK} strokeLinecap="round" strokeWidth="1.7" />
      <path d="M38 35Q36.6 37.6 38 38.6Q39.4 37.6 38 35Z" fill="#7cb8e0" />
    </>
  ),
};

// v13 시안 '오늘의 정서' 복숭아 캐릭터(새싹·광택·볼터치). 기분 글자를 옆에 따로 쓰므로 그림은 읽지 않는다
export function MoodFace({ mood = 'happy', size }: { mood?: MoodFaceKind; size?: number }) {
  const gradientId = `mood-face-${useId().replace(/:/g, '')}`;

  return (
    <svg viewBox="0 0 60 60" width={size} height={size} aria-hidden="true">
      <defs>
        <radialGradient id={gradientId} cx="42%" cy="32%" r="75%">
          <stop offset="0" stopColor="#ffe6cc" />
          <stop offset="70%" stopColor="#fdd3ae" />
          <stop offset="100%" stopColor="#f8c399" />
        </radialGradient>
      </defs>
      <ellipse cx="30" cy="56.2" rx="14" ry="2.2" fill="#000" opacity=".08" />
      <circle cx="30" cy="33.5" r="20.5" fill={`url(#${gradientId})`} stroke="#ebae78" strokeWidth="1.3" />
      <ellipse cx="22.5" cy="22.8" rx="5.6" ry="3.2" transform="rotate(-28 22.5 22.8)" fill="#fff" opacity=".6" />
      <path d="M30 13.4V10.2" stroke="#6e9466" strokeLinecap="round" strokeWidth="1.6" />
      <path d="M29.6 10.6Q25.6 7.4 21.8 9.6q3.2 3 7.8 1" fill="#a9d39b" />
      <path d="M30.4 10.6q4-3.2 7.8-1-3.2 3-7.8 1" fill="#a9d39b" />
      <ellipse cx="18.6" cy="37.2" rx="3.9" ry="2.6" fill="#ff9aa2" opacity=".8" />
      <ellipse cx="41.4" cy="37.2" rx="3.9" ry="2.6" fill="#ff9aa2" opacity=".8" />
      {FACES[mood]}
    </svg>
  );
}
