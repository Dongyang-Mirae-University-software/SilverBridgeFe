function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isApiRequestError(error: unknown) {
  if (!isRecord(error)) return false;
  if (error.isAxiosError === true) return true;

  const response = error.response;
  return isRecord(response) && typeof response.status === 'number';
}

export function reportNonApiError(message: string, error: unknown) {
  if (isApiRequestError(error)) return;
  console.warn(message, error);
}
