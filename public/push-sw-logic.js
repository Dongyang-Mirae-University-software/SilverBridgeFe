// 웹푸시 알림 모양·이동 경로 규칙 (서비스 워커가 importScripts로 읽는다, 단위 테스트는 require로 읽는다).
// 브라우저 API를 부르지 않는 순수 함수만 둔다 - 표시·클릭 처리는 firebase-messaging-sw.js에 있다.
(function (root) {
  const ICON_DIR = '/icons/push/';
  const FCM_MSG = 'FCM_MSG';

  const KIND_BY_TYPE = {
    WARD_SOS: 'sos',
    ANOMALY_DETECTED: 'anomaly',
    ANOMALY_REVIEW_REQUIRED: 'anomaly',
    ANOMALY_REVIEW_SUMMARY: 'anomaly',
    ANOMALY_REVIEW_CONFLICTED: 'anomaly',
    CAMERA_LINK_LOST: 'anomaly',
    MEDICATION_REMINDER: 'medication',
    MEDICATION_MISSED: 'medication',
    MEDICATION_STOPPED: 'medication',
    CONNECTION_REQUEST: 'connection',
    CONNECTION_ACCEPTED: 'connection',
    CONNECTION_REFUSED: 'connection',
    CONNECTION_FORCED: 'connection',
    CONNECTION_CANCELLED: 'connection',
    CONNECTION_DISCONNECTED: 'connection',
    DISCONNECTION: 'connection',
  };

  // BE가 data에 title·body를 싣지 않았을 때만 쓰는 예비 문구
  const FALLBACK_TEXT = {
    WARD_SOS: data => [
      '긴급 SOS',
      `${(data && data.wardName) || '피보호자'}님이 긴급 도움을 요청했습니다.`,
    ],
    ANOMALY_DETECTED: data => ['이상감지', `${(data && data.detectedTypeLabel) || '이상 상황'}이 감지되었습니다.`],
    ANOMALY_REVIEW_REQUIRED: () => ['이상감지 확인이 필요해요', '감지가 실제 상황이었는지 확인해 주세요.'],
    ANOMALY_REVIEW_SUMMARY: () => ['이상감지 확인이 필요해요', '확인하지 않은 이상감지가 있습니다.'],
    ANOMALY_REVIEW_CONFLICTED: () => ['판정 확인 요청', '다른 보호자와 판정이 다릅니다. 다시 확인해 주세요.'],
    CAMERA_LINK_LOST: () => ['카메라 연결 확인 필요', '카메라 영상이 확인되지 않습니다.'],
    MEDICATION_REMINDER: () => ['복약 알림', '복용 시각이 되었습니다.'],
    MEDICATION_MISSED: () => ['복약 확인 요청', '체크되지 않은 복약이 있습니다.'],
    MEDICATION_STOPPED: () => ['복약 일정 중지', '복약 일정이 중지되었습니다. 다시 등록해 주세요.'],
    CONNECTION_REQUEST: () => ['연결 요청', '보호자가 연결을 요청했습니다.'],
    CONNECTION_ACCEPTED: () => ['연결 수락', '연결 요청이 수락되었습니다.'],
    CONNECTION_REFUSED: () => ['연결 거절', '연결 요청이 거절되었습니다.'],
    CONNECTION_FORCED: () => ['가족 연결', '가족 연결이 만들어졌습니다.'],
    CONNECTION_CANCELLED: () => ['연결 해제', '연결이 해제되었습니다.'],
    CONNECTION_DISCONNECTED: () => ['연결 해제', '연결이 해제되었습니다.'],
    DISCONNECTION: () => ['연결 해제', '연결이 해제되었습니다.'],
    INQUIRY_ANSWERED: () => ['문의 답변', '문의에 답변이 등록되었습니다.'],
  };

  const ANOMALY_ICON = { FIRE: 'fire', FALL: 'fall', WEAPON: 'weapon' };

  function getKind(data) {
    return KIND_BY_TYPE[data && data.type] || 'default';
  }

  function getIcon(data) {
    const kind = getKind(data);
    if (kind === 'anomaly') {
      const glyph = (data.type === 'ANOMALY_DETECTED' && ANOMALY_ICON[data.detectedType]) || 'anomaly';
      return `${ICON_DIR}icon-${glyph}.png`;
    }
    return `${ICON_DIR}icon-${kind}.png`;
  }

  function getContent(payload) {
    const data = (payload && payload.data) || {};
    const notification = (payload && payload.notification) || {};
    const fallback = FALLBACK_TEXT[data.type] ? FALLBACK_TEXT[data.type](data) : ['알림', ''];
    return {
      title: data.title || notification.title || fallback[0],
      body: data.body || notification.body || fallback[1],
    };
  }

  // 같은 대상의 알림은 한 장으로 묶는다(같은 SOS 연타가 알림 목록에 쌓이지 않게)
  function getTag(data) {
    data = data || {};
    const type = data.type || 'NOTICE';
    const target =
      data.sosEventId ||
      data.incidentId ||
      data.anomalyEventId ||
      data.connectionId ||
      data.medicationId ||
      data.inquiryId ||
      data.summaryDate ||
      [data.wardId, data.doseDate].filter(Boolean).join('-');
    return target ? `${type}:${target}` : type;
  }

  // 알림 버튼은 보호자에게만 - 피보호자 본인이 받는 이상감지에는 영상 확인 화면이 없다
  function getActions(data, role) {
    if (role === 'WARD') return [];
    switch (data && data.type) {
      case 'WARD_SOS':
        return [
          { action: 'open-sos', title: 'SOS 화면 열기' },
          { action: 'family-contacts', title: '가족 연락처' },
        ];
      case 'ANOMALY_DETECTED':
        return [
          { action: 'view-clip', title: '영상 확인' },
          { action: 'view-live', title: '실시간 보기' },
        ];
      default:
        return [];
    }
  }

  function buildNotification(payload, role) {
    const data = (payload && payload.data) || {};
    const content = getContent(payload);
    const kind = getKind(data);
    const urgent = kind === 'sos' || data.type === 'ANOMALY_DETECTED';
    return {
      title: content.title,
      options: {
        body: content.body,
        icon: getIcon(data),
        badge: `${ICON_DIR}badge.png`,
        tag: getTag(data),
        renotify: urgent,
        requireInteraction: data.type === 'WARD_SOS',
        actions: getActions(data, role),
        data,
      },
    };
  }

  // notification 블록이 있는 메시지는 Firebase 라이브러리가 이미 띄웠다 - 또 그리면 두 번 뜬다
  function shouldDraw(payload) {
    return Boolean(payload) && !payload.notification;
  }

  // 우리가 그린 알림은 data 그대로, 라이브러리가 그린 알림은 data.FCM_MSG.data 안에 들어 있다
  function getClickData(notificationData) {
    if (!notificationData) return {};
    const internal = notificationData[FCM_MSG];
    return (internal && internal.data) || notificationData;
  }

  function guardianOr(role, guardianPath, wardPath) {
    return role === 'WARD' ? wardPath : guardianPath;
  }

  // 역할을 모르면 보호자 경로로 연다 - 피보호자라면 RoleRouteGuard가 피보호자 홈으로 돌려보낸다
  function getPath(data, role, action) {
    const sessionQuery = data && data.sessionId ? `?session=${encodeURIComponent(data.sessionId)}` : '';
    switch (action) {
      case 'open-sos':
        return '/guardian/sos';
      case 'family-contacts':
        return '/guardian/wards';
      case 'view-clip':
        return '/guardian/detection';
      case 'view-live':
        return `/guardian/detection${sessionQuery}`;
      default:
        break;
    }
    switch (data && data.type) {
      case 'WARD_SOS':
        return '/guardian/sos';
      case 'ANOMALY_DETECTED':
        return guardianOr(role, `/guardian/detection${sessionQuery}`, '/ward');
      case 'ANOMALY_REVIEW_REQUIRED':
      case 'ANOMALY_REVIEW_SUMMARY':
      case 'ANOMALY_REVIEW_CONFLICTED':
      case 'CAMERA_LINK_LOST':
        return '/guardian/detection';
      case 'MEDICATION_REMINDER':
        return '/ward/medication';
      case 'MEDICATION_MISSED':
      case 'MEDICATION_STOPPED':
        return '/guardian/medication';
      case 'CONNECTION_REQUEST':
        return '/ward/guardians';
      case 'CONNECTION_ACCEPTED':
      case 'CONNECTION_REFUSED':
        return '/guardian/wards';
      case 'CONNECTION_FORCED':
      case 'CONNECTION_CANCELLED':
      case 'CONNECTION_DISCONNECTED':
      case 'DISCONNECTION':
        return guardianOr(role, '/guardian/wards', '/ward/guardians');
      case 'INQUIRY_ANSWERED':
        return '/guardian/inquiries';
      default:
        return guardianOr(role, '/guardian', '/ward');
    }
  }

  // access token(JWT)의 role 값만 읽는다. 서명은 보지 않는다 - 이동할 화면을 고르는 데만 쓴다
  function getRoleFromToken(token) {
    if (!token || typeof token !== 'string') return null;
    try {
      const part = token.split('.')[1];
      if (!part) return null;
      const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
      const claims = JSON.parse(atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')));
      return claims.role === 'WARD' || claims.role === 'GUARDIAN' ? claims.role : null;
    } catch {
      return null;
    }
  }

  function getRoleFromPath(url) {
    try {
      const { pathname } = new URL(url);
      if (pathname.startsWith('/ward')) return 'WARD';
      if (pathname.startsWith('/guardian')) return 'GUARDIAN';
    } catch {
      return null;
    }
    return null;
  }

  const api = {
    buildNotification,
    getActions,
    getClickData,
    getContent,
    getIcon,
    getKind,
    getPath,
    getRoleFromPath,
    getRoleFromToken,
    getTag,
    shouldDraw,
  };

  root.SilverBridgePush = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
