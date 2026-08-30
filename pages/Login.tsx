import React, { useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { loginWithEmail, loginWithGoogle, sendResetPasswordEmail } from '../services/authService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = ReactRouterDOM.useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            await loginWithEmail(email, password);
            navigate('/');
        } catch (err: any) {
            setError(getFriendlyErrorMessage(err));
            console.error(err);
        }
        setLoading(false);
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            await loginWithGoogle();
            navigate('/');
        } catch (err: any) {
            setError(getFriendlyErrorMessage(err));
            console.error(err);
        }
        setLoading(false);
    };

    const handlePasswordReset = async () => {
        if (!email) {
            setError('Enter your email address first.');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');
        try {
            await sendResetPasswordEmail(email);
            setSuccess('Password reset email sent. Check your inbox.');
        } catch (err: any) {
            setError(err.code === 'auth/user-not-found' ? 'No account exists for that email.' : 'Failed to send password reset email.');
            console.error(err);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-black p-4 font-mono">
            <div className="bg-[#0c0c0e] p-6 sm:p-8 w-full max-w-md border border-zinc-800/90 shadow-2xl">
                {/* Brand Header */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-[#09090b] border border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-widest mb-3">
                        <span className="w-1.5 h-1.5 bg-emerald-500 animate-pulse"></span>
                        <span>// SYSTEM_GATEWAY</span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-mono uppercase">
                        INVOX ACCESS
                    </h1>
                    <p className="text-xs text-zinc-500 mt-1 font-mono">
                        Sign in to synchronize workspace packets and streams
                    </p>
                </div>

                {/* Segmented Auth Mode Switcher */}
                <div className="w-full bg-[#09090b] border border-zinc-800/90 p-1 grid grid-cols-2 gap-1 mb-6">
                    <button
                        type="button"
                        className="py-2 text-center font-mono text-xs uppercase tracking-wider bg-[#18181b] border border-zinc-700 text-white font-bold shadow-sm"
                    >
                        // LOGIN
                    </button>
                    <ReactRouterDOM.Link
                        to="/signup"
                        className="py-2 text-center font-mono text-xs uppercase tracking-wider bg-transparent border border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30 transition-colors"
                    >
                        // REGISTER
                    </ReactRouterDOM.Link>
                </div>

                {error && (
                    <div className="bg-red-950/80 border border-red-800/90 text-red-300 text-center p-3 mb-4 text-xs font-mono uppercase tracking-wider">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="bg-emerald-950/80 border border-emerald-800/90 text-emerald-300 text-center p-3 mb-4 text-xs font-mono uppercase tracking-wider">
                        {success}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider" htmlFor="email">
                                // EMAIL_ADDRESS
                            </label>
                        </div>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            placeholder="engineer@domain.com"
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full bg-[#09090b] border border-zinc-800 focus:border-zinc-500 focus:outline-none p-3 text-xs text-white placeholder-zinc-600 font-mono transition-colors"
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider" htmlFor="password">
                                // PASSWORD
                            </label>
                            <button
                                type="button"
                                onClick={handlePasswordReset}
                                disabled={loading}
                                className="text-[10px] text-zinc-500 hover:text-white uppercase tracking-wider transition-colors disabled:opacity-50"
                            >
                                [FORGOT_KEY?]
                            </button>
                        </div>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            placeholder="••••••••••••"
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full bg-[#09090b] border border-zinc-800 focus:border-zinc-500 focus:outline-none p-3 text-xs text-white placeholder-zinc-600 font-mono transition-colors"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-white hover:bg-zinc-200 text-black p-3 font-mono text-xs font-bold uppercase tracking-wider transition-colors border border-white disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    >
                        {loading ? '// AUTHENTICATING...' : '// SIGN_IN'}
                    </button>
                </form>

                <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-zinc-800"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase">
                        <span className="bg-[#0c0c0e] px-2 text-zinc-600 font-mono">OR CONTINUE WITH</span>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full bg-[#09090b] hover:bg-[#18181d] text-zinc-200 hover:text-white border border-zinc-800 hover:border-zinc-600 p-3 font-mono text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                        <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1s.7 5.4 1.9 7.8l3.7-2.9z"/>
                        <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.4 7.5 23 12 23z"/>
                    </svg>
                    <span>GOOGLE AUTH</span>
                </button>

                <div className="text-center text-zinc-500 mt-6 text-xs font-mono">
                    New operator?{' '}
                    <ReactRouterDOM.Link to="/signup" className="text-zinc-300 hover:text-white underline underline-offset-4">
                        Initialize Account
                    </ReactRouterDOM.Link>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
