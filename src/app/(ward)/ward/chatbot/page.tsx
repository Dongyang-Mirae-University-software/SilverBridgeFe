import type { Metadata } from 'next';
import ChatbotContent from '@/components/chatbot/ChatbotContent';

export const metadata: Metadata = { title: 'AI 의료 챗봇' };

export default function WardChatbotPage() {
  return <ChatbotContent variant="ward" />;
}
