import type {EmailOtpType} from '@supabase/supabase-js';

export interface SupabaseErrorLike {
  message?: string;
  code?: string;
  status?: number;
}

export function getAuthRedirectUrl(explicitOrigin?: string): string | undefined {
  const envSiteUrl = import.meta.env?.VITE_PUBLIC_SITE_URL?.trim();
  if (envSiteUrl) {
    return envSiteUrl.replace(/\/+$/, '');
  }
  if (explicitOrigin) {
    return explicitOrigin.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return undefined;
}

export function extractRateLimitSeconds(message: string, status?: number): number {
  const match =
    message.match(/after\s+(\d+)\s+second/i) ||
    message.match(/in\s+(\d+)\s+second/i) ||
    message.match(/wait\s+(\d+)\s+second/i);
  if (match && match[1]) {
    const parsed = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.min(Math.max(parsed, 5), 300);
    }
  }
  if (
    status === 429 ||
    /rate\s*limit|too many requests|over_email_send_rate_limit/i.test(message)
  ) {
    return 60;
  }
  return 0;
}

export function formatGoogleOAuthError(err: SupabaseErrorLike): string {
  const raw = err.message?.trim() || '';
  const code = err.code?.trim() || '';
  const combined = `${raw} ${code}`.toLowerCase();

  if (
    /failed to fetch|networkerror|network request failed|err_internet_disconnected|offline|load failed/i.test(
      combined,
    )
  ) {
    return 'Network connection problem. Check your internet connection and try Google Sign-In again.';
  }

  if (
    /provider is not enabled|unsupported provider|validation_failed|invalid_client|redirect_uri|missing oauth|oauth.*not configured/i.test(
      combined,
    )
  ) {
    return `Invalid OAuth configuration. Ensure the Google provider is enabled with your Google Client ID and Client Secret in Supabase Dashboard → Authentication → Providers → Google. (${
      raw || code
    })`;
  }

  if (/access_denied|cancel|user denied|consent/i.test(combined)) {
    return 'Google authentication cancelled. Select Continue with Google to pick a Google account, or sign in with email below.';
  }

  if (/jwt expired|session.*expired|refresh_token/i.test(combined)) {
    return 'Session expired. Please sign in again with Google or your email account.';
  }

  const detail = raw || code || `HTTP ${err.status ?? 'unknown'}`;
  return `Google authentication failed. (${detail})`;
}

export function formatSupabaseAuthError(err: SupabaseErrorLike): string {
  const raw = err.message?.trim() || '';
  const code = err.code?.trim() || '';
  const combined = `${raw} ${code}`.toLowerCase();

  if (
    /failed to fetch|networkerror|network request failed|err_internet_disconnected|load failed/i.test(
      combined,
    )
  ) {
    return 'Network connection problem. Check your internet connection and try again.';
  }

  if (
    /provider is not enabled|unsupported provider|invalid_client|oauth.*not configured/i.test(
      combined,
    )
  ) {
    return formatGoogleOAuthError(err);
  }

  if (/jwt expired|session.*expired|invalid refresh token/i.test(combined)) {
    return 'Session expired. Please sign in again.';
  }

  if (
    (err.status !== undefined && err.status >= 500) ||
    /error sending confirmation|error sending magic link|535|5\.7\.8|username and password not accepted|smtp|unexpected_failure/i.test(
      combined,
    )
  ) {
    const detail = raw || `HTTP ${err.status ?? 500}`;
    return `Email sending failed. Supabase Custom SMTP authentication or delivery failed (${detail}). Use Continue with Google, or verify SMTP settings in Supabase Dashboard → Authentication → SMTP Settings.`;
  }

  if (
    /otp_expired|token has expired|link is invalid or has expired|invalid.*expired/i.test(
      combined,
    )
  ) {
    return `Invalid or expired confirmation link or verification code. Please resend a new confirmation email below. (${
      raw || code
    })`;
  }

  if (
    err.status === 429 ||
    /rate\s*limit|too many requests|over_email_send_rate_limit/i.test(combined)
  ) {
    const wait = extractRateLimitSeconds(raw, err.status);
    return `Email sending rate limit reached. Please wait ${wait || 60} seconds before requesting another email. (${raw})`;
  }

  const base = raw || `Authentication request failed (HTTP ${err.status ?? 'unknown'}).`;
  if (code && !base.toLowerCase().includes(code.toLowerCase())) {
    return `${base} [${code}]`;
  }
  return base;
}

export type ConfirmationCallbackResult =
  | {kind: 'none'}
  | {kind: 'error'; source: 'oauth' | 'email'; message: string}
  | {kind: 'token_hash'; tokenHash: string; type: EmailOtpType}
  | {kind: 'code'; code: string}
  | {kind: 'implicit'; isRecovery: boolean};

export function parseConfirmationCallbackFromUrl(
  href: string,
): ConfirmationCallbackResult {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return {kind: 'none'};
  }

  const searchParams = url.searchParams;
  const hashRaw = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const hashParams = new URLSearchParams(hashRaw);

  const errParam = searchParams.get('error') || hashParams.get('error');
  const errCode = searchParams.get('error_code') || hashParams.get('error_code');
  const errDesc =
    searchParams.get('error_description') || hashParams.get('error_description');

  if (errParam || errCode || errDesc) {
    const readableDesc = (errDesc || errParam || errCode || '')
      .replace(/\+/g, ' ')
      .trim();
    const lowerCombined = `${errParam || ''} ${errCode || ''} ${readableDesc}`.toLowerCase();

    if (
      errCode === 'otp_expired' ||
      /email\s*link|otp|confirmation\s*link|token.*expired/i.test(lowerCombined)
    ) {
      return {
        kind: 'error',
        source: 'email',
        message: `Invalid or expired confirmation link. ${
          readableDesc ? `(${readableDesc}) ` : ''
        }Enter your email address below and resend a confirmation email, or sign in with Google.`,
      };
    }

    if (
      errParam === 'access_denied' ||
      /access_denied|user denied|cancel/i.test(lowerCombined)
    ) {
      return {
        kind: 'error',
        source: 'oauth',
        message:
          'Google authentication cancelled. Click Continue with Google to try again, or sign in with your email account.',
      };
    }

    if (
      /invalid_client|redirect_uri|provider|oauth|unauthorized_client|server_error/i.test(
        lowerCombined,
      )
    ) {
      return {
        kind: 'error',
        source: 'oauth',
        message: `Invalid OAuth configuration or Google authentication failed. (${
          readableDesc || errCode || errParam
        })`,
      };
    }

    return {
      kind: 'error',
      source: 'oauth',
      message: `Google authentication failed: ${readableDesc || errCode || errParam}.`,
    };
  }

  const tokenHash = searchParams.get('token_hash');
  const rawType = searchParams.get('type');
  if (tokenHash && rawType) {
    const allowedTypes = new Set<EmailOtpType>([
      'signup',
      'email',
      'recovery',
      'invite',
      'email_change',
    ]);
    const verifiedType: EmailOtpType = allowedTypes.has(rawType as EmailOtpType)
      ? (rawType as EmailOtpType)
      : 'signup';
    return {kind: 'token_hash', tokenHash, type: verifiedType};
  }

  const code = searchParams.get('code');
  if (code) {
    return {kind: 'code', code};
  }

  if (hashParams.get('access_token')) {
    return {
      kind: 'implicit',
      isRecovery: hashParams.get('type') === 'recovery',
    };
  }

  return {kind: 'none'};
}
