import { CommonResponse } from '@/service/interface/common';
import { IConnectionItem } from '@/service/interface/connection';

interface ConnectionResponseBodyLike {
  code?: number;
  data?: CommonResponse<IConnectionItem[]> | IConnectionItem[];
  message?: string;
  success?: boolean;
}

export function getConnectionResponseBody(response: unknown): CommonResponse<IConnectionItem[]> | null {
  const body = response as ConnectionResponseBodyLike | undefined;

  if (!body) return null;

  if (Array.isArray(body.data)) {
    return {
      code: body.code,
      success: body.success,
      message: body.message,
      data: body.data,
    };
  }

  const nestedBody = body.data;
  if (nestedBody && typeof nestedBody === 'object' && 'data' in nestedBody) {
    return nestedBody as CommonResponse<IConnectionItem[]>;
  }

  if (Array.isArray(response)) {
    return { success: true, data: response };
  }

  return body as CommonResponse<IConnectionItem[]>;
}

export function getConnectionItems(response: unknown) {
  return getConnectionResponseBody(response)?.data ?? [];
}

export function mergeConnectionItems(...groups: IConnectionItem[][]) {
  const itemMap = new Map<number, IConnectionItem>();

  groups.flat().forEach(item => {
    itemMap.set(item.id, normalizeConnectionItem(item));
  });

  return Array.from(itemMap.values());
}

export function normalizeConnectionItem(item: IConnectionItem): IConnectionItem {
  return {
    ...item,
    requester: item.requester ?? item.isRequester ?? false,
  };
}
