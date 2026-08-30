import React, { useState } from 'react';
import { loginWithEmail, registerWithEmail, loginWithGoogle } from '../../services/authService';

interface AuthModalProps {
    isOpen: boolean;
    initialMode?: 'login' | 'signup';
    onClose: () => void;
    onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
    isOpen,
    initialMode = 'signup',
    onClose,
    onSuccess
}) => {
    const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Sync mode when initialMode changes
    React.useEffect(() => {
        setMode(initialMode);
        setError(null);
    }, [initialMode, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (mode === 'signup') {
                if (!email || !password) {
                    setError('Please provide an email and password.');
                    setLoading(false);
                    return;
                }
                if (password.length < 6) {
                    setError('Password must be at least 6 characters.');
                    setLoading(false);
                    return;
                }
                await registerWithEmail(email, password, displayName || undefined);
            } else {
                if (!email || !password) {
                    setError('Please provide an email and password.');
                    setLoading(false);
                    return;
                }
                await loginWithEmail(email, password);
            }
            onSuccess?.();
            onClose();
        } catch (err: any) {
            console.error('Auth error in modal:', err);
            const msg = err?.message || 'Authentication failed. Please check your credentials.';
            if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password') || msg.includes('auth/user-not-found')) {
                setError('Invalid email or password.');
            } else if (msg.includes('auth/email-already-in-use')) {
                setError('An account with this email already exists.');
            } else {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleAuth = async () => {
        setError(null);
        setLoading(true);
        try {
            await loginWithGoogle();
            onSuccess?.();
            onClose();
        } catch (err: any) {
            console.error('Google auth error in modal:', err);
            setError(err?.message || 'Google authentication failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeInUp">
            <div className="bg-[#09090b] border border-zinc-700 max-w-md w-full p-6 sm:p-8 font-mono text-xs shadow-2xl relative">
                
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-white text-sm"
                    aria-label="Close modal"
                >
                    [×]
                </button>

                {/* Top Status Header */}
                <div className="flex items-center space-x-2 text-[10px] text-zinc-500 border-b border-zinc-800 pb-2.5 mb-5">
                    <span className="w-1.5 h-1.5 bg-emerald-400"></span>
                    <span className="text-zinc-400 tracking-wider uppercase">
                        AUTH_TERMINAL // {mode === 'signup' ? 'NEW_COMRADE' : 'EXISTING_NODE'}
                    </span>
                </div>

                {/* Title */}
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-white uppercase font-sans tracking-tight">
                        {mode === 'signup' ? 'Join the Invox Network' : 'Access Your Space'}
                    </h3>
                    <p className="text-zinc-400 font-sans text-xs mt-1">
                        {mode === 'signup' 
                            ? 'Connect your mind to a global network of curious thinkers.' 
                            : 'Enter your credentials to access your feeds, squads, and saved insights.'}
                    </p>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mb-4 p-2.5 bg-red-950/40 border border-red-800 text-red-300 text-xs font-sans">
                        {error}
                    </div>
                )}

                {/* Google One-Tap Action */}
                <button
                    onClick={handleGoogleAuth}
                    disabled={loading}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-white font-mono flex items-center justify-center space-x-2 transition-all mb-4 uppercase tracking-wider"
                >
                    <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>CONTINUE WITH GOOGLE</span>
                </button>

                <div className="flex items-center space-x-2 my-4 text-zinc-600">
                    <span className="h-px bg-zinc-800 flex-1"></span>
                    <span className="text-[10px] uppercase">OR EMAIL_CREDENTIALS</span>
                    <span className="h-px bg-zinc-800 flex-1"></span>
                </div>

                {/* Standard Auth Form */}
                <form onSubmit={handleSubmit} className="space-y-3.5">
                    {mode === 'signup' && (
                        <div>
                            <label className="text-[10px] text-zinc-400 block mb-1 uppercase">// DISPLAY_NAME</label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Your Name or Alias"
                                className="w-full p-2.5 bg-black border border-zinc-800 focus:border-white focus:outline-none text-white text-xs"
                            />
                        </div>
                    )}

                    <div>
                        <label className="text-[10px] text-zinc-400 block mb-1 uppercase">// EMAIL_ADDRESS</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="curious@domain.com"
                            className="w-full p-2.5 bg-black border border-zinc-800 focus:border-white focus:outline-none text-white text-xs"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] text-zinc-400 block mb-1 uppercase">// PASSWORD</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••••••"
                            className="w-full p-2.5 bg-black border border-zinc-800 focus:border-white focus:outline-none text-white text-xs"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-white hover:bg-zinc-200 text-black font-bold uppercase tracking-widest text-xs transition-all mt-4 disabled:opacity-50"
                    >
                        {loading ? 'CONNECTING...' : mode === 'signup' ? '[ INITIALIZE ACCOUNT ]' : '[ AUTHENTICATE ]'}
                    </button>
                </form>

                {/* Switch Login / Signup Mode */}
                <div className="mt-5 pt-4 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400">
                    <span>
                        {mode === 'signup' ? 'Already an active node?' : 'New to Invox?'}
                    </span>
                    <button
                        onClick={() => {
                            setMode(mode === 'signup' ? 'login' : 'signup');
                            setError(null);
                        }}
                        className="text-white hover:underline uppercase font-bold"
                    >
                        {mode === 'signup' ? '[ SIGN IN ]' : '[ CREATE ACCOUNT ]'}
                    </button>
                </div>

            </div>
        </div>
    );
};
