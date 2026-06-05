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
            setSuccess('Password reset email sent.');
        } catch (err: any) {
            setError(err.code === 'auth/user-not-found' ? 'No account exists for that email.' : 'Failed to send password reset email.');
            console.error(err);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-invox-dark">
            <div className="bg-invox-dark-accent p-8 rounded-lg shadow-lg w-full max-w-md border border-gray-800">
                <h1 className="text-3xl font-bold text-invox-red text-center mb-2">Invox</h1>
                <h2 className="text-2xl font-bold text-white text-center mb-6">Login</h2>
                {error && <p className="bg-red-900 text-white text-center p-3 rounded-md mb-4">{error}</p>}
                {success && <p className="bg-green-900 text-white text-center p-3 rounded-md mb-4">{success}</p>}
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-invox-light-gray mb-2" htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-invox-red text-white"
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block text-invox-light-gray mb-2" htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-invox-red text-white"
                        />
                        <button type="button" onClick={handlePasswordReset} disabled={loading} className="mt-2 text-sm text-invox-red-text hover:underline disabled:text-gray-500">
                            Forgot password?
                        </button>
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-invox-red text-white p-3 rounded-md font-bold hover:bg-invox-red-hover disabled:bg-gray-500 transition-all duration-200 transform hover:scale-[1.02] active:scale-100">
                        {loading ? 'Logging In...' : 'Login'}
                    </button>
                </form>
                <button type="button" onClick={handleGoogleLogin} disabled={loading} className="w-full mt-4 bg-white text-gray-900 p-3 rounded-md font-bold hover:bg-gray-200 disabled:bg-gray-500 transition-all duration-200 transform hover:scale-[1.02] active:scale-100">
                    Continue with Google
                </button>
                <p className="text-center text-invox-light-gray mt-6">
                    Don't have an account? <ReactRouterDOM.Link to="/signup" className="text-invox-red-text hover:underline">Sign Up</ReactRouterDOM.Link>
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
