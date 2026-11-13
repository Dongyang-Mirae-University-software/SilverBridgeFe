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

// 표정 모델(HSEmotion) 8종 라벨 - AI가 labelKo를 주지 않을 때(반영 전) 쓰는 대체 매핑
const FACE_LABEL: Record<string, string> = {
  NEUTRAL: '무표정',
  HAPPINESS: '기쁨',
  SADNESS: '슬픔',
  ANGER: '화남',
  FEAR: '두려움',
  SURPRISE: '놀람',
  DISGUST: '싫어함',
  CONTEMPT: '못마땅함',
};

// 표정 이름 - labelKo 우선, 없으면 매핑, 모르는 값·얼굴 없음은 "-"
export function faceLabel(face: IWardCompanionTurnAnalysis['face']) {
  if (!face) return '-';
  const ko = face.labelKo?.trim();
  if (ko) return ko;
  return (face.label && FACE_LABEL[face.label.trim().toUpperCase()]) || '-';
}

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
  if (total === 0) return '사진 없음'; // 글로 대답한 턴 등 사진 0장 - "확신 0%"를 붙이면 판정한 것처럼 보인다
  const found = count(face.facesFound);
  const frames = total !== null ? `사진 ${total}장 중 얼굴 ${found ?? '?'}` : null;
  const confidence = count(face.confidence);
  const sure = confidence !== null && confidence >= 0 && confidence <= 1 ? `확신 ${Math.round(confidence * 100)}%` : null;
  const detail = [frames, sure].filter(Boolean).join(', ');
  const label = face.usable === false ? '판단 못 함' : faceLabel(face);
  return detail ? `${label}(${detail})` : label;
}

function textMoodText(textMood: IWardCompanionTurnAnalysis['textMood']) {
  if (!textMood) return null;
  if (textMood.usable !== true) {
    const why = textMood.reason || (textMood.label ? `라벨 ${textMood.label}` : null);
    return why ? `판단 안 함(${why})` : '판단 안 함';
  }
  const label = moodText(textMood.turnLabel || textMood.label);
  const confidence = count(textMood.confidence);
  return confidence !== null && confidence >= 0 && confidence <= 1 ? `${label}(확신 ${Math.round(confidence * 100)}%)` : label;
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
  ];
  const textMood = textMoodText(analysis.textMood);
  if (textMood) parts.push(`말로 본 기분: ${textMood}`);
  parts.push(`표정: ${faceText(analysis.face)}`, `위험: ${analysis.riskFlag ? '있음' : '없음'}`);
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

// ---- 화면 칸용 요약 ----
// 턴: 방금 대답 카드(기분 글자 + 말·표정·위험 3칸)와 지난 대답 표(턴 | 말 | 표정 | 결과)
// 마침: 한 줄("대화 마침 · 6턴 · 위험 없음 · 알림 안내 · 평온") - 칸으로 나누면 같은 내용이 반복된다

export type MoodTone = 'joy' | 'calm' | 'worry' | 'depressed' | 'unknown';
export type ResultTone = MoodTone | 'danger' | 'safe';

export interface AnalysisSummary {
  kind: 'turn' | 'end';
  title: string; // "3번째" · "대화 마침"
  rowLabel: string; // 지난 대답 표 첫 칸 "3번" · "마침"
  mood: string; // 기분 글자(한 번만 보인다)
  tone: MoodTone;
  // 턴: 말·표정·위험 / 마침: "6턴"·"위험 없음"·"알림 안내"(한 줄로 이어 붙인다)
  cells: { label: string; value: string; tone?: ResultTone }[];
  line: string; // 기분을 뺀 한 줄 "말 걱정 · 표정 무표정" · "대화 마침 · 6턴 · 위험 없음 · 알림 안내"
  detail: string; // 자세히 - 기존 한 줄 문구(확신·근거·신호 포함)
}

const TONE_BY_LABEL: Record<string, MoodTone> = {
  기쁨: 'joy', 평온: 'calm', 걱정: 'worry', 슬픔: 'worry', 우울: 'depressed',
  JOY: 'joy', CALM: 'calm', WORRY: 'worry', DEPRESSED: 'depressed',
};

function toneOf(label: string | null | undefined): MoodTone {
  return (label && TONE_BY_LABEL[label.toUpperCase()]) || (label && TONE_BY_LABEL[label]) || 'unknown';
}

function shortFace(face: IWardCompanionTurnAnalysis['face']) {
  if (!face) return '사진 없음';
  const total = count(face.totalFrames) ?? count(face.frameCount);
  if (total === 0) return '사진 없음';
  if (face.usable === false) return '판단 못 함';
  return faceLabel(face);
}

function shortTextMood(textMood: IWardCompanionTurnAnalysis['textMood']) {
  if (!textMood) return '없음';
  if (textMood.usable !== true) return '판단 안 함';
  return moodText(textMood.turnLabel || textMood.label);
}

export function summarizeTurnAnalysis(turnNo: number, analysis: IWardCompanionTurnAnalysis): AnalysisSummary {
  const mood = analysis.turnLabel ? moodText(analysis.turnLabel) : '판단 안 함';
  const speech = shortTextMood(analysis.textMood);
  const face = shortFace(analysis.face);
  return {
    kind: 'turn',
    title: `${turnNo}번째`,
    rowLabel: `${turnNo}번`,
    mood,
    tone: toneOf(analysis.turnLabel),
    cells: [
      { label: '말', value: speech, tone: toneOf(speech) },
      { label: '표정', value: face, tone: toneOf(face) },
      { label: '위험', value: analysis.riskFlag ? '있음' : '없음', tone: analysis.riskFlag ? 'danger' : 'safe' },
    ],
    line: `말 ${speech} · 표정 ${face}`,
    detail: formatTurnAnalysis(turnNo, analysis),
  };
}

export function summarizeResultAnalysis(analysis: IWardCompanionResultAnalysis): AnalysisSummary {
  const mood = moodText(analysis.mood);
  const alert = analysis.alertLevel ? (ALERT_LABEL[analysis.alertLevel] ?? analysis.alertLevel) : '없음';
  const cells: AnalysisSummary['cells'] = [
    { label: '턴 수', value: `${analysis.turnCount}턴` },
    { label: '위험', value: `위험 ${analysis.riskFlag ? '있음' : '없음'}`, tone: analysis.riskFlag ? 'danger' : undefined },
    { label: '알림', value: `알림 ${alert}`, tone: analysis.alertLevel === 'URGENT' ? 'danger' : undefined },
  ];
  return {
    kind: 'end',
    title: '대화 마침',
    rowLabel: '마침',
    mood,
    tone: toneOf(analysis.mood),
    cells,
    line: ['대화 마침', ...cells.map(cell => cell.value)].join(' · '),
    detail: formatResultAnalysis(analysis),
  };
}
