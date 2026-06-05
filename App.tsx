import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
// FIX: Use namespace import for react-router-dom to avoid "no exported member" issues.
import * as ReactRouterDOM from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import RightSidebar from './components/layout/RightSidebar';
import ExplorePage from './pages/Explore';
import SpotlightPage from './pages/Spotlight';
import TrendzPage from './pages/Trendz';
import CommunitiesPage from './pages/Communities';
import HubPage from './pages/Hub';
import ProfilePage from './pages/Profile';
import MySpacePage from './pages/MySpace';
import UploadsPage from './pages/Uploads';
import LoginPage from './pages/Login';
import SignupPage from './pages/Signup';
import ApplicationFormPage from './pages/ApplicationFormPage';
import ApplicationStatusPage from './pages/ApplicationStatusPage';
import SavedApplicationsPage from './pages/SavedApplicationsPage';
import ComingSoonPage from './pages/ComingSoon';
import OnboardingPage from './pages/Onboarding';
import SettingsPage from './pages/Settings';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { AIAssistantButton, AIChatModal } from './components/ui/AIAssistant';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import GoForItFilterModal from './components/spotlight/GoForItFilterModal';
import { usePullToRefresh } from './components/hooks/usePullToRefresh';
import PullToRefreshIndicator from './components/ui/PullToRefreshIndicator';
import { AIAssistantProvider, useAIAssistant, FilterProvider } from './contexts/AIAssistantContext';
import type { HubConversation, Message } from './types';


const pageTitles: { [key: string]: string } = {
    '/trendz': 'Trendz',
    '/explore': 'Explore',
    '/spotlight': 'Spotlight',
    '/communities': 'Communities',
    '/hub': 'Hub',
    '/myspace': 'My Space',
    '/myspace/uploads': 'Create Content',
    '/duppor': 'Duppor',
    '/profile': 'Profile',
    '/applications': 'My Applications',
    '/saved-applications': 'Saved Opportunities',
};

const baseHubConversations: Omit<HubConversation, 'messages'>[] = [
    { id: 'hc1', name: 'Startup Grind', timestamp: '2h ago', unreadCount: 1, avatarUrl: 'https://picsum.photos/seed/startup-grind/200', category: 'explore' },
    { id: 'hc2', name: 'UI/UX Guild', timestamp: '5h ago', unreadCount: 0, avatarUrl: 'https://picsum.photos/seed/ui-ux-guild/200', category: 'explore' },
    { id: 'hc3', name: 'John Doe', timestamp: '6h ago', unreadCount: 2, avatarUrl: 'https://picsum.photos/seed/john-doe/200', category: 'comrade' },
    { id: 'hc4', name: 'Project Phoenix', timestamp: '8h ago', unreadCount: 0, avatarUrl: 'https://picsum.photos/seed/phoenix/200', category: 'group', isGroup: true },
    { id: 'hc5', name: 'Pythonic Geeks', timestamp: '1d ago', unreadCount: 5, avatarUrl: 'https://picsum.photos/seed/pythonic-geeks/200', category: 'explore' },
    { id: 'hc10', name: 'Frontend Wizards', timestamp: '1d ago', unreadCount: 3, avatarUrl: 'https://picsum.photos/seed/frontend-wizards/200', category: 'group', isGroup: true },
    { id: 'hc6', name: 'Spotlight Opps', timestamp: '2d ago', unreadCount: 1, avatarUrl: 'https://picsum.photos/seed/stripe/200', category: 'spotlight' },
    { id: 'hc11', name: 'Design Thinkers', timestamp: '2d ago', unreadCount: 0, avatarUrl: 'https://picsum.photos/seed/design-thinkers/200', category: 'group', isGroup: true },
    { id: 'hc7', name: 'Jane Smith', timestamp: '2d ago', unreadCount: 0, avatarUrl: 'https://picsum.photos/seed/jane-smith/200', category: 'comrade' },
    { id: 'hc12', name: 'Alex Johnson', timestamp: '3d ago', unreadCount: 0, avatarUrl: 'https://picsum.photos/seed/alex-j/200', category: 'comrade' },
    { id: 'hc13', name: 'Maria Garcia', timestamp: '3d ago', unreadCount: 1, avatarUrl: 'https://picsum.photos/seed/maria-g/200', category: 'comrade' },
    { id: 'hc8', name: 'AI ClubTech', timestamp: '4d ago', unreadCount: 0, avatarUrl: 'https://picsum.photos/seed/ai-clubtech/200', category: 'explore'},
    { id: 'hc15', name: 'Chris Lee', timestamp: '4d ago', unreadCount: 0, avatarUrl: 'https://picsum.photos/seed/chris-lee/200', category: 'comrade' },
    { id: 'hc9', name: 'JS Junkies', timestamp: '4d ago', unreadCount: 1, avatarUrl: 'https://picsum.photos/seed/js-junkies/200', category: 'explore'},
    { id: 'hc14', name: 'Marketing Crew', timestamp: '5d ago', unreadCount: 1, avatarUrl: 'https://picsum.photos/seed/marketing-crew/200', category: 'group', isGroup: true },
];

const generateUniqueMessages = (convo: Omit<HubConversation, 'messages'>): Message[] => {
    const stringToHash = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    };

    const seed = stringToHash(convo.id);
    let currentSeed = seed;
    const seededRandom = () => {
        currentSeed = (currentSeed * 9301 + 49297) % 233280;
        return currentSeed / 233280;
    };

    const messageTemplates = [
        `How's it going with the ${convo.name} project?`, 'Did you see the latest update?', 'Let\'s sync up tomorrow.', 'I have some feedback on the designs.', 'The client loved it!', 'Can you send over the report?', 'Running a bit late, sorry!', 'Looks good to me.', 'I\'ll get back to you on that by EOD.', 'What do you think about this idea?', 'I pushed the latest changes to the main branch.', 'Let\'s grab lunch sometime next week.',
    ];
    
    const numMessages = Math.floor(seededRandom() * 6) + 5;
    const newMessages: Message[] = [];
    const today = new Date();

    for (let i = 0; i < numMessages; i++) {
        const sender = seededRandom() > 0.4 ? 'me' : 'other';
        const text = messageTemplates[Math.floor(seededRandom() * messageTemplates.length)];
        const messageDate = new Date(today.getTime() - (numMessages - i) * (seededRandom() * 5) * 60 * 60 * 1000);

        newMessages.push({
            id: `${convo.id}-${i}`,
            sender: sender,
            text: text,
            timestamp: messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: messageDate,
            type: 'text',
            status: sender === 'me' ? 'read' : undefined
        });
    }
    return newMessages;
};

const initialHubConversations: HubConversation[] = baseHubConversations.map(convo => ({
    ...convo,
    messages: generateUniqueMessages(convo)
}));


const ProtectedLayout = () => {
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [rightSidebarVariant, setRightSidebarVariant] = useState('default');
    const [activityFilter, setActivityFilter] = useState<string | null>(null);
    const [followedDomainsFilter, setFollowedDomainsFilter] = useState<string | null>(null);
    const [spotlightBrowseState, setSpotlightBrowseState] = useState<string | null>(null); // 'projects' or 'profiles'
    const [showPinnedHighlights, setShowPinnedHighlights] = useState(false);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [communityFilters, setCommunityFilters] = useState({ searchTerm: '', domains: [] as string[] });
    const [communityView, setCommunityView] = useState('leaderboard'); // 'leaderboard', 'my-communities', 'all'
    const [hubView, setHubView] = useState('welcome');
    const [hubRightSidebarView, setHubRightSidebarView] = useState('main');
    const [hubConversations, setHubConversations] = useState<HubConversation[]>(initialHubConversations);
    const [selectedHubConversation, setSelectedHubConversation] = useState<HubConversation | null>(null);
    const [goforitFilters, setGoforitFilters] = useState({
        company: '',
        skills: '',
        location: '',
        opportunityType: 'All',
        category: 'All',
        experienceLevel: 'All',
        searchTerm: '',
    });
    const [savedOfferIds, setSavedOfferIds] = useState<string[]>(['inv-new-1', 'gig-active-1', 'ft-new-1']);
    
    // Quick access content creation trigger
    const [uploadTriggerTarget, setUploadTriggerTarget] = useState<string | null>(null);

    const { isModalOpen, openModal } = useAIAssistant();

    const toggleSaveOffer = (offerId: string) => {
        setSavedOfferIds(prev =>
            prev.includes(offerId)
                ? prev.filter(id => id !== offerId)
                : [...prev, offerId]
        );
    };

    const handleUpdateHubConversation = (updatedConvo: HubConversation) => {
        setHubConversations(prev => prev.map(c => c.id === updatedConvo.id ? updatedConvo : c));
        setSelectedHubConversation(prev => (prev?.id === updatedConvo.id ? updatedConvo : prev));
    };

    const handleSelectHubConversation = (conversation: HubConversation | null) => {
        setSelectedHubConversation(conversation);
        if (conversation && conversation.unreadCount > 0) {
            setHubConversations(prevConvos =>
                prevConvos.map(c =>
                    c.id === conversation.id ? { ...c, unreadCount: 0 } : c
                )
            );
        }
    };

    const location = ReactRouterDOM.useLocation();
    const mainContentRef = useRef<HTMLElement>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const handleRefresh = useCallback(async () => {
        await new Promise(res => setTimeout(res, 1500));
        setRefreshKey(prev => prev + 1);
    }, []);

    const { state: pullState, pullDistance } = usePullToRefresh(mainContentRef, handleRefresh);


    useEffect(() => {
        if (mainContentRef.current) {
            mainContentRef.current.scrollTo(0, 0);
        }
    }, [location.pathname]);
    
    useEffect(() => {
        if (!location.pathname.startsWith('/hub')) {
            setHubView('welcome');
            setHubRightSidebarView('main');
            setSelectedHubConversation(null);
        }
    }, [location.pathname]);

    const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

    const resetHub = useCallback(() => {
        setHubView('welcome');
        setHubRightSidebarView('main');
        setSelectedHubConversation(null);
    }, []);

    const pageTitle = useMemo(() => {
        if (location.pathname.startsWith('/communities')) {
            return 'Communities';
        }
         if (location.pathname.startsWith('/profile')) {
            return 'Profile';
        }
        return pageTitles[location.pathname] || 'Invox';
    }, [location.pathname]);

    React.useEffect(() => {
        setActivityFilter(null);
        setFollowedDomainsFilter(null);
        setShowPinnedHighlights(false);
        if (rightSidebarVariant !== 'spotlight') {
            setSpotlightBrowseState(null);
        }
    }, [rightSidebarVariant]);

    return (
        <div className="min-h-screen flex bg-invox-dark text-white overflow-x-hidden">
            <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} resetHub={resetHub} />
            {/* lg:ml-64 matches when sidebar becomes permanently visible (lg breakpoint) */}
            <div className="flex-1 lg:ml-64 flex flex-col max-h-screen min-w-0">
                {/* Mobile-only Header */}
                <Header toggleSidebar={toggleSidebar} pageTitle={pageTitle} />

                {/* Main Content and Right Sidebar wrapper */}
                <div className="flex-1 flex overflow-hidden">
                    <main ref={mainContentRef} className="flex-1 overflow-y-auto no-scrollbar relative">
                        <PullToRefreshIndicator state={pullState} distance={pullDistance} />
                        <div className="max-w-5xl mx-auto py-4 md:py-6 px-4 sm:px-6 lg:px-8">
                            <ReactRouterDOM.Outlet context={{ 
                                setRightSidebarVariant, 
                                activityFilter, 
                                setActivityFilter, 
                                followedDomainsFilter, 
                                setFollowedDomainsFilter, 
                                spotlightBrowseState, 
                                setSpotlightBrowseState, 
                                showPinnedHighlights, 
                                setShowPinnedHighlights, 
                                goforitFilters, 
                                setGoforitFilters, 
                                refreshKey, 
                                savedOfferIds, 
                                toggleSaveOffer, 
                                communityFilters, 
                                setCommunityFilters, 
                                communityView, 
                                setCommunityView, 
                                hubView, 
                                setHubView, 
                                hubRightSidebarView, 
                                setHubRightSidebarView, 
                                hubConversations, 
                                selectedHubConversation, 
                                setSelectedHubConversation: handleSelectHubConversation, 
                                updateHubConversation: handleUpdateHubConversation,
                                uploadTriggerTarget,
                                setUploadTriggerTarget
                            }} />
                        </div>
                    </main>
                    <RightSidebar 
                        variant={rightSidebarVariant} 
                        activityFilter={activityFilter} 
                        setActivityFilter={setActivityFilter} 
                        followedDomainsFilter={followedDomainsFilter}
                        setFollowedDomainsFilter={setFollowedDomainsFilter}
                        spotlightBrowseState={spotlightBrowseState}
                        setSpotlightBrowseState={setSpotlightBrowseState}
                        showPinnedHighlights={showPinnedHighlights}
                        setShowPinnedHighlights={setShowPinnedHighlights}
                        goforitFilters={goforitFilters}
                        setGoforitFilters={setGoforitFilters}
                        setIsFilterModalOpen={setIsFilterModalOpen}
                        communityFilters={communityFilters}
                        setCommunityFilters={setCommunityFilters}
                        communityView={communityView}
                        setCommunityView={setCommunityView}
                        hubView={hubView}
                        setHubView={setHubView}
                        hubRightSidebarView={hubRightSidebarView}
                        setHubRightSidebarView={setHubRightSidebarView}
                        hubConversations={hubConversations}
                        selectedHubConversation={selectedHubConversation}
                        setSelectedHubConversation={handleSelectHubConversation}
                        setUploadTriggerTarget={setUploadTriggerTarget}
                    />
                </div>
            </div>
            <AIAssistantButton />
            <GoForItFilterModal
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                filters={goforitFilters}
                setFilters={setGoforitFilters}
            />
        </div>
    );
};

const AppRoutes = () => {
    const { currentUser, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-invox-dark">
                <div className="w-16 h-16 border-4 border-invox-red border-dashed rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <ReactRouterDOM.Routes>
            <ReactRouterDOM.Route path="/login" element={!currentUser ? <LoginPage /> : <ReactRouterDOM.Navigate to="/explore" />} />
            <ReactRouterDOM.Route path="/signup" element={!currentUser ? <SignupPage /> : <ReactRouterDOM.Navigate to="/explore" />} />
            
            <ReactRouterDOM.Route element={<ProtectedRoute />}>
                <ReactRouterDOM.Route path="/onboarding" element={<OnboardingPage />} />
                <ReactRouterDOM.Route path="/*" element={<MainAppRoutes />} />
            </ReactRouterDOM.Route>
        </ReactRouterDOM.Routes>
    );
};

const MainAppRoutes = () => (
    <ReactRouterDOM.Routes>
        <ReactRouterDOM.Route element={<ProtectedLayout />}>
            <ReactRouterDOM.Route path="/" element={<ReactRouterDOM.Navigate to="/explore" />} />
            <ReactRouterDOM.Route path="/explore" element={<ExplorePage />} />
            <ReactRouterDOM.Route path="/trendz" element={<TrendzPage />} />
            <ReactRouterDOM.Route path="/spotlight" element={<SpotlightPage />} />
            <ReactRouterDOM.Route path="/communities" element={<CommunitiesPage />} />
            <ReactRouterDOM.Route path="/hub" element={<HubPage />} />
            <ReactRouterDOM.Route path="/myspace" element={<MySpacePage />} />
            <ReactRouterDOM.Route path="/myspace/uploads" element={<UploadsPage />} />
            <ReactRouterDOM.Route path="/duppor" element={<ComingSoonPage pageName="Duppor" subtitle="16 days to go" />} />
            <ReactRouterDOM.Route path="/profile" element={<ProfilePage />} />
            <ReactRouterDOM.Route path="/settings" element={<SettingsPage />} />
            <ReactRouterDOM.Route path="/applications" element={<ApplicationStatusPage />} />
            <ReactRouterDOM.Route path="/saved-applications" element={<SavedApplicationsPage />} />
            <ReactRouterDOM.Route path="*" element={<ReactRouterDOM.Navigate to="/explore" />} />
        </ReactRouterDOM.Route>
        <ReactRouterDOM.Route path="/apply/:offerId" element={<ApplicationFormPage />} />
    </ReactRouterDOM.Routes>
)

const AIChatManager = () => {
    const { isModalOpen, closeModal } = useAIAssistant();
    if (!isModalOpen) return null;
    return <AIChatModal onClose={closeModal} />;
};


function App() {
  return (
    <ReactRouterDOM.HashRouter>
        <AuthProvider>
            <FilterProvider>
                <AIAssistantProvider>
                    <div id="main-app-wrapper">
                        <AppRoutes />
                    </div>
                    <AIChatManager />
                </AIAssistantProvider>
            </FilterProvider>
        </AuthProvider>
    </ReactRouterDOM.HashRouter>
  );
}

export default App;