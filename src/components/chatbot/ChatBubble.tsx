import { UserAvatar } from '@/components/UserAvatar';
import type { ChatLayout, ChatMessage } from '@/service/interface/chat';
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
  const layout = normalizeLayout(message.layout);
  const warnings = strings(message.emergencyWarning);

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
            {/* 응급 경고 - 맨 위(빨간 상자). 문구는 비교하지 않고 있는지만 본다 */}
            {warnings.length > 0 && (
              <div className={styles.emergencyBox} role="alert">
                <p className={styles.emergencyTitle}>응급 주의</p>
                <ul className={styles.emergencyList}>
                  {warnings.map((item, i) => (
                    <li key={i}>
                      <Emphasize text={item} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {layout ? (
              <>
                {layout.headline && (
                  <p className={styles.headline}>
                    <Line text={layout.headline} />
                  </p>
                )}
                {layout.body.length > 0 && (
                  <ul className={styles.lines}>
                    {layout.body.map((line, i) => (
                      <li key={i}>
                        <Line text={line} />
                      </li>
                    ))}
                  </ul>
                )}
                <SectionCard icon="❓" title="이렇게 알려 주세요" items={layout.questions} tone="ask" />
                <SectionCard icon="🏠" title="집에서 이렇게" items={layout.homeCare} tone="home" />
                <SectionCard icon="🏥" title="이럴 땐 병원으로" items={layout.visitHospitalIf} tone="hospital" />
              </>
            ) : (
              <>
                <p className={styles.replyText}>{message.content}</p>
                <SectionCard icon="🩺" title="가능한 원인" items={strings(message.possibleCauses)} tone="plain" />
                <SectionCard icon="🏠" title="집에서 이렇게" items={strings(message.homeCare)} tone="home" />
                <SectionCard icon="🏥" title="이럴 땐 병원으로" items={strings(message.visitHospitalIf)} tone="hospital" />
              </>
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


interface NormalizedLayout {
  headline: string | null;
  body: string[];
  questions: string[];
  homeCare: string[];
  visitHospitalIf: string[];
}

/** 문자열만 남긴 목록(빈 칸·이상한 값은 그리지 않는다). */
function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

/** layout 이 객체이고 그릴 문장이 하나라도 있을 때만 쓴다 - 아니면 옛 방식(reply)으로 그린다. */
function normalizeLayout(layout: ChatLayout | null | undefined): NormalizedLayout | null {
  if (!layout || typeof layout !== 'object' || Array.isArray(layout)) return null;
  const headline = typeof layout.headline === 'string' && layout.headline.trim() ? layout.headline : null;
  const out = {
    headline,
    body: strings(layout.body),
    questions: strings(layout.questions),
    homeCare: strings(layout.homeCare),
    visitHospitalIf: strings(layout.visitHospitalIf),
  };
  const total = (headline ? 1 : 0) + out.body.length + out.questions.length + out.homeCare.length + out.visitHospitalIf.length;
  return total > 0 ? out : null;
}

/** 숫자 119만 빨갛고 굵게 보인다(보이는 모양만 - 판단에 쓰지 않는다). */
function Emphasize({ text }: { text: string }) {
  const parts = text.split(/(119)/);
  return (
    <>
      {parts.map((part, i) =>
        part === '119' ? (
          <strong key={i} className={styles.n119}>
            119
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** 줄 머리 이모지(AI가 붙인 장식) - 맨 앞 그림 문자 하나와 뒤 공백. 보이는 모양만 나눈다(판단에 쓰지 않는다). */
const LEAD_EMOJI = /^(\p{Extended_Pictographic}\uFE0F?)\s+/u;

/**
 * 답 한 줄. 줄 머리 이모지는 화면 읽기 프로그램이 이름("물방울" 등)을 먼저 읽지 않게 aria-hidden 으로 감싸고,
 * 나머지 글은 그대로 글자로 넣는다(HTML 로 해석하지 않는다).
 */
function Line({ text }: { text: string }) {
  const match = LEAD_EMOJI.exec(text);
  if (!match) return <Emphasize text={text} />;
  return (
    <>
      <span aria-hidden="true">{match[1]} </span>
      <Emphasize text={text.slice(match[0].length)} />
    </>
  );
}

function SectionCard({
  icon,
  title,
  items,
  tone,
}: {
  icon: string;
  title: string;
  items: string[];
  tone: 'home' | 'hospital' | 'ask' | 'plain';
}) {
  if (items.length === 0) return null; // 빈 칸은 그리지 않는다
  return (
    <section className={`${styles.card} ${styles[`card_${tone}`] ?? ''}`}>
      <p className={styles.cardTitle}>
        <span aria-hidden="true">{icon} </span>
        {title}
      </p>
      <ul className={styles.lines}>
        {items.map((item, i) => (
          <li key={i}>
            <Line text={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}
