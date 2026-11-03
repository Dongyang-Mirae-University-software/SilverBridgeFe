import PageLayout from '@/components/layout/PageLayout';

// AI 말벗·정서 분석은 개발 중이라 데이터가 없다. 빈 화면 대신 준비 중임을 분명히 알린다
export default function GuardianEmotionPage() {
  return (
    <PageLayout
      title="정서 상태 체크"
      description="피보호자의 정서 흐름과 최근 체크 결과를 확인합니다."
      empty={{
        title: 'AI 기분 체크는 준비 중이에요',
        message: 'AI 말벗과 나눈 대화로 기분을 살피는 기능을 만들고 있어요. 준비되면 이곳에서 바로 볼 수 있어요.',
      }}
    />
  );
}
