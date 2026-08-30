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
        <div className="min-h-screen flex items-center justify-center bg-black p-4 font-mono">
            <div className="bg-[#0c0c0e] p-6 sm:p-8 w-full max-w-lg border border-zinc-800/90 shadow-2xl">
                {/* Brand Header */}
                <div className="flex justify-between items-center pb-4 mb-5 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-500 animate-pulse"></span>
                        <h1 className="text-base font-bold text-white tracking-wider uppercase font-mono">
                            // INVOX_ONBOARDING
                        </h1>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-[#09090b] border border-zinc-800 text-zinc-400 uppercase tracking-widest font-mono">
                        STEP {step} / 2
                    </span>
                </div>

                {/* Segmented Step Indicator */}
                <div className="w-full bg-[#09090b] border border-zinc-800/90 p-1 grid grid-cols-2 gap-1 mb-6">
                    <div
                        className={`py-2 text-center font-mono text-xs uppercase tracking-wider transition-all ${
                            step === 1
                                ? 'bg-[#18181b] border border-zinc-700 text-white font-bold'
                                : 'bg-transparent text-zinc-500'
                        }`}
                    >
                        // 01_PROFILE
                    </div>
                    <div
                        className={`py-2 text-center font-mono text-xs uppercase tracking-wider transition-all ${
                            step === 2
                                ? 'bg-[#18181b] border border-zinc-700 text-white font-bold'
                                : 'bg-transparent text-zinc-500'
                        }`}
                    >
                        // 02_EXPERTISE
                    </div>
                </div>

                {error && (
                    <div className="bg-red-950/80 border border-red-800/90 text-red-300 text-center p-3 mb-4 text-xs font-mono uppercase tracking-wider">
                        {error}
                    </div>
                )}

                <form onSubmit={step === 2 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>
                    {step === 1 && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5" htmlFor="displayName">
                                    // DISPLAY_NAME
                                </label>
                                <input
                                    type="text"
                                    id="displayName"
                                    value={displayName}
                                    placeholder="Alex Mercer"
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    required
                                    className="w-full bg-[#09090b] border border-zinc-800 focus:border-zinc-500 focus:outline-none p-3 text-xs text-white placeholder-zinc-600 font-mono transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5" htmlFor="username">
                                    // SYSTEM_USERNAME
                                </label>
                                <input
                                    type="text"
                                    id="username"
                                    value={username}
                                    placeholder="alex_mercer"
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    className="w-full bg-[#09090b] border border-zinc-800 focus:border-zinc-500 focus:outline-none p-3 text-xs text-white placeholder-zinc-600 font-mono transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5" htmlFor="headline">
                                    // PROFESSIONAL_HEADLINE
                                </label>
                                <input
                                    type="text"
                                    id="headline"
                                    placeholder="e.g. Distributed Systems Engineer @ Tech Labs"
                                    value={headline}
                                    onChange={(e) => setHeadline(e.target.value)}
                                    className="w-full bg-[#09090b] border border-zinc-800 focus:border-zinc-500 focus:outline-none p-3 text-xs text-white placeholder-zinc-600 font-mono transition-colors"
                                />
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5" htmlFor="skills">
                                    // TECHNICAL_SKILLS (COMMA SEPARATED)
                                </label>
                                <input
                                    type="text"
                                    id="skills"
                                    placeholder="React, TypeScript, Rust, Distributed Systems, PyTorch"
                                    value={skillsInput}
                                    onChange={(e) => setSkillsInput(e.target.value)}
                                    className="w-full bg-[#09090b] border border-zinc-800 focus:border-zinc-500 focus:outline-none p-3 text-xs text-white placeholder-zinc-600 font-mono transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5" htmlFor="interests">
                                    // RESEARCH_INTERESTS (COMMA SEPARATED)
                                </label>
                                <input
                                    type="text"
                                    id="interests"
                                    placeholder="AI Infrastructure, Quantum Computing, Dev Tools"
                                    value={interestsInput}
                                    onChange={(e) => setInterestsInput(e.target.value)}
                                    className="w-full bg-[#09090b] border border-zinc-800 focus:border-zinc-500 focus:outline-none p-3 text-xs text-white placeholder-zinc-600 font-mono transition-colors"
                                />
                            </div>
                        </div>
                    )}

                    <div className="mt-8 flex gap-3">
                        {step === 2 && (
                            <button 
                                type="button" 
                                onClick={handlePrev}
                                className="flex-1 bg-[#09090b] hover:bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-600 p-3 font-mono text-xs font-bold uppercase tracking-wider transition-colors"
                            >
                                // BACK
                            </button>
                        )}
                        <button 
                            type="submit" 
                            disabled={loading} 
                            className="flex-1 bg-white hover:bg-zinc-200 text-black p-3 font-mono text-xs font-bold uppercase tracking-wider transition-colors border border-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? '// SAVING...' : step === 1 ? '// NEXT_STEP' : '// COMPLETE_ONBOARDING'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default OnboardingPage;
