import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractRateLimitSeconds,
  formatGoogleOAuthError,
  formatSupabaseAuthError,
  getAuthRedirectUrl,
  parseConfirmationCallbackFromUrl,
} from './authConfirmation.ts';

test('getAuthRedirectUrl formats CycloneSafe redirect URL cleanly', () => {
  assert.equal(
    getAuthRedirectUrl(
      'https://ais-dev-naxyih2iwpq2l2wvok3l5u-26996559413.asia-east1.run.app/',
    ),
    'https://ais-dev-naxyih2iwpq2l2wvok3l5u-26996559413.asia-east1.run.app',
  );
});

test('formatGoogleOAuthError classifies cancelled, config, network, and session errors', () => {
  assert.match(
    formatGoogleOAuthError({message: 'access_denied'}),
    /^Google authentication cancelled\./,
  );
  assert.match(
    formatGoogleOAuthError({message: 'Unsupported provider: provider is not enabled'}),
    /^Invalid OAuth configuration\./,
  );
  assert.match(
    formatGoogleOAuthError({message: 'Failed to fetch'}),
    /^Network connection problem\./,
  );
  assert.match(
    formatGoogleOAuthError({message: 'JWT expired'}),
    /^Session expired\./,
  );
  assert.match(
    formatGoogleOAuthError({message: 'Unexpected error'}),
    /^Google authentication failed\./,
  );
});

test('formatSupabaseAuthError handles HTTP 500 and SMTP 535 5.7.8 clearly', () => {
  const msg = formatSupabaseAuthError({
    status: 500,
    message: 'Error sending confirmation email',
    code: 'unexpected_failure',
  });
  assert.match(msg, /^Email sending failed\./);
  assert.match(msg, /SMTP/i);

  const smtp535 = formatSupabaseAuthError({
    status: 500,
    message: '535 5.7.8 Username and Password not accepted',
  });
  assert.match(smtp535, /^Email sending failed\./);
  assert.match(smtp535, /535 5\.7\.8/);
});

test('formatSupabaseAuthError handles invalid/expired confirmation links and rate limits', () => {
  const expired = formatSupabaseAuthError({
    status: 403,
    code: 'otp_expired',
    message: 'Email link is invalid or has expired',
  });
  assert.match(expired, /^Invalid or expired confirmation link/i);

  const rateLimited = formatSupabaseAuthError({
    status: 429,
    code: 'over_email_send_rate_limit',
    message: 'For security purposes, you can only request this after 45 seconds.',
  });
  assert.match(rateLimited, /45 seconds/);
  assert.equal(
    extractRateLimitSeconds(
      'For security purposes, you can only request this after 45 seconds.',
      429,
    ),
    45,
  );
});

test('parseConfirmationCallbackFromUrl distinguishes Google OAuth cancellation/errors vs email confirmation links', () => {
  const oauthCancelled = parseConfirmationCallbackFromUrl(
    'https://ais-pre-naxyih2iwpq2l2wvok3l5u-26996559413.asia-east1.run.app/?error=access_denied&error_description=User+denied+access',
  );
  assert.equal(oauthCancelled.kind, 'error');
  if (oauthCancelled.kind === 'error') {
    assert.equal(oauthCancelled.source, 'oauth');
    assert.match(oauthCancelled.message, /^Google authentication cancelled\./);
  }

  const oauthConfigErr = parseConfirmationCallbackFromUrl(
    'https://ais-dev-naxyih2iwpq2l2wvok3l5u-26996559413.asia-east1.run.app/?error=server_error&error_description=Unable+to+exchange+oauth+code',
  );
  assert.equal(oauthConfigErr.kind, 'error');
  if (oauthConfigErr.kind === 'error') {
    assert.equal(oauthConfigErr.source, 'oauth');
    assert.match(oauthConfigErr.message, /^Invalid OAuth configuration/);
  }

  const errHash = parseConfirmationCallbackFromUrl(
    'https://ais-pre-naxyih2iwpq2l2wvok3l5u-26996559413.asia-east1.run.app/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
  );
  assert.equal(errHash.kind, 'error');
  if (errHash.kind === 'error') {
    assert.equal(errHash.source, 'email');
    assert.match(errHash.message, /^Invalid or expired confirmation link\./);
  }

  const tokenHash = parseConfirmationCallbackFromUrl(
    'https://ais-dev-naxyih2iwpq2l2wvok3l5u-26996559413.asia-east1.run.app/?token_hash=th_123&type=signup',
  );
  assert.deepEqual(tokenHash, {
    kind: 'token_hash',
    tokenHash: 'th_123',
    type: 'signup',
  });

  const codeRes = parseConfirmationCallbackFromUrl(
    'https://ais-dev-naxyih2iwpq2l2wvok3l5u-26996559413.asia-east1.run.app/?code=pkce_code_456',
  );
  assert.deepEqual(codeRes, {kind: 'code', code: 'pkce_code_456'});

  const implicitRes = parseConfirmationCallbackFromUrl(
    'https://ais-dev-naxyih2iwpq2l2wvok3l5u-26996559413.asia-east1.run.app/#access_token=jwt123&type=signup',
  );
  assert.deepEqual(implicitRes, {kind: 'implicit', isRecovery: false});

  const cleanRes = parseConfirmationCallbackFromUrl(
    'https://ais-dev-naxyih2iwpq2l2wvok3l5u-26996559413.asia-east1.run.app/',
  );
  assert.deepEqual(cleanRes, {kind: 'none'});
});
