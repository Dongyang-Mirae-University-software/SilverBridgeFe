import { UserAvatar } from '@/components/UserAvatar';
import type { ChatMessage } from '@/service/interface/chat';
import ChatToolCard from './ChatToolCard';
import ChatUiPrompt from './ChatUiPrompt';
import styles from './ChatBubble.module.css';

interface Props {
  message: ChatMessage;
  isLastAssistant: boolean;
  onUiSelect: (field: string, value: string, label?: string) => void;
  userImageUrl?: string | null;
  userName?: string | null;
  variant?: 'guardian' | 'ward';
}

export default function ChatBubble({
  message,
  isLastAssistant,
  onUiSelect,
  userImageUrl,
  userName,
  variant = 'guardian',
}: Props) {
  const isUser = message.role === 'user';
  const isWardChat = variant === 'ward';

  if (isUser) {
    return (
      <div className={`${styles.rowUser} ${isWardChat ? styles.wardBubble : ''}`}>
        <div className={styles.messageColumnUser}>
          <div className={styles.bubbleUser}>
            <p>{message.content}</p>
          </div>
        </div>
        {/* 피보호자 화면은 아바타 없이 큰 말풍선만 둔다 */}
        {!isWardChat && <UserAvatar imageUrl={userImageUrl} userName={userName} size="w-38" />}
      </div>
    );
  }

  return (
    <div className={`${styles.rowAssistant} ${isWardChat ? styles.wardBubble : ''}`}>
      {!isWardChat && <div className={styles.avatar}>AI</div>}
      <div className={styles.assistantBody}>
        {/* 메시지 본문 */}
        <div className={styles.assistantMessageRow}>
          <div className={styles.messageColumnAssistant}>
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
            {message.type === 'tool_result' &&
              message.tool &&
              // 예약 목록은 UI 선택 컨트롤로 한 번만 표시한다. toolData의 전체 목록과
              // ui.options를 동시에 그리면 수십 개 항목이 중복되어 말풍선이 무너진다.
              !(message.tool === 'list_my_appointments' && message.ui?.field === 'reservation_id') && (
              <ChatToolCard
                tool={message.tool}
                data={message.toolData}
                onUiSelect={onUiSelect}
              />
            )}

            {/* 응답 type과 무관하게 ui가 있으면 선택지를 표시한다.
                예약 시간 응답은 type이 tool_result/message여도 ui.select를 함께 내려줄 수 있다. */}
            {message.ui && (
              <ChatUiPrompt
                ui={message.ui}
                active={isLastAssistant}
                onSelect={onUiSelect}
              />
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

