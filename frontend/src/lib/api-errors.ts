export function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload !== 'object' || payload === null || !('detail' in payload)) {
    return fallback;
  }

  const { detail } = payload;
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }
  if (Array.isArray(detail)) {
    const messages = detail.flatMap((item) => {
      if (typeof item === 'object' && item !== null && 'msg' in item && typeof item.msg === 'string') {
        return [item.msg];
      }
      return [];
    });
    if (messages.length) return messages.join(' ');
  }

  return fallback;
}
