import React, { useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { COLLECTIONS, updateDocument } from '../services/firestoreService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

const OnboardingPage = () => {
    const { currentUser, userProfile } = useAuth();
    const navigate = ReactRouterDOM.useNavigate();
    const [step, setStep] = useState(1);
    
    // Form state
    const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
    const [username, setUsername] = useState(userProfile?.username || '');
    const [headline, setHeadline] = useState(userProfile?.headline || '');
    const [skillsInput, setSkillsInput] = useState(userProfile?.skills?.join(', ') || '');
    const [interestsInput, setInterestsInput] = useState(userProfile?.interests?.join(', ') || '');
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleNext = () => setStep(prev => prev + 1);
    const handlePrev = () => setStep(prev => prev - 1);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        
        setLoading(true);
        setError('');

        try {
            const skills = skillsInput.split(',').map(s => s.trim()).filter(Boolean);
            const interests = interestsInput.split(',').map(s => s.trim()).filter(Boolean);

            await updateDocument(COLLECTIONS.users, currentUser.uid, {
                displayName,
                username,
                headline,
                skills,
                interests,
                onboardingCompleted: true,
            });

            navigate('/explore');
        } catch (err: any) {
            setError(getFriendlyErrorMessage(err));
            console.error(err);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-invox-dark p-4">
            <div className="bg-invox-dark-accent p-8 rounded-lg shadow-lg w-full max-w-lg border border-gray-800">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-invox-red">Invox</h1>
                    <span className="text-gray-400">Step {step} of 2</span>
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-6">
                    {step === 1 ? 'Complete your profile' : 'Professional interests'}
                </h2>

                {error && <p className="bg-red-900 text-white text-center p-3 rounded-md mb-4">{error}</p>}

                <form onSubmit={step === 2 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>
                    {step === 1 && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-invox-light-gray mb-2" htmlFor="displayName">Display Name</label>
                                <input
                                    type="text"
                                    id="displayName"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    required
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-invox-red text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-invox-light-gray mb-2" htmlFor="username">Username</label>
                                <input
                                    type="text"
                                    id="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-invox-red text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-invox-light-gray mb-2" htmlFor="headline">Headline</label>
                                <input
                                    type="text"
                                    id="headline"
                                    placeholder="e.g. Software Engineer at Tech Corp"
                                    value={headline}
                                    onChange={(e) => setHeadline(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-invox-red text-white"
                                />
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-invox-light-gray mb-2" htmlFor="skills">Skills (comma separated)</label>
                                <input
                                    type="text"
                                    id="skills"
                                    placeholder="e.g. React, Node.js, Design"
                                    value={skillsInput}
                                    onChange={(e) => setSkillsInput(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-invox-red text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-invox-light-gray mb-2" htmlFor="interests">Interests (comma separated)</label>
                                <input
                                    type="text"
                                    id="interests"
                                    placeholder="e.g. AI, Startups, Open Source"
                                    value={interestsInput}
                                    onChange={(e) => setInterestsInput(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-invox-red text-white"
                                />
                            </div>
                        </div>
                    )}

                    <div className="mt-8 flex gap-4">
                        {step === 2 && (
                            <button 
                                type="button" 
                                onClick={handlePrev}
                                className="flex-1 bg-gray-700 text-white p-3 rounded-md font-bold hover:bg-gray-600 transition-all"
                            >
                                Back
                            </button>
                        )}
                        <button 
                            type="submit" 
                            disabled={loading} 
                            className="flex-1 bg-invox-red text-white p-3 rounded-md font-bold hover:bg-invox-red-hover disabled:bg-gray-500 transition-all"
                        >
                            {loading ? 'Saving...' : step === 1 ? 'Next' : 'Complete Onboarding'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default OnboardingPage;
