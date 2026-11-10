// [테스트 계정만] 말벗 판정 결과(analysis)를 사람이 읽는 한 줄로 바꾼다. AI 값을 그대로 옮기고 없는 값은 쓰지 않는다
// 결과는 화면 메모리에만 둔다(브라우저 저장소·로그 금지)
import type { IWardCompanionResultAnalysis, IWardCompanionTurnAnalysis } from '@/service/interface/ward/companion';

const MOOD_LABEL: Record<string, string> = { JOY: '기쁨', CALM: '평온', WORRY: '걱정', DEPRESSED: '우울' };

const SOURCE_LABEL: Record<string, string> = {
  TEXT: '말',
  FACE: '표정',
  TEXT_FACE: '말+표정',
  TEXT_AND_FACE: '말+표정',
  BOTH: '말+표정',
  MULTIMODAL: '말+표정',
  NO_RESPONSE: '무응답',
  CONFIRM: '되묻기',
};

const ALERT_LABEL: Record<string, string> = { URGENT: '긴급', INFO: '안내' };

function moodText(value: string | null | undefined) {
  if (!value) return '판단 불가';
  return MOOD_LABEL[value.toUpperCase()] ?? value;
}

function sourceText(value: string | null | undefined) {
  if (!value) return '없음';
  return SOURCE_LABEL[value.toUpperCase()] ?? value;
}

function count(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function faceText(face: IWardCompanionTurnAnalysis['face']) {
  if (!face) return '사진 없음';
  const total = count(face.totalFrames) ?? count(face.frameCount);
  const found = count(face.facesFound);
  const frames = total !== null ? `사진 ${total}장 중 얼굴 ${found ?? '?'}` : null;
  const confidence = count(face.confidence);
  const sure = confidence !== null && confidence >= 0 && confidence <= 1 ? `확신 ${Math.round(confidence * 100)}%` : null;
  const detail = [frames, sure].filter(Boolean).join(', ');
  const label = face.usable === false ? '판단 못 함' : (face.label ? moodText(face.label) : '판단 못 함');
  return detail ? `${label}(${detail})` : label;
}

function signalsText(signals: IWardCompanionTurnAnalysis['signals']) {
  if (!signals) return null;
  const items = Object.entries(signals)
    .filter(([, value]) => value !== null && value !== undefined && value !== false && value !== '')
    .map(([key, value]) => (value === true ? key : `${key}=${typeof value === 'object' ? JSON.stringify(value) : String(value)}`));
  return items.length > 0 ? items.join(', ') : null;
}

export function formatTurnAnalysis(turnNo: number, analysis: IWardCompanionTurnAnalysis) {
  const parts = [
    `${turnNo}번째 대답`,
    `턴 기분: ${analysis.turnLabel ? moodText(analysis.turnLabel) : '없음'}`,
    `근거: ${sourceText(analysis.turnSource)}`,
    `표정: ${faceText(analysis.face)}`,
    `위험: ${analysis.riskFlag ? '있음' : '없음'}`,
  ];
  const signals = signalsText(analysis.signals);
  if (signals) parts.push(`신호: ${signals}`);
  return parts.join(' · ');
}

export function formatResultAnalysis(analysis: IWardCompanionResultAnalysis) {
  const answered = count(analysis.answeredCount);
  const noResponse = count(analysis.noResponseCount);
  const breakdown = [answered !== null ? `대답 ${answered}` : null, noResponse !== null ? `무응답 ${noResponse}` : null]
    .filter(Boolean)
    .join('·');
  return [
    '대화 마침',
    `대화 기분: ${moodText(analysis.mood)}`,
    `턴 수: ${analysis.turnCount}${breakdown ? `(${breakdown})` : ''}`,
    `위험: ${analysis.riskFlag ? '있음' : '없음'}`,
    `알림 단계: ${analysis.alertLevel ? (ALERT_LABEL[analysis.alertLevel] ?? analysis.alertLevel) : '없음'}`,
  ].join(' · ');
}
