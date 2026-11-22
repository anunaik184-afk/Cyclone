import React, {useEffect, useState} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  Phone,
  User,
} from 'lucide-react';
import {
  extractRateLimitSeconds,
  formatGoogleOAuthError,
  formatSupabaseAuthError,
  getAuthRedirectUrl,
} from '../lib/authConfirmation';
import {
  isSupabaseConfigured,
  supabase,
  SUPABASE_URL,
  type UserProfile,
} from '../lib/supabase';

interface AuthGateProps {
  initialCallbackError?: {
    message: string;
    source: 'oauth' | 'email';
  } | null;
  onClearCallbackError?: () => void;
  onAuthenticated: (userId: string, profile: UserProfile) => void;
  onOpenPublicTab: (tab: 'map' | 'weather' | 'services' | 'guidelines') => void;
}

type AuthStep = 'login' | 'register' | 'otp';
type LoginMethod = 'otp' | 'password';
type OtpPurpose = 'signup' | 'email';

const OTP_VALIDITY_SECONDS = 120;

function formatCountdown(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function GoogleLogoSvg() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

export function AuthGate({
  initialCallbackError,
  onClearCallbackError,
  onAuthenticated,
  onOpenPublicTab,
}: AuthGateProps) {
  const [step, setStep] = useState<AuthStep>(
    initialCallbackError?.source === 'email' ? 'otp' : 'login',
  );
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('otp');
  const [otpPurpose, setOtpPurpose] = useState<OtpPurpose>('signup');
  const [needsEmailConfirmHint, setNeedsEmailConfirmHint] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [otpExpiresIn, setOtpExpiresIn] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    initialCallbackError?.message ?? null,
  );
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialCallbackError) {
      setErrorMsg(initialCallbackError.message);
      if (initialCallbackError.source === 'email') {
        setOtpPurpose('signup');
        setStep('otp');
      } else {
        setStep('login');
      }
    }
  }, [initialCallbackError]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (otpExpiresIn === null || otpExpiresIn <= 0) return;
    const timer = window.setInterval(() => {
      setOtpExpiresIn((prev) => {
        if (prev === null) return null;
        return prev <= 1 ? 0 : prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [otpExpiresIn]);

  const resolveExistingOrCreateProfile = async (
    userId: string,
    userEmail: string,
    metadata?: Record<string, unknown>,
  ): Promise<{profile: UserProfile | null; error: string | null}> => {
    if (!supabase) {
      return {profile: null, error: 'Supabase client is not configured.'};
    }

    const {data: existingProfile, error: fetchError} = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (fetchError) {
      return {
        profile: null,
        error: `Verified, but could not load existing profile: ${fetchError.message}`,
      };
    }

    if (existingProfile) {
      return {profile: existingProfile as UserProfile, error: null};
    }

    const resolvedName =
      fullName.trim() ||
      (typeof metadata?.full_name === 'string' ? metadata.full_name.trim() : '') ||
      userEmail;
    const resolvedPhone =
      phone.trim() ||
      (typeof metadata?.phone === 'string' ? metadata.phone.trim() : '') ||
      '';

    const {data: insertedProfile, error: insertError} = await supabase
      .from('profiles')
      .insert({
        id: userId,
        full_name: resolvedName,
        email: userEmail,
        phone: resolvedPhone,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      return {
        profile: null,
        error: `Verified, but profile creation failed: ${insertError.message}`,
      };
    }

    return {profile: insertedProfile as UserProfile, error: null};
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setNeedsEmailConfirmHint(false);

    if (!supabase) {
      setErrorMsg(
        'Supabase publishable key (VITE_SUPABASE_ANON_KEY) is not configured in environment secrets.',
      );
      return;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMsg('Enter both email address and password.');
      return;
    }

    setLoading(true);
    try {
      const {data, error} = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        setErrorMsg(formatSupabaseAuthError(error));
        if (/email\s+not\s+confirmed/i.test(error.message)) {
          setNeedsEmailConfirmHint(true);
        }
        return;
      }

      if (!data.user || !data.session) {
        setErrorMsg('Authentication did not return an active session.');
        return;
      }

      if (!data.user.email_confirmed_at) {
        await supabase.auth.signOut();
        setOtpPurpose('signup');
        setOtpCode('');
        setErrorMsg(
          'Your email is not confirmed yet. Please check your inbox and spam folder, enter the 6-digit code, or resend the confirmation email below.',
        );
        setStep('otp');
        return;
      }

      const {profile: resolvedProfile, error: profErr} =
        await resolveExistingOrCreateProfile(
          data.user.id,
          data.user.email || cleanEmail,
          data.user.user_metadata,
        );

      if (profErr || !resolvedProfile) {
        setErrorMsg(profErr || 'Failed to retrieve your user profile.');
        return;
      }

      onAuthenticated(data.user.id, resolvedProfile);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setNeedsEmailConfirmHint(false);
    onClearCallbackError?.();

    if (!supabase) {
      setErrorMsg(
        'Supabase publishable key (VITE_SUPABASE_ANON_KEY) is not configured in environment secrets.',
      );
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setErrorMsg(
        'Network connection problem. Check your internet connection and try Google Sign-In again.',
      );
      return;
    }

    setGoogleLoading(true);
    try {
      const redirectUrl = getAuthRedirectUrl();
      const {data, error} = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          ...(redirectUrl ? {redirectTo: redirectUrl} : {}),
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        setErrorMsg(formatGoogleOAuthError(error));
        setGoogleLoading(false);
        return;
      }

      if (!data?.url) {
        setErrorMsg(
          'Invalid OAuth configuration. Supabase did not return a Google sign-in URL.',
        );
        setGoogleLoading(false);
      }
    } catch (err) {
      setErrorMsg(
        formatGoogleOAuthError({
          message: err instanceof Error ? err.message : 'Google authentication failed.',
        }),
      );
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    if (!supabase) {
      setErrorMsg(
        'Supabase publishable key (VITE_SUPABASE_ANON_KEY) is not configured in environment secrets.',
      );
      return;
    }
    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Enter your registered email address first to send a password reset link.');
      return;
    }
    setLoading(true);
    try {
      const redirectUrl = getAuthRedirectUrl();
      const {error} = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        ...(redirectUrl ? {redirectTo: redirectUrl} : {}),
      });
      if (error) {
        setErrorMsg(formatSupabaseAuthError(error));
        return;
      }
      setInfoMsg(
        `Password reset link sent to ${cleanEmail}. Please check your inbox and spam folder.`,
      );
    } catch (err) {
      setErrorMsg(
        formatSupabaseAuthError({
          message: err instanceof Error ? err.message : 'Unable to send password reset email.',
        }),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSendLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setNeedsEmailConfirmHint(false);

    if (!supabase) {
      setErrorMsg(
        'Supabase publishable key (VITE_SUPABASE_ANON_KEY) is not configured in environment secrets.',
      );
      return;
    }

    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Enter a valid registered email address.');
      return;
    }

    if (cooldown > 0) {
      setErrorMsg(`Please wait ${cooldown}s before requesting another OTP.`);
      return;
    }

    setLoading(true);
    try {
      const redirectUrl = getAuthRedirectUrl();
      const {error} = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: false,
          ...(redirectUrl ? {emailRedirectTo: redirectUrl} : {}),
        },
      });

      if (error) {
        const waitSecs = extractRateLimitSeconds(error.message, error.status);
        if (waitSecs > 0) {
          setCooldown(waitSecs);
        }
        setErrorMsg(formatSupabaseAuthError(error));
        return;
      }

      setOtpPurpose('email');
      setOtpCode('');
      setCooldown(60);
      setOtpExpiresIn(OTP_VALIDITY_SECONDS);
      setInfoMsg(
        `Confirmation email sent to ${cleanEmail}. Please check your inbox and spam folder for the 6-digit login OTP (valid for 2 minutes).`,
      );
      setStep('otp');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Email sending failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setNeedsEmailConfirmHint(false);

    if (!supabase) {
      setErrorMsg(
        'Supabase publishable key (VITE_SUPABASE_ANON_KEY) is not configured in environment secrets.',
      );
      return;
    }

    const cleanName = fullName.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();

    if (!cleanName || !cleanEmail || !cleanPhone) {
      setErrorMsg('Full name, email address, and phone number are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    onClearCallbackError?.();
    try {
      const redirectUrl = getAuthRedirectUrl();
      const {data, error} = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          ...(redirectUrl ? {emailRedirectTo: redirectUrl} : {}),
          data: {
            full_name: cleanName,
            phone: cleanPhone,
          },
        },
      });

      if (error) {
        const waitSecs = extractRateLimitSeconds(error.message, error.status);
        if (waitSecs > 0) {
          setCooldown(waitSecs);
        }
        setErrorMsg(formatSupabaseAuthError(error));
        return;
      }

      if (
        data.user &&
        Array.isArray(data.user.identities) &&
        data.user.identities.length === 0
      ) {
        setNeedsEmailConfirmHint(true);
        setErrorMsg(
          'An account with this email already exists. Use Sign In, or resend your confirmation email if you have not verified yet.',
        );
        return;
      }

      if (data.session) {
        await supabase.auth.signOut();
        setErrorMsg(
          'Email confirmation must remain enabled in Supabase Auth. Keep "Confirm email" enabled in Supabase Dashboard → Authentication → Providers → Email.',
        );
        return;
      }

      setOtpPurpose('signup');
      setOtpCode('');
      setCooldown(60);
      setOtpExpiresIn(OTP_VALIDITY_SECONDS);
      setInfoMsg(
        `Registration successful. Confirmation email sent to ${cleanEmail}. Please check your inbox and spam folder (6-digit code valid for 2 minutes).`,
      );
      setStep('otp');
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? formatSupabaseAuthError({message: err.message})
          : 'Registration failed.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!supabase) {
      setErrorMsg('Supabase client is not configured.');
      return;
    }

    const token = otpCode.replace(/\s+/g, '');
    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Enter the valid email address used for the OTP.');
      return;
    }
    if (!/^\d{6,8}$/.test(token)) {
      setErrorMsg('Enter the 6-digit numeric OTP sent to your email.');
      return;
    }
    if (otpExpiresIn === 0) {
      setErrorMsg('Your 2-minute OTP has expired. Click Resend OTP to request a new code.');
      return;
    }

    setLoading(true);
    try {
      const {data, error} = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token,
        type: otpPurpose,
      });

      if (error) {
        setErrorMsg(formatSupabaseAuthError(error));
        return;
      }

      if (!data.user || !data.session || !data.user.email_confirmed_at) {
        if (data.session) {
          await supabase.auth.signOut();
        }
        setErrorMsg(
          'Email verification did not establish a confirmed session. Check the code or confirmation link and retry.',
        );
        return;
      }

      const {profile: resolvedProfile, error: profErr} =
        await resolveExistingOrCreateProfile(
          data.user.id,
          data.user.email || cleanEmail,
          data.user.user_metadata,
        );

      if (profErr || !resolvedProfile) {
        setErrorMsg(profErr || 'Verification succeeded, but profile load failed.');
        return;
      }

      onAuthenticated(data.user.id, resolvedProfile);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!supabase || cooldown > 0) return;
    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Enter a valid email address before requesting a confirmation email.');
      return;
    }

    setErrorMsg(null);
    setInfoMsg(null);
    onClearCallbackError?.();
    setLoading(true);

    try {
      const redirectUrl = getAuthRedirectUrl();
      const {error} =
        otpPurpose === 'signup'
          ? await supabase.auth.resend({
              type: 'signup',
              email: cleanEmail,
              options: {
                ...(redirectUrl ? {emailRedirectTo: redirectUrl} : {}),
              },
            })
          : await supabase.auth.signInWithOtp({
              email: cleanEmail,
              options: {
                shouldCreateUser: false,
                ...(redirectUrl ? {emailRedirectTo: redirectUrl} : {}),
              },
            });

      if (error) {
        const waitSecs = extractRateLimitSeconds(error.message, error.status);
        if (waitSecs > 0) {
          setCooldown(waitSecs);
        }
        setErrorMsg(formatSupabaseAuthError(error));
        return;
      }

      setCooldown(60);
      setOtpExpiresIn(OTP_VALIDITY_SECONDS);
      setInfoMsg(
        `Confirmation email sent to ${cleanEmail}. Please check your inbox and spam folder (6-digit ${
          otpPurpose === 'signup' ? 'verification' : 'login'
        } code valid for 2 minutes).`,
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? formatSupabaseAuthError({message: err.message})
          : 'Email sending failed.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-8">
        <div className="flex items-center gap-3 shrink-0">
          <img
            src="/assets/aistudio/WhatsApp_Image_2026-11-13_at_9.51.49_PM-removebg-preview_1b7152e3.png"
            alt="CycloneSafe Logo"
            className="w-10 h-10 object-contain shrink-0"
          />
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            CycloneSafe
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => onOpenPublicTab('map')}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Live Map
          </button>
          <button
            type="button"
            onClick={() => onOpenPublicTab('weather')}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Weather
          </button>
          <button
            type="button"
            onClick={() => onOpenPublicTab('services')}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            India Helplines
          </button>
          <button
            type="button"
            onClick={() => onOpenPublicTab('guidelines')}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Safety Guidelines
          </button>
        </nav>

        <a
          href="tel:112"
          className="px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap shrink-0"
        >
          Dial 112 Emergency
        </a>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section className="lg:col-span-6 space-y-6">
          <div>
            <img
              src="/assets/aistudio/WhatsApp_Image_2026-11-13_at_9.51.49_PM-removebg-preview_1b7152e3.png"
              alt="CycloneSafe — Be Aware, Be Prepared, Be Safe"
              className="w-28 h-28 object-contain mb-4"
            />
            <p className="text-xs font-medium text-sky-700 mb-2">
              Real-Time Disaster Safety · India Emergency Network
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight">
              Verified Emergency Coordination, Live Weather &amp; Shelter Discovery
            </h1>
            <p className="mt-3 text-slate-600 text-base leading-relaxed">
              Sign in instantly with your Google account or a CycloneSafe email account
              to trigger cloud-logged SOS alerts, submit geo-tagged disaster reports, and
              manage your family safety directory.
            </p>
          </div>

          {!isSupabaseConfigured && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-950 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Supabase Publishable Key Required for Cloud Auth &amp; Database</span>
              </div>
              <p className="text-amber-900 leading-relaxed">
                Project URL is targeted at{' '}
                <span className="font-mono text-xs">{SUPABASE_URL}</span>. Set{' '}
                <span className="font-mono text-xs">VITE_SUPABASE_ANON_KEY</span> in
                AI Studio Secrets to enable live registration, real Supabase SMTP 6-digit
                email OTP verification, passwordless OTP login, SOS history, and family
                safety persistence.
              </p>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Immediate Public Tools (No Login Required)
            </h2>
            <p className="text-xs text-slate-600">
              Protected features (SOS logging, Disaster Reporting, Family Safety) stay
              locked until email OTP verification completes. Public situational tools
              remain accessible below:
            </p>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => onOpenPublicTab('map')}
                className="px-3 py-2.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg text-left transition-colors cursor-pointer"
              >
                Open Live Emergency Map
              </button>
              <button
                type="button"
                onClick={() => onOpenPublicTab('weather')}
                className="px-3 py-2.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg text-left transition-colors cursor-pointer"
              >
                Live Open-Meteo Weather
              </button>
              <button
                type="button"
                onClick={() => onOpenPublicTab('services')}
                className="px-3 py-2.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg text-left transition-colors cursor-pointer"
              >
                Helplines &amp; Protocols
              </button>
              <button
                type="button"
                onClick={() => onOpenPublicTab('guidelines')}
                className="px-3 py-2.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg text-left transition-colors cursor-pointer"
              >
                Safety Guidelines
              </button>
            </div>
          </div>
        </section>

        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg mb-6">
            <button
              type="button"
              onClick={() => {
                setStep('login');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                step === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('register');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                step === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('otp');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                step === 'otp'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Verify Email OTP
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
              {needsEmailConfirmHint && (
                <button
                  type="button"
                  onClick={() => {
                    setOtpPurpose('signup');
                    setOtpCode('');
                    setErrorMsg(null);
                    setInfoMsg(null);
                    setStep('otp');
                  }}
                  className="ml-6 text-xs font-semibold underline text-red-900 hover:text-red-950 cursor-pointer"
                >
                  Open Signup OTP Verification &amp; Resend Code
                </button>
              )}
            </div>
          )}

          {infoMsg && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          {step === 'login' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading || googleLoading}
                className="w-full h-11 px-4 bg-white hover:bg-sky-50/70 disabled:opacity-50 border border-slate-300 hover:border-sky-400 text-slate-900 text-sm font-semibold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <GoogleLogoSvg />
                <span>
                  {googleLoading ? 'Redirecting to Google...' : 'Continue with Google'}
                </span>
              </button>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-slate-200" />
                <span className="shrink mx-3 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  or sign in with email
                </span>
                <div className="flex-grow border-t border-slate-200" />
              </div>

              <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('otp');
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    loginMethod === 'otp'
                      ? 'bg-sky-50 text-sky-900 border border-sky-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Passwordless Email OTP
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('password');
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    loginMethod === 'password'
                      ? 'bg-sky-50 text-sky-900 border border-sky-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Email &amp; Password
                </button>
              </div>

              {loginMethod === 'otp' ? (
                <form onSubmit={handleSendLoginOtp} className="space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Already registered? Enter your email address to receive a 6-digit
                    one-time sign-in code via Supabase SMTP.
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Registered Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full h-10 pl-10 pr-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || googleLoading || cooldown > 0}
                    className="w-full h-11 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    {loading
                      ? 'Sending Login OTP...'
                      : cooldown > 0
                        ? `Wait ${cooldown}s before requesting OTP`
                        : 'Send 6-Digit Login OTP'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full h-10 pl-10 pr-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-slate-700">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={loading || googleLoading}
                        className="text-xs font-medium text-sky-700 hover:text-sky-900 underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full h-10 pl-10 pr-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || googleLoading}
                    className="w-full h-11 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    {loading ? 'Signing in...' : 'Sign In to Dashboard'}
                  </button>
                </form>
              )}
            </div>
          )}

          {step === 'register' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading || googleLoading}
                className="w-full h-11 px-4 bg-white hover:bg-sky-50/70 disabled:opacity-50 border border-slate-300 hover:border-sky-400 text-slate-900 text-sm font-semibold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <GoogleLogoSvg />
                <span>
                  {googleLoading ? 'Redirecting to Google...' : 'Continue with Google'}
                </span>
              </button>

              <div className="relative flex items-center py-0.5">
                <div className="flex-grow border-t border-slate-200" />
                <span className="shrink mx-3 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  or create account with email
                </span>
                <div className="flex-grow border-t border-slate-200" />
              </div>

              <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full h-10 pl-10 pr-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@domain.com"
                      className="w-full h-10 pl-10 pr-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full h-10 pl-10 pr-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Password (8+ chars)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {loading ? 'Sending Verification OTP...' : 'Register & Send Email OTP'}
              </button>
            </form>
            </div>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <span className="block text-xs font-medium text-slate-700 mb-1.5">
                  OTP Verification Purpose
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpPurpose('signup');
                      setErrorMsg(null);
                    }}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                      otpPurpose === 'signup'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    New Registration
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpPurpose('email');
                      setErrorMsg(null);
                    }}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                      otpPurpose === 'email'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Existing User Login
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address receiving the OTP"
                  className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="block text-xs font-medium text-slate-700">
                    6-Digit Email OTP
                  </label>
                  {otpExpiresIn !== null && (
                    <span
                      className={`text-xs font-mono font-semibold tabular-nums ${
                        otpExpiresIn === 0
                          ? 'text-red-700'
                          : otpExpiresIn <= 30
                            ? 'text-amber-700'
                            : 'text-slate-600'
                      }`}
                    >
                      {otpExpiresIn === 0
                        ? 'Expired (2:00 limit)'
                        : `Expires in ${formatCountdown(otpExpiresIn)}`}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    maxLength={8}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Enter 6-digit code from your inbox"
                    className="w-full h-10 pl-10 pr-3 text-sm font-mono tracking-widest border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                {otpExpiresIn === 0 && (
                  <p className="mt-1.5 text-xs text-red-700">
                    This OTP expired after 2 minutes. Click Resend OTP to receive a new
                    code.
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="submit"
                  disabled={loading || otpExpiresIn === 0}
                  className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  {loading ? 'Verifying...' : 'Verify OTP & Enter Dashboard'}
                </button>
                <button
                  type="button"
                  disabled={loading || cooldown > 0 || !email.trim()}
                  onClick={handleResendOtp}
                  className="h-11 px-4 border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  {cooldown > 0
                    ? `Resend (${cooldown}s)`
                    : otpPurpose === 'signup'
                      ? 'Resend Confirmation'
                      : 'Resend OTP'}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
