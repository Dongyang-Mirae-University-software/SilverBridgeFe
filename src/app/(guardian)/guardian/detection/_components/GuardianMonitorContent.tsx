'use client';

import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getLiveStreamLatestAnalysis, getLiveStreamStatus, getLiveStreams } from '@/service/api/liveStream';
import { connectLiveStreamSocket } from '@/lib/realtime/liveStreamSocket';
import type { LiveStreamSession } from '@/service/interface/liveStream';
import { resolveDetectState } from '@/service/interface/liveStream';

import styles from './GuardianMonitorContent.module.css';

export default function GuardianMonitorContent() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const socketRef = useRef<ReturnType<typeof connectLiveStreamSocket> | null>(null);

  // 세션 목록 — 15초 폴링
  const { data: sessions = [], isLoading, isError, error } = useQuery({
    queryKey: ['liveStreams'],
    queryFn: getLiveStreams,
    refetchInterval: 15_000,
  });

  // 선택된 세션 상태 (fps, viewerCount, isAnalyzing)
  const { data: status } = useQuery({
    queryKey: ['liveStreamStatus', selectedId],
    queryFn: () => getLiveStreamStatus(selectedId!),
    enabled: !!selectedId,
  });

  // 선택된 세션 최신 AI 분석 결과
  const { data: analysis } = useQuery({
    queryKey: ['liveStreamAnalysis', selectedId],
    queryFn: () => getLiveStreamLatestAnalysis(selectedId!),
    enabled: !!selectedId,
  });

  void sessions; void status; void analysis; void isLoading; void isError; void error;
  void selectedId; void socketRef; void queryClient;

  return null;
}
