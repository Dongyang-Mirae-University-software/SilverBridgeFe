export function getResponseData<T>(response: unknown): T | null {
  const body = response as { data?: unknown } | undefined;
  if (!body) return null;

  const data = body.data;
  if (data && typeof data === 'object' && 'data' in data) {
    return ((data as { data?: T }).data ?? null) as T | null;
  }

  return (data as T | undefined) ?? null;
}
