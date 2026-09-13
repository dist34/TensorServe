/**
 * LoginPage.tsx
 *
 * Custom blob-float keyframes are not part of default Tailwind and must be
 * registered in tailwind.config.ts before this component will animate.
 * Add the following to your config (theme.extend):
 *
 * keyframes: {
 *   float1: {
 *     '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
 *     '33%':      { transform: 'translate(40px, -30px) scale(1.06)' },
 *     '66%':      { transform: 'translate(-25px, 20px) scale(0.96)' },
 *   },
 *   float2: {
 *     '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
 *     '50%':      { transform: 'translate(-35px, -45px) scale(1.1)' },
 *   },
 *   float3: {
 *     '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
 *     '33%':      { transform: 'translate(-50px, 30px) scale(1.05)' },
 *     '66%':      { transform: 'translate(20px, -25px) scale(0.94)' },
 *   },
 *   float4: {
 *     '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
 *     '50%':      { transform: 'translate(30px, 40px) scale(1.15)' },
 *   },
 * },
 * animation: {
 *   float1: 'float1 18s ease-in-out infinite',
 *   float2: 'float2 14s ease-in-out infinite',
 *   float3: 'float3 20s ease-in-out infinite',
 *   float4: 'float4 16s ease-in-out infinite',
 * },
 */

import React, { useState, FormEvent } from 'react';
import { useAuth } from '@/contexts/auth-context';

export interface LoginPageProps {
  mode?: 'login' | 'register';
  onSubmit?: (credentials: { email: string; password: string }) => void;
  onForgotPassword?: () => void;
  onCreateAccount?: () => void;
  onSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  mode = 'login',
  onSubmit,
  onForgotPassword,
  onCreateAccount,
  onSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, register } = useAuth();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
      
      // Call success callback
      onSuccess?.();
      
      // Call original onSubmit if provided
      onSubmit?.({ email, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-[#0a0a0a]">
      {/* Animated background blobs */}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div
          className="motion-safe:animate-float1 absolute -bottom-[180px] -left-[140px] h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle_at_35%_30%,#d8d8d8_0%,#9a9a9a_35%,#4a4a4a_65%,#0a0a0a_100%)] opacity-90 blur-[4px] sm:h-[380px] sm:w-[380px] lg:h-[480px] lg:w-[480px]"
        />
        <div
          className="motion-safe:animate-float2 absolute bottom-10 left-[60px] h-[200px] w-[200px] rounded-full bg-[radial-gradient(circle_at_35%_30%,#d8d8d8_0%,#9a9a9a_35%,#4a4a4a_65%,#0a0a0a_100%)] opacity-90 blur-[4px] sm:h-[260px] sm:w-[260px] lg:left-[90px] lg:h-[320px] lg:w-[320px]"
        />
        <div
          className="motion-safe:animate-float3 absolute -bottom-[260px] -right-[220px] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_35%_30%,#d8d8d8_0%,#9a9a9a_35%,#4a4a4a_65%,#0a0a0a_100%)] opacity-90 blur-[4px] sm:h-[460px] sm:w-[460px] lg:h-[560px] lg:w-[560px]"
        />
        <div
          className="motion-safe:animate-float4 absolute right-[60px] top-[30%] hidden h-[260px] w-[260px] rounded-full bg-[radial-gradient(circle_at_35%_30%,#d8d8d8_0%,#9a9a9a_35%,#4a4a4a_65%,#0a0a0a_100%)] opacity-60 blur-[4px] sm:block"
        />
      </div>

      {/* Vignette */}
      <div
        className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_40%,#0a0a0a_88%)]"
        aria-hidden="true"
      />

      {/* Card */}
      <div className="relative z-[2] w-full max-w-[380px] px-6">
        <p className="mb-3.5 text-[11px] font-semibold tracking-[4px] text-[#8a8a8a]">
          TensorServe
        </p>

        <h1 className="mb-10 text-[44px] font-extrabold uppercase leading-[1.02] tracking-[-0.5px] text-white">
          {mode === 'login' ? "Let's get started" : "Create account"}
          <br />
          
        </h1>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-7">
            <label
              htmlFor="email"
              className="mb-3 block text-[11px] font-semibold tracking-[3px] text-[#8a8a8a]"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-0 border-b border-[#3a3a3a] bg-transparent pb-3 font-inherit text-[17px] text-[#cfcfcf] outline-none transition-colors duration-200 ease-out placeholder:text-[#6a6a6a] focus:border-white"
            />
          </div>

          <div className="mb-7">
            <label
              htmlFor="password"
              className="mb-3 block text-[11px] font-semibold tracking-[3px] text-[#8a8a8a]"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border-0 border-b border-[#3a3a3a] bg-transparent pb-3 font-inherit text-[17px] text-[#cfcfcf] outline-none transition-colors duration-200 ease-out placeholder:text-[#6a6a6a] focus:border-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mb-7 mt-2 w-full rounded-[30px] bg-white py-[18px] text-sm font-bold tracking-[2px] text-[#0a0a0a] transition-transform duration-150 ease-out hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(255,255,255,0.15)] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'PROCESSING...' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
          </button>
        </form>

        {error && (
          <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-center font-mono text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] tracking-[2px] text-[#7a7a7a]">
          <button
            type="button"
            onClick={onForgotPassword}
            className="bg-transparent text-[#7a7a7a] transition-colors duration-150 hover:text-[#cfcfcf]"
          >
            FORGOT PASSWORD
          </button>
          <button
            type="button"
            onClick={onCreateAccount}
            className="bg-transparent text-[#7a7a7a] transition-colors duration-150 hover:text-[#cfcfcf]"
          >
            {mode === 'login' ? 'CREATE ACCOUNT' : 'SIGN IN'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;