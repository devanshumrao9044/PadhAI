export type PasswordValidationResult = {
  valid: boolean;
  error?: string;
};

export function validatePassword(password: string): PasswordValidationResult {
  if (password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters.' };
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z\d]/.test(password)) {
    return {
      valid: false,
      error: 'Use at least one uppercase letter, one lowercase letter, one number, and one symbol.',
    };
  }

  return { valid: true };
}

export function getPasswordProviderError(message: string): string | null {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('weak password') ||
    normalized.includes('password is too weak') ||
    normalized.includes('password has been exposed') ||
    normalized.includes('leaked password') ||
    normalized.includes('pwned')
  ) {
    return 'Choose a stronger password. This password is too weak or has appeared in a known breach.';
  }
  return null;
}
