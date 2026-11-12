// 챗봇 화면 전용 장식 아이콘(공용 Icon 에 없는 것만). 모두 장식이라 화면 읽기 프로그램은 읽지 않는다 - 글자를 옆에 둔다.

type Props = { size?: number; className?: string };

function Svg({ size = 24, className, strokeWidth = 2, children }: Props & { strokeWidth?: number; children: React.ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** 상담 기록(시계 + 되돌리기) */
export function HistoryIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </Svg>
  );
}

/** 새 대화 */
export function NewChatIcon(props: Props) {
  return (
    <Svg {...props} strokeWidth={2.4}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

/** 보내기(종이비행기) */
export function SendIcon(props: Props) {
  return (
    <Svg {...props} strokeWidth={2.2}>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4z" />
    </Svg>
  );
}

/** 말풍선 - 답에 딸린 칩(되묻기 답·이어질 질문) */
export function BubbleIcon(props: Props) {
  return (
    <Svg {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

export function CalendarIcon(props: Props) {
  return (
    <Svg {...props} strokeWidth={2.2}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Svg>
  );
}

export function PhoneIcon(props: Props) {
  return (
    <Svg {...props} strokeWidth={2.2}>
      <path d="M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </Svg>
  );
}

export function CloseIcon(props: Props) {
  return (
    <Svg {...props} strokeWidth={2.6}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function WarningIcon(props: Props) {
  return (
    <Svg {...props} strokeWidth={2.6}>
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v4M12 17.5v.5" />
    </Svg>
  );
}

/** 기본 빠른 질문(머리·배·무릎·어지러움) 부위 그림. 정해진 문장에만 붙는다 - 없으면 말풍선 아이콘 */
const BODY_PART_PATHS: Record<string, React.ReactNode> = {
  '머리가 아파요': (
    <>
      <circle cx="12" cy="14" r="7" />
      <path d="M7 4.5l1.6 1.8L10.2 4.5l1.6 1.8 1.6-1.8 1.6 1.8 1.6-1.8" />
      <path d="M9.5 16.5q2.5-1.6 5 0" />
    </>
  ),
  '배가 아파요': (
    <>
      <ellipse cx="12" cy="13" rx="7" ry="8" />
      <circle cx="12" cy="14" r="1.3" />
    </>
  ),
  '무릎이 아파요': (
    <>
      <path d="M9 2v8.5l5.5 3.5V22" />
      <circle cx="11" cy="12" r="2.6" />
    </>
  ),
  '어지러워요': <path d="M12 12a1 1 0 1 1 1-1 3 3 0 1 1-3-3 5 5 0 1 1-5 5 7 7 0 1 1 7 7" />,
};

export function QuickPromptIcon({ text, ...props }: Props & { text: string }) {
  const part = BODY_PART_PATHS[text];
  if (!part) return <BubbleIcon {...props} />;
  return <Svg {...props}>{part}</Svg>;
}
