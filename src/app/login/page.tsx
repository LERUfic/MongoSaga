'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Database, Lock, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await signIn('credentials', {
      redirect: false,
      username,
      password,
    });

    if (res?.error) {
      setError('Invalid credentials or authentication failed.');
      setLoading(false);
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)] text-[var(--text-primary)] font-sans relative overflow-hidden p-6">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/10 via-[var(--bg-main)] to-[var(--bg-main)] pointer-events-none" />
      
      <div className="w-full max-w-md glass-panel p-8 rounded-2xl animate-fade-in z-10 bg-[var(--bg-card)] border border-[var(--border-glass)] shadow-2xl relative">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="p-4 bg-cyan-500/10 rounded-2xl mb-4 border border-cyan-500/20 shadow-sm">
            <Database size={36} className="text-cyan-500 drop-shadow-md" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">MongoSaga</h1>
          <p className="text-sm text-[var(--text-secondary)] max-w-[250px]">
            Please authenticate via LDAP/SSO to access the database management dashboard.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm font-medium flex items-center justify-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--text-secondary)] ml-1">Username</label>
            <div className="relative">
              <input
                type="text"
                autoFocus
                required
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl py-2.5 px-4 outline-none transition-all focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 shadow-sm text-sm"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--text-secondary)] ml-1">Password</label>
            <div className="relative">
              <input
                type="password"
                required
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl py-2.5 px-4 outline-none transition-all focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 shadow-sm text-sm"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="mt-2 w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:hover:bg-cyan-600 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <><Lock size={16} /> Authenticate</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
