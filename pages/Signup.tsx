
import React, { useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { loginWithGoogle, registerWithEmail } from '../services/authService';

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
        setLoading(true);
        setError('');
        try {
            await registerWithEmail(email, password, displayName.trim() || undefined);
            navigate('/');
        } catch (err: any) {
            switch (err.code) {
                case 'auth/email-already-in-use':
                    setError('This email address is already in use.');
                    break;
                case 'auth/weak-password':
                    setError('Password should be at least 6 characters.');
                    break;
                case 'auth/invalid-email':
                    setError('The email address is not valid.');
                    break;
                default:
                    setError('Failed to create an account. Please try again.');
                    break;
            }
            console.error(err);
        }
        setLoading(false);
    };

    const handleGoogleSignup = async () => {
        setLoading(true);
        setError('');
        try {
            await loginWithGoogle();
            navigate('/');
        } catch (err: any) {
            setError(err.code === 'auth/popup-closed-by-user' ? 'Google sign-up was cancelled.' : 'Failed to continue with Google.');
            console.error(err);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-invox-dark">
            <div className="bg-invox-dark-accent p-8 rounded-lg shadow-lg w-full max-w-md border border-gray-800">
                <h1 className="text-3xl font-bold text-invox-red text-center mb-2">Invox</h1>
                <h2 className="text-2xl font-bold text-white text-center mb-6">Create Account</h2>
                {error && <p className="bg-red-900 text-white text-center p-3 rounded-md mb-4">{error}</p>}
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-invox-light-gray mb-2" htmlFor="display-name">Display Name</label>
                        <input
                            type="text"
                            id="display-name"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            required
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-invox-red text-white"
                        />
                    </div>
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
                    <div className="mb-4">
                        <label className="block text-invox-light-gray mb-2" htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-invox-red text-white"
                        />
                    </div>
                     <div className="mb-6">
                        <label className="block text-invox-light-gray mb-2" htmlFor="confirm-password">Confirm Password</label>
                        <input
                            type="password"
                            id="confirm-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-invox-red text-white"
                        />
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-invox-red text-white p-3 rounded-md font-bold hover:bg-invox-red-hover disabled:bg-gray-500 transition-all duration-200 transform hover:scale-[1.02] active:scale-100">
                        {loading ? 'Creating Account...' : 'Sign Up'}
                    </button>
                </form>
                <button type="button" onClick={handleGoogleSignup} disabled={loading} className="w-full mt-4 bg-white text-gray-900 p-3 rounded-md font-bold hover:bg-gray-200 disabled:bg-gray-500 transition-all duration-200 transform hover:scale-[1.02] active:scale-100">
                    Continue with Google
                </button>
                <p className="text-center text-invox-light-gray mt-6">
                    Already have an account? <ReactRouterDOM.Link to="/login" className="text-invox-red-text hover:underline">Login</ReactRouterDOM.Link>
                </p>
            </div>
        </div>
    );
};

export default SignupPage;
