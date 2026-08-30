import React, { useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { loginWithGoogle, registerWithEmail } from '../services/authService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

const SignupPage = () => {
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = ReactRouterDOM.useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            return setError("Passwords do not match");
        }
        // Client-side password strength validation
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            return setError("Password must be at least 8 characters long and include a number and a special character.");
        }
        setLoading(true);
        setError('');
        try {
            await registerWithEmail(email, password, displayName.trim() || undefined);
            navigate('/explore', { replace: true });
        } catch (err: any) {
            setError(getFriendlyErrorMessage(err));
            console.error(err);
        }
        setLoading(false);
    };

    const handleGoogleSignup = async () => {
        setLoading(true);
        setError('');
        try {
            await loginWithGoogle();
            navigate('/explore', { replace: true });
        } catch (err: any) {
            setError(getFriendlyErrorMessage(err));
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
                        <span className="w-1.5 h-1.5 bg-blue-500 animate-pulse"></span>
                        <span>// NEW_ACCOUNT_PROVISION</span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-mono uppercase">
                        CREATE ACCOUNT
                    </h1>
                    <p className="text-xs text-zinc-500 mt-1 font-mono">
                        Initialize your developer identity on Invox
                    </p>
                </div>

                {/* Segmented Auth Mode Switcher */}
                <div className="w-full bg-[#09090b] border border-zinc-800/90 p-1 grid grid-cols-2 gap-1 mb-6">
                    <ReactRouterDOM.Link
                        to="/login"
                        className="py-2 text-center font-mono text-xs uppercase tracking-wider bg-transparent border border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30 transition-colors"
                    >
                        // LOGIN
                    </ReactRouterDOM.Link>
                    <button
                        type="button"
                        className="py-2 text-center font-mono text-xs uppercase tracking-wider bg-[#18181b] border border-zinc-700 text-white font-bold shadow-sm"
                    >
                        // REGISTER
                    </button>
                </div>

                {error && (
                    <div className="bg-red-950/80 border border-red-800/90 text-red-300 text-center p-3 mb-4 text-xs font-mono uppercase tracking-wider">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3.5">
                    <div>
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5" htmlFor="display-name">
                            // DISPLAY_NAME
                        </label>
                        <input
                            type="text"
                            id="display-name"
                            value={displayName}
                            placeholder="Alex Mercer"
                            onChange={(e) => setDisplayName(e.target.value)}
                            required
                            className="w-full bg-[#09090b] border border-zinc-800 focus:border-zinc-500 focus:outline-none p-2.5 text-xs text-white placeholder-zinc-600 font-mono transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5" htmlFor="email">
                            // EMAIL_ADDRESS
                        </label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            placeholder="engineer@domain.com"
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full bg-[#09090b] border border-zinc-800 focus:border-zinc-500 focus:outline-none p-2.5 text-xs text-white placeholder-zinc-600 font-mono transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5" htmlFor="password">
                            // PASSWORD (MIN 8 CHARS, 1 NUM, 1 SPECIAL)
                        </label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            placeholder="••••••••••••"
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full bg-[#09090b] border border-zinc-800 focus:border-zinc-500 focus:outline-none p-2.5 text-xs text-white placeholder-zinc-600 font-mono transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5" htmlFor="confirm-password">
                            // CONFIRM_PASSWORD
                        </label>
                        <input
                            type="password"
                            id="confirm-password"
                            value={confirmPassword}
                            placeholder="••••••••••••"
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className="w-full bg-[#09090b] border border-zinc-800 focus:border-zinc-500 focus:outline-none p-2.5 text-xs text-white placeholder-zinc-600 font-mono transition-colors"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-white hover:bg-zinc-200 text-black p-3 font-mono text-xs font-bold uppercase tracking-wider transition-colors border border-white disabled:opacity-50 disabled:cursor-not-allowed mt-3"
                    >
                        {loading ? '// PROVISIONING...' : '// CREATE_ACCOUNT'}
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
                    onClick={handleGoogleSignup}
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
                    Already registered?{' '}
                    <ReactRouterDOM.Link to="/login" className="text-zinc-300 hover:text-white underline underline-offset-4">
                        Sign In Here
                    </ReactRouterDOM.Link>
                </div>
            </div>
        </div>
    );
};

export default SignupPage;
