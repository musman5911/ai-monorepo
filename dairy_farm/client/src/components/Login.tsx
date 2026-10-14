import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from '../muf-motion';
import {
  Eye, EyeOff, AlertCircle, ArrowLeft,
  Mail, Check, LogIn,
} from 'lucide-react';
import { api, saveAuth } from '../api';
import MufLoginLang from '../muf-login-lang';
import { MufLoginBrand, MufLoginPanel, MufLoginScreen } from '../muf-login';
import type { Lang } from '../i18n';
import { L } from '../i18n';

type View = 'login' | 'forgotEmail' | 'forgotCode';

const MIN_PASSWORD_LENGTH = 8;

export default function Login({
  onLogin,
  sessionNotice,
  lang,
  onToggleLang,
}: {
  onLogin: (t: string, r: string, u: string) => void;
  sessionNotice?: string | null;
  lang?: Lang;
  onToggleLang?: () => void;
}) {
  const [isSetup, setIsSetup] = useState<boolean | null>(null);
  const [view, setView] = useState<View>('login');
  const [mailConfigured, setMailConfigured] = useState(false);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');

  const [error, setError] = useState('');
  const [info, setInfo] = useState(sessionNotice || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionNotice) setInfo(sessionNotice);
  }, [sessionNotice]);

  useEffect(() => {
    api.checkSetup()
      .then((res) => setIsSetup(res.setupDone))
      .catch((err) => {
        console.error('Failed to check setup:', err);
        setIsSetup(false);
      });

    api.getMailStatus()
      .then((res) => setMailConfigured(Boolean(res.configured)))
      .catch(() => setMailConfigured(false));
  }, []);

  const clearMessages = () => {
    setError('');
    setInfo('');
  };

  const goTo = (nextView: View) => {
    clearMessages();
    setView(nextView);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearMessages();
    if (isSetup === false && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setLoading(true);

    try {
      const res = isSetup === false
        ? await api.setup(username, password, email || undefined)
        : await api.login(username, password);

      if (res?.token) {
        saveAuth(res.token, res.role, res.username);
        onLogin(res.token, res.role, res.username);
      } else {
        setError('Login failed. Server returned an invalid response.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    clearMessages();
    if (!resetEmail.trim()) {
      setError('Enter your admin email.');
      return;
    }
    setLoading(true);
    try {
      await api.forgotPassword(resetEmail.trim().toLowerCase());
      setInfo('If an active admin account exists with that email, a 6-digit reset code has been sent.');
      setResetCode('');
      setResetPassword('');
      setView('forgotCode');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    clearMessages();
    const cleanCode = resetCode.replace(/\D/g, '');
    if (cleanCode.length !== 6 || !resetPassword) {
      setError('Enter the 6-digit code and a new password.');
      return;
    }
    if (resetPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword(resetEmail.trim().toLowerCase(), cleanCode, resetPassword);
      setInfo('Password reset successfully. You can now sign in.');
      setPassword('');
      setUsername(resetEmail.trim().toLowerCase());
      setResetCode('');
      setResetPassword('');
      setView('login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  if (isSetup === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f6] dark:bg-[#070b13]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="animate-spin rounded-full h-8 w-8 border-b-2 border-farm-600" />
      </div>
    );
  }

  const isFirstSetup = isSetup === false;

  return (
    <MufLoginScreen>
      {lang && onToggleLang && <MufLoginLang lang={lang} onToggle={onToggleLang} />}
      {error && (
        <div className="mb-6 p-4 rounded-xl shadow-lg border text-sm max-w-sm w-full bg-red-50 border-red-300 text-red-800 dark:bg-red-950/80 dark:border-red-500 dark:text-red-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-[18px] h-[18px]" />
            <span>{error}</span>
          </div>
        </div>
      )}
      {info && !error && (
        <div className="mb-6 p-4 rounded-xl shadow-lg border text-sm max-w-sm w-full bg-farm-50 border-farm-300 text-farm-800 dark:bg-farm-950/80 dark:border-farm-500 dark:text-farm-200">
          <div className="flex items-center gap-3">
            <Check className="w-[18px] h-[18px]" />
            <span>{info}</span>
          </div>
        </div>
      )}

      <MufLoginPanel className="pulse-border-hover">
        <MufLoginBrand farmName="Usman Dairy Farm" logoSrc="/dairy-farm-logo-round-512.png" logoAlt="Usman Dairy Farm logo" subtitle={isFirstSetup ? L('First-time setup') : L('Sign in to continue')} />

        <AnimatePresence mode="wait" initial={false}>
          {view === 'login' && (
            <motion.form
              key="login"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
              onSubmit={handleSubmit}
            >
              <div>
                <label className="muf-label">
                  {isFirstSetup ? 'Username' : 'Username or Email'}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder={isFirstSetup ? 'Enter your username' : 'Username or email'}
                  autoComplete="username"
                  className="muf-field muf-field-lg"
                />
              </div>

              {isFirstSetup && (
                <div>
                  <label className="muf-label">
                    {L('Admin email for password reset')}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="admin@farm.com"
                    autoComplete="email"
                    className="muf-field muf-field-lg"
                  />
                </div>
              )}

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{L('Password')}</label>
                  {!isFirstSetup && (
                    <button
                      type="button"
                      onClick={() => goTo('forgotEmail')}
                      title={mailConfigured ? 'Reset password by email' : 'SMTP is not configured yet'}
                      className="text-[11px] text-farm-600 hover:text-farm-500 font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    autoComplete={isFirstSetup ? 'new-password' : 'current-password'}
                    className="w-full bg-slate-100 border border-slate-200 text-slate-900 dark:bg-[#1e293b] dark:border-slate-700 dark:text-white rounded-lg pl-4 pr-11 py-3 text-sm focus:outline-none focus:border-farm-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-farm-600 hover:bg-farm-700 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-farm-500/10 flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-60"
              >
                {loading ? 'Processing...' : <><LogIn className="w-[18px] h-[18px]" />{isFirstSetup ? L('Complete Setup') : L('Sign in')}</>}
              </button>
            </motion.form>
          )}

          {view === 'forgotEmail' && (
            <motion.form
              key="forgotEmail"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
              onSubmit={handleForgotRequest}
            >
              <BackButton onClick={() => goTo('login')} />
              {!mailConfigured && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs p-3">
                  SMTP email is not configured yet. Add SMTP settings in backend/.env to send reset codes.
                </div>
              )}
              <div>
                <label className="muf-label">{L('Admin email')}</label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  placeholder="admin@farm.com"
                  className="muf-field muf-field-lg"
                />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-farm-600 hover:bg-farm-700 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-farm-500/10 flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-60">
                {loading ? 'Sending...' : <><Mail className="w-[18px] h-[18px]" /> {L('Send reset code')}</>}
              </button>
            </motion.form>
          )}

          {view === 'forgotCode' && (
            <motion.form
              key="forgotCode"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
              onSubmit={handleResetPassword}
            >
              <BackButton onClick={() => goTo('forgotEmail')} />
              <div>
                <label className="muf-label">6-digit code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                  value={resetCode}
                  onChange={(event) => setResetCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="w-full bg-slate-100 border border-slate-200 text-slate-900 dark:bg-[#1e293b] dark:border-slate-700 dark:text-white rounded-lg px-4 py-3 text-sm text-center tracking-[0.45em] font-mono text-lg focus:outline-none focus:border-farm-500 transition-colors"
                />
              </div>
              <div>
                <label className="muf-label">{L('New password')}</label>
                <input
                  type="password"
                  required
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  placeholder={L('New password')}
                  autoComplete="new-password"
                  className="muf-field muf-field-lg"
                />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 bg-farm-600 hover:bg-farm-700 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-farm-500/10 flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-60">
                {loading ? 'Resetting...' : <><Check className="w-[18px] h-[18px]" /> {L('Reset password')}</>}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </MufLoginPanel>
    </MufLoginScreen>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-farm-600 dark:text-slate-400 dark:hover:text-farm-300">
      <ArrowLeft className="w-4 h-4" /> Back
    </button>
  );
}
