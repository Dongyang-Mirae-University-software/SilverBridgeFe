import type { ChatMessage } from '@/service/interface/chat';
import { INTENT_LABEL, RISK_LABEL } from '@/service/interface/chat';
import ChatToolCard from './ChatToolCard';
import ChatUiPrompt from './ChatUiPrompt';
import styles from './ChatBubble.module.css';

interface Props {
  message: ChatMessage;
  isLastAssistant: boolean;
  onUiSelect: (field: string, value: string) => void;
}

export default function ChatBubble({ message, isLastAssistant, onUiSelect }: Props) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className={styles.rowUser}>
        <div className={styles.bubbleUser}>
          <p>{message.content}</p>
        </div>
      </div>
    );
  }

  const intentLabel = message.intent ? (INTENT_LABEL[message.intent] ?? message.intent) : null;
  const riskLabel = message.riskLevel ? RISK_LABEL[message.riskLevel] : null;
  const riskClass = message.riskLevel === 'high'
    ? styles.riskHigh
    : message.riskLevel === 'medium'
    ? styles.riskMedium
    : styles.riskLow;

  return (
    <div className={styles.rowAssistant}>
      <div className={styles.avatar}>AI</div>
      <div className={styles.assistantBody}>
        {/* 배지 영역 */}
        {(intentLabel || riskLabel || message.engine) && (
          <div className={styles.badges}>
            {intentLabel && <span className={styles.intentBadge}>{intentLabel}</span>}
            {riskLabel && <span className={`${styles.riskBadge} ${riskClass}`}>위험도 {riskLabel}</span>}
            {message.engine === 'fallback' && (
              <span className={styles.fallbackBadge}>Fallback 응답</span>
            )}
            {message.modelName && (
              <span className={styles.modelBadge}>{message.modelName}</span>
            )}
          </div>
        )}

        {/* 메시지 본문 */}
        <div className={styles.bubbleAssistant}>
          <p className={styles.replyText}>{message.content}</p>

          {/* 응급 경고 — 최우선 표시 */}
          {message.emergencyWarning && message.emergencyWarning.length > 0 && (
            <div className={styles.medSection}>
              <p className={`${styles.medTitle} ${styles.medTitleDanger}`}>응급 주의</p>
              <ul className={styles.medList}>
                {message.emergencyWarning.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 가능한 원인 */}
          {message.possibleCauses && message.possibleCauses.length > 0 && (
            <div className={styles.medSection}>
              <p className={styles.medTitle}>가능한 원인</p>
              <ul className={styles.medList}>
                {message.possibleCauses.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 자가 관리 */}
          {message.homeCare && message.homeCare.length > 0 && (
            <div className={styles.medSection}>
              <p className={styles.medTitle}>자가 관리</p>
              <ul className={styles.medList}>
                {message.homeCare.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 병원 방문 기준 */}
          {message.visitHospitalIf && message.visitHospitalIf.length > 0 && (
            <div className={styles.medSection}>
              <p className={styles.medTitle}>병원 방문이 필요한 경우</p>
              <ul className={styles.medList}>
                {message.visitHospitalIf.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 툴 결과 카드 */}
          {message.type === 'tool_result' && message.tool && (
            <ChatToolCard
              tool={message.tool}
              data={message.toolData}
              onUiSelect={onUiSelect}
            />
          )}

          {/* UI 프롬프트 — 마지막 assistant 메시지에만 활성 */}
          {message.type === 'ui' && message.ui && (
            <ChatUiPrompt
              ui={message.ui}
              active={isLastAssistant}
              onSelect={onUiSelect}
            />
          )}
        </div>
      </div>
    </div>
  );
}
