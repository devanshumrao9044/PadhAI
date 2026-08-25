type SafeErrorOptions = {
  fallback?: string;
  network?: string;
  permission?: string;
  rateLimit?: string;
};

export function getSafeErrorMessage(
  error: unknown,
  options: SafeErrorOptions = {},
): string {
  const fallback = options.fallback ?? 'Something went wrong. Please try again.';

  if (!error) return fallback;

  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
      ? error.message
      : typeof (error as any)?.message === 'string'
      ? (error as any).message
      : '';

  if (!message) return fallback;

  const lower = message.toLowerCase();

  if (
    lower.includes('network') ||
    lower.includes('fetch') ||
    lower.includes('timeout') ||
    lower.includes('internet') ||
    lower.includes('connection') ||
    lower.includes('offline')
  ) {
    return options.network ?? fallback;
  }

  if (
    lower.includes('permission') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden') ||
    lower.includes('not allowed')
  ) {
    return options.permission ?? fallback;
  }

  if (
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('429')
  ) {
    return options.rateLimit ?? fallback;
  }

  return message || fallback;
}
