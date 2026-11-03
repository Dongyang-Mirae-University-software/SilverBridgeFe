import type { Metadata } from 'next';
import { WardGameContent } from './_components/WardGameContent';

export const metadata: Metadata = { title: '치매 예방 게임' };

export default function WardGamePage() {
  return <WardGameContent />;
}
