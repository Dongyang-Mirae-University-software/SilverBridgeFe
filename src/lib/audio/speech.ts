// 기기 음성(Web Speech API speechSynthesis)으로 읽어 주기 - 안부 말벗 질문·응답. 서버로 보내지 않는다
// 크롬은 사용자가 화면을 한 번 누른 뒤에만 소리를 낸다 - 대화 시작 버튼을 누른 뒤에 부르므로 괜찮다

export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

export function speak(text: string) {
  if (!canSpeak() || !text.trim()) return;
  const synth = window.speechSynthesis;
  // 앞 문장을 읽는 중이면 끊고 새 문장을 읽는다
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ko-KR';
  // 어르신이 알아듣기 쉽게 조금 천천히
  utterance.rate = 0.9;
  const voice = synth.getVoices().find(item => item.lang.toLowerCase().startsWith('ko'));
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}
