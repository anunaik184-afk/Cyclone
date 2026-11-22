import React, {useEffect, useState} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  Phone,
  ShieldAlert,
  User,
} from 'lucide-react';
import {
  isSupabaseConfigured,
  supabase,
  SUPABASE_URL,
  type UserProfile,
} from '../lib/supabase';

interface AuthGateProps {
  onAuthenticated: (userId: string, profile: UserProfile) => void;
  onOpenPublicTab: (tab: 'map' | 'weather' | 'services' | 'guidelines') => void;
}

type AuthStep = 'login' | 'register' | 'otp';

export function AuthGate({onAuthenticated, onOpenPublicTab}: AuthGateProps) {
  const [step, setStep] = useState<AuthStep>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!supabase) {
      setErrorMsg(
        'Supabase publishable key (VITE_SUPABASE_ANON_KEY) is not configured in environment secrets.',
      );
      return;
    }

    if (!email.trim() || !password) {
      setErrorMsg('Enter both email address and password.');
      return;
    }

    setLoading(true);
    try {
      const {data, error} = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      if (!data.user || !data.session) {
        setErrorMsg('Authentication did not return an active session.');
        return;
      }

      if (!data.user.email_confirmed_at) {
        await supabase.auth.signOut();
        setErrorMsg(
          'Your email is not verified yet. Please verify the OTP sent to your email address.',
        );
        setStep('otp');
        return;
      }

      const {data: profileData} = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      const resolvedProfile: UserProfile = profileData ?? {
        id: data.user.id,
        full_name:
          (data.user.user_metadata?.full_name as string) ||
          data.user.email ||
          'User',
        email: data.user.email || email.trim(),
        phone: (data.user.user_metadata?.phone as string) || '',
      };

      onAuthenticated(data.user.id, resolvedProfile);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

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
    try {
      const {data, error} = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            phone: cleanPhone,
          },
        },
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setErrorMsg('An account with this email already exists. Please sign in.');
        return;
      }

      setInfoMsg(
        `A real verification OTP has been dispatched via Supabase SMTP to ${cleanEmail}.`,
      );
      setCooldown(60);
      setStep('otp');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Registration failed.');
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

    const token = otpCode.trim();
    const cleanEmail = email.trim();
    if (!cleanEmail || token.length < 6) {
      setErrorMsg('Enter the complete verification OTP sent to your email.');
      return;
    }

    setLoading(true);
    try {
      const {data, error} = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token,
        type: 'signup',
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      if (!data.user || !data.session || !data.user.email_confirmed_at) {
        setErrorMsg('OTP verification did not confirm your account. Check the code and retry.');
        return;
      }

      const resolvedName =
        fullName.trim() ||
        (data.user.user_metadata?.full_name as string) ||
        cleanEmail;
      const resolvedPhone =
        phone.trim() || (data.user.user_metadata?.phone as string) || '';

      const {data: profileRow, error: profileErr} = await supabase
        .from('profiles')
        .upsert(
          {
            id: data.user.id,
            full_name: resolvedName,
            email: cleanEmail,
            phone: resolvedPhone,
            updated_at: new Date().toISOString(),
          },
          {onConflict: 'id'},
        )
        .select()
        .single();

      if (profileErr) {
        setErrorMsg(`Verified, but profile save failed: ${profileErr.message}`);
        return;
      }

      onAuthenticated(data.user.id, profileRow as UserProfile);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!supabase || cooldown > 0) return;
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);

    try {
      const {error} = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });
      if (error) {
        setErrorMsg(error.message);
        return;
      }
      setInfoMsg(`Verification OTP resent to ${email.trim()}.`);
      setCooldown(60);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not resend OTP.');
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
              Sign in with a verified CycloneSafe account to trigger cloud-logged SOS
              alerts, submit geo-tagged disaster reports with photo evidence, and manage
              your family safety directory.
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
                AI Studio Secrets (using your publishable key from{' '}
                <span className="font-mono text-xs">local.properties</span>) to enable
                live registration, real email OTP verification, SOS history, disaster
                reports, and family safety persistence.
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
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          {step === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
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
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Password
                </label>
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
                disabled={loading}
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {loading ? 'Signing in...' : 'Sign In to Dashboard'}
              </button>
            </form>
          )}

          {step === 'register' && (
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
                disabled={loading}
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {loading ? 'Sending Verification OTP...' : 'Register & Send Email OTP'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Registration Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email used during registration"
                  className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  6-Digit Email Verification OTP
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Enter OTP from your inbox"
                    className="w-full h-10 pl-10 pr-3 text-sm font-mono tracking-widest border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="submit"
                  disabled={loading}
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
                  {cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend OTP'}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
