// 송출 방식 선택 (영상 전송 H.264 PoC, 2026-10-14)
//
// 송출 시작 때 한 번 판정한다. 아래 조건이 모두 맞을 때만 h264이고, 그 밖은 전부 jpeg(현재 코드 그대로)다.
//   PoC 플래그 켜짐 AND 서버 transport === 'ws-h264' AND VideoEncoder 지원 AND isConfigSupported AND 티켓 발급 성공
// 어느 단계든 실패하면 같은 세션을 JPEG로 보내고, 이 세션에서는 다시 h264로 올리지 않는다(호출자가 지킨다).

import { buildEncoderConfig } from './h264Sender';

export type TransportSkipReason = 'poc_off' | 'server_jpeg' | 'no_encoder' | 'config_unsupported' | 'ticket_failed';

export type TransportChoice =
  | { kind: 'jpeg'; reason: TransportSkipReason }
  | { kind: 'h264'; ticket: string; uploadUrl: string };

export interface UploadTicket {
  ticket: string;
  expiresInSeconds: number;
  uploadUrl: string;
}

export interface SelectTransportInput {
  cameraId: number;
  serverTransport: string | undefined;
  width: number;
  height: number;
  framerate: number;
  deps?: Partial<SelectTransportDeps>;
}

export interface SelectTransportDeps {
  isPocEnabled(): boolean;
  hasEncoder(): boolean;
  isConfigSupported(config: Record<string, unknown>): Promise<boolean>;
  issueTicket(cameraId: number): Promise<UploadTicket>;
}

// PoC 플래그: 빌드 환경변수 또는 주소의 ?transport=h264. 둘 다 없으면 어떤 환경에서도 지금과 동일하게 동작한다.
export function isH264PocEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_VIDEO_TRANSPORT_POC === '1') return true;
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('transport') === 'h264';
  } catch {
    return false;
  }
}

function browserHasEncoder() {
  return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined' && typeof WebSocket !== 'undefined';
}

async function browserIsConfigSupported(config: Record<string, unknown>) {
  try {
    const result = await VideoEncoder.isConfigSupported(config as unknown as VideoEncoderConfig);
    return Boolean(result.supported);
  } catch {
    return false;
  }
}

// 업로드 주소는 ws(s) 스킴만 받는다. 서버가 내린 값이라도 그 밖의 스킴은 쓰지 않는다.
export function buildUploadSocketUrl(uploadUrl: string, ticket: string): string | null {
  if (!/^wss?:\/\//.test(uploadUrl)) return null;
  const separator = uploadUrl.includes('?') ? '&' : '?';
  return `${uploadUrl}${separator}ticket=${encodeURIComponent(ticket)}`;
}

export async function selectTransport(input: SelectTransportInput): Promise<TransportChoice> {
  const deps: SelectTransportDeps = {
    isPocEnabled: isH264PocEnabled,
    hasEncoder: browserHasEncoder,
    isConfigSupported: browserIsConfigSupported,
    issueTicket: async () => {
      throw new Error('issueTicket dependency is required');
    },
    ...input.deps,
  };

  // 네트워크 호출 전에 거를 수 있는 것부터 - PoC가 꺼져 있으면 서버에 아무것도 묻지 않는다
  if (!deps.isPocEnabled()) return { kind: 'jpeg', reason: 'poc_off' };
  if (input.serverTransport !== 'ws-h264') return { kind: 'jpeg', reason: 'server_jpeg' };
  if (!deps.hasEncoder()) return { kind: 'jpeg', reason: 'no_encoder' };

  const supported = await deps.isConfigSupported(buildEncoderConfig(input.width, input.height, input.framerate));
  if (!supported) return { kind: 'jpeg', reason: 'config_unsupported' };

  try {
    const ticket = await deps.issueTicket(input.cameraId);
    if (!ticket?.ticket || !buildUploadSocketUrl(ticket.uploadUrl, ticket.ticket)) {
      return { kind: 'jpeg', reason: 'ticket_failed' };
    }
    return { kind: 'h264', ticket: ticket.ticket, uploadUrl: ticket.uploadUrl };
  } catch {
    // 409(대상 아님)·429·503(기능 꺼짐·Redis 장애)·네트워크 오류 모두 JPEG로 간다
    return { kind: 'jpeg', reason: 'ticket_failed' };
  }
}
