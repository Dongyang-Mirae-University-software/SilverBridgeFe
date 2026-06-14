import dynamic from 'next/dynamic';

const WardSosContent = dynamic(() => import('./_components/WardSosContent'), {
  ssr: false,
});

export default function WardSosPage() {
  return <WardSosContent />;
}
