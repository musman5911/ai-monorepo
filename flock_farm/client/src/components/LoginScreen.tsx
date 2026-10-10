import React, { useEffect, useRef, useState } from 'react';
import { mufL } from '../muf-urdu';
import { LogIn, AlertCircle, ArrowLeft, Check, Mail, UserPlus, Eye, EyeOff } from 'lucide-react';
import { AnimatePresence, motion } from '../muf-motion';
import { Lang } from '../types';
import {
  login, forgotPassword, resetPassword,
  signupRequestCode, signupVerify, getCanSignup, getMailStatus,
} from '../api';

interface Props {
  lang: Lang;
  onLoginSuccess: () => void;
}

type View = 'login' | 'forgotEmail' | 'forgotCode' | 'signup' | 'signupCode';

export default function LoginScreen({ lang, onLoginSuccess }: Props) {
  const L = (en: string, urOrVars?: string | Record<string, string | number | null>) => mufL(lang, en, urOrVars);

  const [view, setView] = useState<View>('login');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Login
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [showPw, setShowPw] = useState(false);

  // Forgot password
  const [fpEmail, setFpEmail] = useState('');
  const [fpCode, setFpCode] = useState('');
  const [fpNewPw, setFpNewPw] = useState('');

  // Signup
  const [signupAllowed, setSignupAllowed] = useState(false);
  const [mailConfigured, setMailConfigured] = useState(false);
  const [suUsername, setSuUsername] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPw, setSuPw] = useState('');
  const [suPw2, setSuPw2] = useState('');
  const [suName, setSuName] = useState('');
  const [suCode, setSuCode] = useState('');

  // Code input refs (auto-advance between digits)
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const codeValue = view === 'forgotCode' ? fpCode : suCode;
  const codeSetter = view === 'forgotCode' ? setFpCode : setSuCode;
  const CODE_LEN = 6;

  useEffect(() => {
    getCanSignup().then(({ allowed, mailConfigured: mc }) => {
      setSignupAllowed(allowed);
      setMailConfigured(mc);
    });
    getMailStatus().then(({ configured }) => setMailConfigured(configured));
  }, []);

  const resetAll = () => {
    setErr(null); setInfo(null); setBusy(false);
    setFpEmail(''); setFpCode(''); setFpNewPw('');
    setSuUsername(''); setSuEmail(''); setSuPw(''); setSuPw2(''); setSuName(''); setSuCode('');
    setLoginId(''); setLoginPw(''); setShowPw(false);
  };

  const goTo = (v: View) => {
    setErr(null); setInfo(null);
    setView(v);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!loginId.trim() || !loginPw) {
      setErr(L('Enter username and password'));
      return;
    }
    setBusy(true);
    try {
      await login(loginId.trim(), loginPw);
      resetAll();
      onLoginSuccess();
    } catch (err) {
      const m = err instanceof Error ? err.message : 'Login failed';
      setErr(m === 'Invalid username or password'
        ? L('Invalid username or password')
        : m);
    } finally {
      setBusy(false);
    }
  };

  const handleFpRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setInfo(null);
    if (!fpEmail.trim()) { setErr(L('Enter your email')); return; }
    setBusy(true);
    try {
      await forgotPassword(fpEmail.trim().toLowerCase());
      setInfo(L('If an admin account exists with that email, a 6-digit code has been sent.'));
      setBusy(false);
      goTo('forgotCode');
    } catch (err) {
      setBusy(false);
      setErr(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleFpReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (fpCode.length !== CODE_LEN || !fpNewPw) { setErr(L('Enter code and new password')); return; }
    if (fpNewPw.length < 8) { setErr(L('New password must be at least 8 characters.')); return; }
    setBusy(true);
    try {
      await resetPassword(fpEmail.trim().toLowerCase(), fpCode, fpNewPw);
      setInfo(L('Password reset successfully. You can now log in.'));
      setBusy(false);
      setFpCode(''); setFpNewPw('');
      setLoginId(fpEmail);
      goTo('login');
    } catch (err) {
      setBusy(false);
      setErr(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleSignupReq = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setInfo(null);
    if (!suUsername.trim() || !suEmail.trim() || !suPw) {
      setErr(L('Fill all required fields')); return;
    }
    if (suUsername.trim().length < 3) { setErr(L('Username must be at least 3 characters')); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(suEmail.trim())) { setErr(L('Invalid email format')); return; }
    if (suPw.length < 8) { setErr(L('Password must be at least 8 characters')); return; }
    if (suPw !== suPw2) { setErr(L('Passwords do not match')); return; }
    setBusy(true);
    try {
      await signupRequestCode({
        username: suUsername.trim(),
        email: suEmail.trim().toLowerCase(),
        password: suPw,
        displayName: suName.trim() || undefined,
      });
      setInfo(L('A verification code has been sent to your email.'));
      setBusy(false);
      goTo('signupCode');
    } catch (err) {
      setBusy(false);
      setErr(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleSignupVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (suCode.length !== CODE_LEN) { setErr(L('Enter the 6-digit code')); return; }
    setBusy(true);
    try {
      await signupVerify(suCode);
      resetAll();
      onLoginSuccess();
    } catch (err) {
      setBusy(false);
      setErr(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleCodeChange = (idx: number, val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 1);
    const newCode = codeValue.split('');
    newCode[idx] = digits;
    const full = newCode.join('');
    codeSetter(full);
    if (digits && idx < CODE_LEN - 1) {
      codeRefs.current[idx + 1]?.focus();
    }
  };

  const handleCodeKey = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codeValue[idx] && idx > 0) {
      codeRefs.current[idx - 1]?.focus();
    }
  };

  const isRtl = lang === 'ur';

  return (
    <div className={`min-h-screen bg-[#faf9f6] dark:bg-[#070b13] flex flex-col justify-center items-center px-4 transition-colors ${isRtl ? 'rtl' : 'ltr'}`}>
      <div className="bg-[#fcfbf9] dark:bg-[#0f172a] border border-[#e2dfdb] dark:border-slate-800 p-6 md:p-8 rounded-2xl w-full max-w-md my-8 shadow-2xl flex flex-col transition-all pulse-border-hover">
        {view === 'login' && (
          <>
            <div className="flex justify-center mb-4">
              <img
                src="/logo.png"
                alt="Usman Flock Farm"
                className="w-20 h-20 rounded-full object-cover border-2 border-slate-200 dark:border-slate-800 shadow-md shrink-0 animate-bounce-soft"
              />
            </div>
            <h2 className="font-sans text-center text-slate-800 dark:text-farm-400 text-2xl font-extrabold tracking-tight mb-1">
              {L('Usman Flock Farm')}
            </h2>
            <p className="text-center text-slate-500 dark:text-slate-400 text-xs mb-8 uppercase tracking-widest font-semibold">
              {L('Secure Sign-In Interface')}
            </p>
          </>
        )}
        <AnimatePresence mode="wait">
          {view === 'login' && (
            <motion.form
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
              onSubmit={handleLogin}
              className="space-y-4"
            >
              {err && <AlertBox type="err" text={err} />}

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                {L('Username or email')}
              </label>
              <input
                type="text"
                required
                autoFocus
                autoComplete="username"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="admin"
                className="w-full bg-slate-100 border border-slate-200 text-slate-900 dark:bg-[#1e293b] dark:border-slate-700 dark:text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-farm-500 transition-colors"
                disabled={busy}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {L('Password')}
                </label>
                <button
                  type="button"
                  onClick={() => goTo('forgotEmail')}
                  disabled={!mailConfigured}
                  className="text-[11px] text-farm-600 hover:text-farm-500 font-bold uppercase tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {L('Forgot password?')}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={loginPw}
                  onChange={(e) => setLoginPw(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-100 border border-slate-200 text-slate-900 dark:bg-[#1e293b] dark:border-slate-700 dark:text-white rounded-lg pl-4 pr-11 py-3 text-sm focus:outline-none focus:border-farm-500 transition-colors"
                  disabled={busy}
                />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 bg-farm-600 hover:bg-farm-700 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-farm-500/10 flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-60"
            >
              {busy ? L('Signing in…') : <><LogIn size={18} />{L('Sign in')}</>}
            </button>

            {/* Bottom links */}
            <div className="flex items-center justify-center pt-1">
              {signupAllowed && (
                    <button
                      type="button"
                      onClick={() => goTo('signup')}
                      className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-farm-600 dark:hover:text-farm-400 transition inline-flex items-center gap-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      {L('Create admin')}
                    </button>
                  )}
                </div>
                {!mailConfigured && (
                <p className="text-2xs text-amber-600 dark:text-amber-400 text-center pt-1">
                  {L('Email not configured — password reset unavailable.')}
                </p>
              )}
            </motion.form>
          )}

          {/* -------- FORGOT PASSWORD: enter email -------- */}
            {view === 'forgotEmail' && (
              <motion.form
                key="forgotEmail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleFpRequest}
                className="space-y-4"
              >
                <BackHeader onBack={() => goTo('login')} title={L('Reset password')} />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {L('Enter your admin email to receive a 6-digit verification code.')}
                </p>
                {err && <AlertBox type="err" text={err} />}
                <Field label={L('Email')}>
                  <input type="email" autoFocus value={fpEmail} onChange={(e) => setFpEmail(e.target.value)}
                    placeholder="you@farm.com"
                    className={inputCls} disabled={busy} />
                </Field>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={busy}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-farm-500 to-farm-600 hover:from-farm-600 hover:to-farm-700 disabled:opacity-60 shadow-lg shadow-farm-500/20 transition inline-flex items-center justify-center gap-2">
                  {busy ? L('Sending…') : <><Mail className="w-4 h-4" />{L('Send code')}</>}
                </motion.button>
              </motion.form>
            )}

            {/* -------- FORGOT PASSWORD: enter code + new pw -------- */}
            {view === 'forgotCode' && (
              <motion.form
                key="forgotCode"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleFpReset}
                className="space-y-4"
              >
                <BackHeader onBack={() => goTo('forgotEmail')} title={L('Enter verification code')} />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {L('A 6-digit code was sent to')} <span className="font-semibold text-slate-700 dark:text-slate-300">{fpEmail}</span>
                </p>
                {info && <AlertBox type="ok" text={info} />}
                {err && <AlertBox type="err" text={err} />}

                <CodeInput value={fpCode} setter={setFpCode} refs={codeRefs} onChange={handleCodeChange} onKey={handleCodeKey} />

                <Field label={L('New password')}>
                  <input type="password" value={fpNewPw} onChange={(e) => setFpNewPw(e.target.value)}
                    placeholder="••••••••" className={inputCls} disabled={busy} />
                </Field>

                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={busy}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-farm-500 to-farm-600 hover:from-farm-600 hover:to-farm-700 disabled:opacity-60 shadow-lg shadow-farm-500/20 transition inline-flex items-center justify-center gap-2">
                  {busy ? L('Resetting…') : <><Check className="w-4 h-4" />{L('Reset password')}</>}
                </motion.button>
              </motion.form>
            )}

            {/* -------- SIGNUP: enter details -------- */}
            {view === 'signup' && (
              <motion.form
                key="signup"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleSignupReq}
                className="space-y-4"
              >
                <BackHeader onBack={() => goTo('login')} title={L('Create admin account')} />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {L('First-time setup: create the first administrator. A verification code will be sent to your email.')}
                </p>
                {err && <AlertBox type="err" text={err} />}
                <div className="grid grid-cols-2 gap-3">
                  <Field label={L('Username')}>
                    <input type="text" autoFocus value={suUsername} onChange={(e) => setSuUsername(e.target.value)}
                      placeholder="admin" className={inputCls} disabled={busy} />
                  </Field>
                  <Field label={L('Display name')}>
                    <input type="text" value={suName} onChange={(e) => setSuName(e.target.value)}
                      placeholder={L('Optional')} className={inputCls} disabled={busy} />
                  </Field>
                </div>
                <Field label={L('Email')}>
                  <input type="email" value={suEmail} onChange={(e) => setSuEmail(e.target.value)}
                    placeholder="you@farm.com" className={inputCls} disabled={busy} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={L('Password')}>
                    <input type="password" value={suPw} onChange={(e) => setSuPw(e.target.value)}
                      placeholder="••••••••" className={inputCls} disabled={busy} />
                  </Field>
                  <Field label={L('Confirm')}>
                    <input type="password" value={suPw2} onChange={(e) => setSuPw2(e.target.value)}
                      placeholder="••••••••" className={inputCls} disabled={busy} />
                  </Field>
                </div>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={busy}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-farm-500 hover:from-indigo-600 hover:to-farm-600 disabled:opacity-60 shadow-lg transition inline-flex items-center justify-center gap-2">
                  {busy ? L('Sending code…') : <><Mail className="w-4 h-4" />{L('Send verification code')}</>}
                </motion.button>
              </motion.form>
            )}

            {/* -------- SIGNUP: verify code -------- */}
            {view === 'signupCode' && (
              <motion.form
                key="signupCode"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleSignupVerify}
                className="space-y-4"
              >
                <BackHeader onBack={() => goTo('signup')} title={L('Verify your email')} />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {L('Enter the 6-digit code sent to')} <span className="font-semibold text-slate-700 dark:text-slate-300">{suEmail}</span>
                </p>
                {info && <AlertBox type="ok" text={info} />}
                {err && <AlertBox type="err" text={err} />}

                <CodeInput value={suCode} setter={setSuCode} refs={codeRefs} onChange={(_i, v) => handleCodeChange(_i, v)} onKey={handleCodeKey} />

                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" disabled={busy}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-farm-500 hover:from-indigo-600 hover:to-farm-600 disabled:opacity-60 shadow-lg transition inline-flex items-center justify-center gap-2">
                  {busy ? L('Creating account…') : <><Check className="w-4 h-4" />{L('Create admin & sign in')}</>}
                </motion.button>
              </motion.form>
            )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const inputCls = "w-full text-sm px-4 py-3 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-xl focus:border-farm-400 focus:ring-2 focus:ring-farm-100 dark:focus:ring-farm-900/40 focus:outline-none font-medium bg-white text-slate-900 transition";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-2xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label}</label>
      {children}
    </div>
  );
}

function BackHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <button type="button" onClick={onBack}
        className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 transition shrink-0">
        <ArrowLeft className="w-4 h-4" />
      </button>
      <h2 className="font-bold text-base text-slate-800 dark:text-slate-100">{title}</h2>
    </div>
  );
}

function AlertBox({ type, text }: { type: 'err' | 'ok'; text: string }) {
  const cls = type === 'err'
    ? 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
    : 'bg-farm-50 dark:bg-farm-900/30 border-farm-200 dark:border-farm-800 text-farm-800 dark:text-farm-200';
  return (
    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-2 p-3 border rounded-xl text-sm ${cls}`}>
      {type === 'err' ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <Check className="w-4 h-4 mt-0.5 shrink-0" />}
      <span>{text}</span>
    </motion.div>
  );
}

function CodeInput({ value, refs, onChange, onKey }: {
  value: string;
  setter: (v: string) => void;
  refs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  onChange: (idx: number, val: string) => void;
  onKey: (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const digits = value.split('');
  while (digits.length < 6) digits.push('');
  return (
    <div className="flex justify-between gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => onChange(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          onFocus={(e) => e.target.select()}
          className="w-12 h-14 text-center text-2xl font-bold font-mono border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-xl focus:border-farm-400 focus:ring-2 focus:ring-farm-100 dark:focus:ring-farm-900/40 focus:outline-none transition"
        />
      ))}
    </div>
  );
}
