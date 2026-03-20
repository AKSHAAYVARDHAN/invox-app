
import React, { useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = ReactRouterDOM.useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate('/');
        } catch (err: any) {
            switch (err.code) {
                case 'auth/invalid-credential':
                    setError('Invalid email or password. Please try again.');
                    break;
                case 'auth/user-disabled':
                    setError('This account has been disabled.');
                    break;
                case 'auth/too-many-requests':
                     setError('Access to this account has been temporarily disabled due to many failed login attempts. Please try again later.');
                     break;
                default:
                    setError('Failed to log in. Please check your credentials.');
                    break;
            }
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
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-invox-red text-white p-3 rounded-md font-bold hover:bg-invox-red-hover disabled:bg-gray-500 transition-all duration-200 transform hover:scale-[1.02] active:scale-100">
                        {loading ? 'Logging In...' : 'Login'}
                    </button>
                </form>
                <p className="text-center text-invox-light-gray mt-6">
                    Don't have an account? <ReactRouterDOM.Link to="/signup" className="text-invox-red-text hover:underline">Sign Up</ReactRouterDOM.Link>
                </p>
            </div>
        </div>
    );
};

export default LoginPage;