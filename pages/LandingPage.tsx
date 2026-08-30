import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { LandingHeader } from '../components/landing/LandingHeader';
import { HeroSection } from '../components/landing/HeroSection';
import { WhatIsInvoxSection } from '../components/landing/WhatIsInvoxSection';
import { DiscoverSection } from '../components/landing/DiscoverSection';
import { FeedsSection } from '../components/landing/FeedsSection';
import { AiCreationSection } from '../components/landing/AiCreationSection';
import { GlobalNetworkSection } from '../components/landing/GlobalNetworkSection';
import { HubSection } from '../components/landing/HubSection';
import { EcosystemSection } from '../components/landing/EcosystemSection';
import { AiCompanionSection } from '../components/landing/AiCompanionSection';
import { FinalCtaSection } from '../components/landing/FinalCtaSection';
import { LandingFooter } from '../components/landing/LandingFooter';
import { AuthModal } from '../components/landing/AuthModal';
import { useAuth } from '../contexts/AuthContext';

export const LandingPage: React.FC = () => {
    const { currentUser } = useAuth();
    const navigate = ReactRouterDOM.useNavigate();
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('signup');

    // If user is already authenticated, redirect to /explore
    useEffect(() => {
        if (currentUser) {
            navigate('/explore', { replace: true });
        }
    }, [currentUser, navigate]);

    const handleOpenAuth = (mode: 'login' | 'signup' = 'signup') => {
        setAuthModalMode(mode);
        setAuthModalOpen(true);
    };

    return (
        <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black font-sans antialiased overflow-x-hidden">
            {/* Header Navigation */}
            <LandingHeader onOpenAuth={handleOpenAuth} />

            {/* Main Landing Sections */}
            <main>
                <HeroSection onOpenAuth={handleOpenAuth} />
                <WhatIsInvoxSection />
                <DiscoverSection />
                <FeedsSection />
                <AiCreationSection />
                <GlobalNetworkSection />
                <HubSection />
                <EcosystemSection />
                <AiCompanionSection />
                <FinalCtaSection onOpenAuth={handleOpenAuth} />
            </main>

            {/* Technical Footer */}
            <LandingFooter onOpenAuth={handleOpenAuth} />

            {/* Seamless In-Page Auth Modal */}
            <AuthModal
                isOpen={authModalOpen}
                initialMode={authModalMode}
                onClose={() => setAuthModalOpen(false)}
                onSuccess={() => {
                    navigate('/explore');
                }}
            />
        </div>
    );
};
