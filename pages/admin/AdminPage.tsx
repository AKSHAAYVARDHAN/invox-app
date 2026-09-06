import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePlatformConfig } from '../../contexts/PlatformConfigContext';
import {
    PlatformSectionsConfig,
    SectionId,
    SectionStatus,
} from '../../types';
import { SECTION_KEYS, DEFAULT_SECTIONS_CONFIG } from '../../services/platformConfigService';

type AdminTab = 'sections' | 'overview' | 'settings';

interface StatusOption {
    value: SectionStatus;
    label: string;
}

const STATUS_OPTIONS: StatusOption[] = [
    { value: 'live', label: 'Live' },
    { value: 'development', label: 'Development' },
    { value: 'coming_soon', label: 'Coming soon' },
    { value: 'disabled', label: 'Disabled' },
];

/** Clean, minimal status dot and label */
const StatusIndicator: React.FC<{ status: SectionStatus }> = ({ status }) => {
    switch (status) {
        case 'live':
            return (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                    <span className="w-1.5 h-1.5 bg-emerald-400"></span>
                    Live
                </span>
            );
        case 'development':
            return (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400">
                    <span className="w-1.5 h-1.5 bg-amber-400"></span>
                    Development
                </span>
            );
        case 'coming_soon':
            return (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-400">
                    <span className="w-1.5 h-1.5 bg-sky-400"></span>
                    Coming soon
                </span>
            );
        case 'disabled':
        default:
            return (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                    <span className="w-1.5 h-1.5 bg-zinc-600"></span>
                    Disabled
                </span>
            );
    }
};

/** Sharp Invox-themed modern toggle switch */
const SharpSwitch: React.FC<{
    checked: boolean;
    onChange: () => void;
    label: string;
    description?: string;
    disabled?: boolean;
}> = ({ checked, onChange, label, description, disabled }) => {
    return (
        <div className="flex items-center justify-between gap-4 py-2.5">
            <div className="flex flex-col">
                <span className="text-sm font-medium text-zinc-200">{label}</span>
                {description && <span className="text-xs text-zinc-500 mt-0.5">{description}</span>}
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                disabled={disabled}
                onClick={onChange}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-none border transition-colors duration-150 ease-in-out focus:outline-none ${
                    checked
                        ? 'bg-white border-white'
                        : 'bg-zinc-900 border-zinc-700 hover:border-zinc-600'
                } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
                <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-none transition duration-150 ease-in-out ${
                        checked ? 'translate-x-6 bg-zinc-950' : 'translate-x-1 bg-zinc-400'
                    }`}
                />
            </button>
        </div>
    );
};

export const AdminPage: React.FC = () => {
    const { currentUser, userProfile } = useAuth();
    const { sections, loading, error: contextError, saveSections, resetToDefaults, getDefaultRoute } = usePlatformConfig();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<AdminTab>('sections');
    const [draftSections, setDraftSections] = useState<PlatformSectionsConfig>(sections);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    // Keep draft in sync with live sections when not dirty
    useEffect(() => {
        if (!hasUnsavedChanges) {
            setDraftSections(sections);
        }
    }, [sections, hasUnsavedChanges]);

    const handleToggleEnabled = (sectionId: SectionId) => {
        setDraftSections((prev) => ({
            ...prev,
            [sectionId]: {
                ...prev[sectionId],
                enabled: !prev[sectionId].enabled,
            },
        }));
        setHasUnsavedChanges(true);
        setSaveSuccess(false);
    };

    const handleToggleVisibility = (sectionId: SectionId) => {
        setDraftSections((prev) => ({
            ...prev,
            [sectionId]: {
                ...prev[sectionId],
                visibleToUsers: !prev[sectionId].visibleToUsers,
            },
        }));
        setHasUnsavedChanges(true);
        setSaveSuccess(false);
    };

    const handleStatusChange = (sectionId: SectionId, status: SectionStatus) => {
        setDraftSections((prev) => ({
            ...prev,
            [sectionId]: {
                ...prev[sectionId],
                status,
            },
        }));
        setHasUnsavedChanges(true);
        setSaveSuccess(false);
    };

    const handleApplyPreset = (presetName: string) => {
        let preset: PlatformSectionsConfig = { ...draftSections };

        if (presetName === 'focus_communities') {
            preset = {
                explore: { ...preset.explore, enabled: false, visibleToUsers: false },
                trendz: { ...preset.trendz, enabled: false, visibleToUsers: false },
                spotlight: { ...preset.spotlight, enabled: false, visibleToUsers: false },
                communities: { ...preset.communities, enabled: true, visibleToUsers: true, status: 'development' },
                hub: { ...preset.hub, enabled: false, visibleToUsers: false },
                mySpace: { ...preset.mySpace, enabled: false, visibleToUsers: false },
            };
            setStatusMessage('Applied preset: Communities only');
        } else if (presetName === 'focus_explore') {
            preset = {
                explore: { ...preset.explore, enabled: true, visibleToUsers: true, status: 'live' },
                trendz: { ...preset.trendz, enabled: false, visibleToUsers: false },
                spotlight: { ...preset.spotlight, enabled: false, visibleToUsers: false },
                communities: { ...preset.communities, enabled: false, visibleToUsers: false },
                hub: { ...preset.hub, enabled: false, visibleToUsers: false },
                mySpace: { ...preset.mySpace, enabled: false, visibleToUsers: false },
            };
            setStatusMessage('Applied preset: Explore only');
        } else if (presetName === 'all_live') {
            preset = {
                explore: { ...preset.explore, enabled: true, visibleToUsers: true, status: 'live' },
                trendz: { ...preset.trendz, enabled: false, visibleToUsers: false },
                spotlight: { ...preset.spotlight, enabled: false, visibleToUsers: false },
                communities: { ...preset.communities, enabled: false, visibleToUsers: false },
                hub: { ...preset.hub, enabled: true, visibleToUsers: true, status: 'live' },
                mySpace: { ...preset.mySpace, enabled: true, visibleToUsers: true, status: 'live' },
            };
            setStatusMessage('Applied preset: All live sections');
        } else if (presetName === 'default_all') {
            preset = { ...DEFAULT_SECTIONS_CONFIG };
            setStatusMessage('Applied preset: Reset all sections');
        }

        setDraftSections(preset);
        setHasUnsavedChanges(true);
        setSaveSuccess(false);
    };

    const handleSaveChanges = async () => {
        setSaving(true);
        setStatusMessage(null);
        try {
            await saveSections(draftSections);
            setHasUnsavedChanges(false);
            setSaveSuccess(true);
            setStatusMessage('Configuration saved successfully.');
            setTimeout(() => setSaveSuccess(false), 4000);
        } catch (err: any) {
            setStatusMessage(`Error saving changes: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDiscardDraft = () => {
        setDraftSections(sections);
        setHasUnsavedChanges(false);
        setStatusMessage('Unsaved changes discarded.');
    };

    const handleResetToSystemDefaults = async () => {
        if (window.confirm('Reset all sections to platform defaults?')) {
            setSaving(true);
            try {
                await resetToDefaults();
                setDraftSections(DEFAULT_SECTIONS_CONFIG);
                setHasUnsavedChanges(false);
                setSaveSuccess(true);
                setStatusMessage('Reset to default configuration.');
            } catch (err: any) {
                setStatusMessage(`Reset error: ${err.message}`);
            } finally {
                setSaving(false);
            }
        }
    };

    // Metrics
    const totalCount = SECTION_KEYS.length;
    const enabledCount = SECTION_KEYS.filter((k) => draftSections[k]?.enabled).length;
    const visibleCount = SECTION_KEYS.filter((k) => draftSections[k]?.enabled && draftSections[k]?.visibleToUsers).length;
    const hiddenCount = totalCount - visibleCount;
    const liveCount = SECTION_KEYS.filter((k) => draftSections[k]?.status === 'live').length;

    // Filtered keys
    const filteredSectionKeys = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return SECTION_KEYS;
        return SECTION_KEYS.filter((key) => {
            const sec = draftSections[key];
            if (!sec) return false;
            return (
                sec.name.toLowerCase().includes(query) ||
                sec.id.toLowerCase().includes(query) ||
                sec.path.toLowerCase().includes(query) ||
                (sec.description && sec.description.toLowerCase().includes(query))
            );
        });
    }, [draftSections, searchQuery]);

    return (
        <div className="min-h-screen bg-[#080808] text-zinc-100 font-sans antialiased flex">
            {/* Mobile Sidebar Overlay */}
            {isMobileSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileSidebarOpen(false)}
                />
            )}

            {/* FULL-HEIGHT LEFT SIDEBAR */}
            <aside
                className={`fixed top-0 left-0 h-full w-64 bg-[#080808] border-r border-zinc-800 z-50 flex flex-col justify-between p-4 transition-transform duration-200 ease-out lg:translate-x-0 ${
                    isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                {/* Top Section: Brand & Nav */}
                <div className="flex flex-col space-y-6">
                    {/* Brand Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white text-black font-mono font-bold text-xs flex items-center justify-center border border-zinc-400 rounded-none">
                                IX
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-base font-bold tracking-tight text-white font-mono uppercase">
                                        INVOX
                                    </h1>
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-none">
                                        ADMIN
                                    </span>
                                </div>
                                <p className="text-[11px] text-zinc-500 font-mono tracking-wider">
                                    Platform Control
                                </p>
                            </div>
                        </div>

                        {/* Mobile close button */}
                        <button
                            onClick={() => setIsMobileSidebarOpen(false)}
                            className="lg:hidden text-zinc-400 hover:text-white p-1.5 border border-zinc-800 rounded-none hover:bg-zinc-900"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Navigation Groups */}
                    <div className="space-y-6">
                        {/* Platform Group */}
                        <div>
                            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 px-3 mb-2">
                                Platform
                            </div>
                            <nav className="space-y-1">
                                <button
                                    onClick={() => {
                                        setActiveTab('sections');
                                        setIsMobileSidebarOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-none text-sm font-medium transition-all duration-150 border ${
                                        activeTab === 'sections'
                                            ? 'bg-zinc-900 text-white border-zinc-700 font-semibold'
                                            : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60 border-transparent hover:border-zinc-800'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h7" />
                                        </svg>
                                        <span>Sections</span>
                                    </div>
                                    <span className="text-xs font-mono text-zinc-500">{totalCount}</span>
                                </button>

                                <button
                                    onClick={() => {
                                        setActiveTab('overview');
                                        setIsMobileSidebarOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-none text-sm font-medium transition-all duration-150 border ${
                                        activeTab === 'overview'
                                            ? 'bg-zinc-900 text-white border-zinc-700 font-semibold'
                                            : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60 border-transparent hover:border-zinc-800'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                        <span>Overview</span>
                                    </div>
                                </button>
                            </nav>
                        </div>

                        {/* System Group */}
                        <div>
                            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 px-3 mb-2">
                                System
                            </div>
                            <nav className="space-y-1">
                                <button
                                    onClick={() => {
                                        setActiveTab('settings');
                                        setIsMobileSidebarOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-none text-sm font-medium transition-all duration-150 border ${
                                        activeTab === 'settings'
                                            ? 'bg-zinc-900 text-white border-zinc-700 font-semibold'
                                            : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60 border-transparent hover:border-zinc-800'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <span>Settings</span>
                                    </div>
                                </button>
                            </nav>
                        </div>
                    </div>

                    {/* Sharp Platform Status Widget */}
                    <div className="p-3.5 bg-[#0c0c0e] border border-zinc-800 rounded-none space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
                                Platform Status
                            </span>
                            <span className="w-2 h-2 bg-emerald-400"></span>
                        </div>
                        <div className="flex items-baseline justify-between text-xs font-mono">
                            <span className="text-zinc-400">Visibility</span>
                            <span className="text-white font-semibold">
                                {visibleCount} / {totalCount}
                            </span>
                        </div>
                        <div className="w-full bg-zinc-800 h-1 rounded-none overflow-hidden">
                            <div
                                className="bg-white h-full transition-all duration-300"
                                style={{ width: `${(visibleCount / totalCount) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Bottom Section: Admin Profile & Exit Button */}
                <div className="space-y-3 pt-4 border-t border-zinc-800">
                    {currentUser?.email && (
                        <div className="p-2.5 bg-[#0c0c0e] border border-zinc-800/80 rounded-none flex items-center gap-2.5">
                            <div className="w-6 h-6 bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono text-[11px] flex items-center justify-center shrink-0">
                                {currentUser.email.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-xs text-zinc-200 truncate font-medium">
                                    {currentUser.email}
                                </div>
                                <div className="text-[10px] text-zinc-500 font-mono uppercase">
                                    {userProfile?.role || 'Administrator'}
                                </div>
                            </div>
                        </div>
                    )}

                    <Link
                        to={getDefaultRoute()}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-none text-xs font-medium text-zinc-300 hover:text-white bg-[#0e0e11] hover:bg-zinc-800 border border-zinc-700 transition-colors"
                    >
                        <span>Exit Admin</span>
                        <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </Link>
                </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 min-w-0 lg:pl-64 flex flex-col min-h-screen">
                {/* Top Mobile Bar */}
                <header className="lg:hidden border-b border-zinc-800 bg-[#0c0c0e] px-4 py-3 flex items-center justify-between sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsMobileSidebarOpen(true)}
                            className="p-1.5 border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white rounded-none"
                            aria-label="Open sidebar"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <span className="font-bold tracking-tight text-white font-mono text-sm">INVOX ADMIN</span>
                    </div>

                    <Link
                        to={getDefaultRoute()}
                        className="text-xs px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-none"
                    >
                        Exit
                    </Link>
                </header>

                {/* Status Message Bar */}
                {statusMessage && (
                    <div className="bg-[#0e0e12] border-b border-zinc-800 px-6 py-3 text-xs transition-all">
                        <div className="max-w-6xl flex items-center justify-between text-zinc-300">
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-white"></span>
                                <span>{statusMessage}</span>
                            </div>
                            <button
                                onClick={() => setStatusMessage(null)}
                                className="text-zinc-500 hover:text-zinc-300 text-xs px-2 py-0.5 border border-zinc-800 rounded-none hover:bg-zinc-800"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                )}

                {/* Main Content Body */}
                <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* TAB 1: SECTIONS */}
                    {activeTab === 'sections' && (
                        <div className="space-y-6">
                            {/* Page Header & Save Bar */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
                                <div>
                                    <h1 className="text-2xl font-semibold text-white tracking-tight">Sections</h1>
                                    <p className="text-sm text-zinc-400 mt-1">
                                        Control which Invox sections are available to users.
                                    </p>
                                </div>

                                {/* Save Toolbar */}
                                <div className="flex items-center gap-2.5">
                                    {hasUnsavedChanges && (
                                        <button
                                            onClick={handleDiscardDraft}
                                            disabled={saving}
                                            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white bg-transparent border border-zinc-800 hover:border-zinc-700 rounded-none transition-colors"
                                        >
                                            Discard
                                        </button>
                                    )}
                                    <button
                                        onClick={handleSaveChanges}
                                        disabled={saving || !hasUnsavedChanges}
                                        className={`px-5 py-2 text-xs font-medium rounded-none border transition-all flex items-center gap-2 ${
                                            hasUnsavedChanges
                                                ? 'bg-white text-zinc-950 border-white hover:bg-zinc-200 font-semibold'
                                                : 'bg-[#0d0d10] border-zinc-800 text-zinc-600 cursor-not-allowed'
                                        }`}
                                    >
                                        {saving ? (
                                            <>
                                                <span className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-zinc-900 animate-spin"></span>
                                                <span>Saving...</span>
                                            </>
                                        ) : saveSuccess ? (
                                            <>
                                                <span>✓ Saved</span>
                                            </>
                                        ) : (
                                            <span>Save changes</span>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Development Presets Bar (Sharp) */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#0c0c0e] border border-zinc-800 rounded-none">
                                <span className="text-xs font-medium text-zinc-400 font-mono">
                                    Development presets
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => handleApplyPreset('focus_communities')}
                                        className="px-3 py-1.5 text-xs font-medium rounded-none bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
                                    >
                                        Communities only
                                    </button>
                                    <button
                                        onClick={() => handleApplyPreset('focus_explore')}
                                        className="px-3 py-1.5 text-xs font-medium rounded-none bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
                                    >
                                        Explore only
                                    </button>
                                    <button
                                        onClick={() => handleApplyPreset('all_live')}
                                        className="px-3 py-1.5 text-xs font-medium rounded-none bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
                                    >
                                        All live
                                    </button>
                                    <button
                                        onClick={() => handleApplyPreset('default_all')}
                                        className="px-3 py-1.5 text-xs font-medium rounded-none bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                                    >
                                        Reset
                                    </button>
                                </div>
                            </div>

                            {/* Sharp Search Bar */}
                            <div className="relative">
                                <svg
                                    className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                    />
                                </svg>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search sections..."
                                    className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-none pl-10 pr-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>

                            {/* Section Cards (Sharp Borders) */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                {filteredSectionKeys.map((key) => {
                                    const section = draftSections[key];
                                    if (!section) return null;

                                    return (
                                        <div
                                            key={section.id}
                                            className="bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-700 rounded-none p-6 transition-colors duration-150 flex flex-col justify-between"
                                        >
                                            <div>
                                                {/* Header: Section name + Status */}
                                                <div className="flex items-start justify-between gap-3 mb-2">
                                                    <div>
                                                        <h3 className="text-base font-semibold text-white tracking-tight">
                                                            {section.name}
                                                        </h3>
                                                        <span className="font-mono text-xs text-zinc-500">
                                                            {section.path}
                                                        </span>
                                                    </div>
                                                    <StatusIndicator status={section.status} />
                                                </div>

                                                {/* Description */}
                                                <p className="text-sm text-zinc-400 leading-relaxed mt-2 mb-5">
                                                    {section.description || DEFAULT_SECTIONS_CONFIG[key].description}
                                                </p>

                                                {/* Status Selector with Sharp Buttons */}
                                                <div className="mb-4">
                                                    <span className="text-xs font-medium text-zinc-400 block mb-2 font-mono">
                                                        Status
                                                    </span>
                                                    <div className="grid grid-cols-4 gap-1 p-1 bg-zinc-950 border border-zinc-800 rounded-none">
                                                        {STATUS_OPTIONS.map((opt) => {
                                                            const isSelected = section.status === opt.value;
                                                            return (
                                                                <button
                                                                    key={opt.value}
                                                                    type="button"
                                                                    onClick={() => handleStatusChange(key, opt.value)}
                                                                    className={`py-1 text-xs font-medium rounded-none transition-all ${
                                                                        isSelected
                                                                            ? 'bg-zinc-800 text-white shadow-none font-semibold'
                                                                            : 'text-zinc-500 hover:text-zinc-300'
                                                                    }`}
                                                                >
                                                                    {opt.label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Toggles & Manage Link */}
                                            <div className="pt-4 border-t border-zinc-800/80 divide-y divide-zinc-800/50">
                                                <SharpSwitch
                                                    checked={section.visibleToUsers}
                                                    onChange={() => handleToggleVisibility(key)}
                                                    label="User Visibility"
                                                    description="Shows in user navigation"
                                                />
                                                <SharpSwitch
                                                    checked={section.enabled}
                                                    onChange={() => handleToggleEnabled(key)}
                                                    label="Module Status"
                                                    description="Active section processor"
                                                />

                                                <div className="pt-3 flex justify-end">
                                                    <Link
                                                        to={section.path}
                                                        className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white px-2.5 py-1 border border-transparent hover:border-zinc-800 rounded-none transition-colors"
                                                    >
                                                        <span>Manage</span>
                                                        <span>→</span>
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* TAB 2: OVERVIEW */}
                    {activeTab === 'overview' && (
                        <div className="space-y-8">
                            <div>
                                <h1 className="text-2xl font-semibold text-white tracking-tight">Overview</h1>
                                <p className="text-sm text-zinc-400 mt-1">
                                    Summary of platform section visibility and state.
                                </p>
                            </div>

                            {/* Sharp Metric Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                <div className="p-5 rounded-none bg-[#0c0c0e] border border-zinc-800">
                                    <span className="text-xs font-medium text-zinc-500 block font-mono">Total sections</span>
                                    <span className="text-2xl font-semibold text-white mt-1 block">{totalCount}</span>
                                </div>
                                <div className="p-5 rounded-none bg-[#0c0c0e] border border-zinc-800">
                                    <span className="text-xs font-medium text-zinc-500 block font-mono">User Visibility</span>
                                    <span className="text-2xl font-semibold text-white mt-1 block">
                                        {visibleCount}
                                    </span>
                                </div>
                                <div className="p-5 rounded-none bg-[#0c0c0e] border border-zinc-800">
                                    <span className="text-xs font-medium text-zinc-500 block font-mono">Hidden from users</span>
                                    <span className="text-2xl font-semibold text-zinc-400 mt-1 block">
                                        {hiddenCount}
                                    </span>
                                </div>
                                <div className="p-5 rounded-none bg-[#0c0c0e] border border-zinc-800">
                                    <span className="text-xs font-medium text-zinc-500 block font-mono">Live phase</span>
                                    <span className="text-2xl font-semibold text-emerald-400 mt-1 block">{liveCount}</span>
                                </div>
                            </div>

                            {/* Section Status Table (Sharp Borders) */}
                            <div className="rounded-none bg-[#0c0c0e] border border-zinc-800 overflow-hidden">
                                <div className="p-5 border-b border-zinc-800">
                                    <h2 className="text-base font-semibold text-white">Section directory</h2>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead>
                                            <tr className="border-b border-zinc-800 text-xs text-zinc-500 font-mono">
                                                <th className="py-3 px-5 font-medium">Section</th>
                                                <th className="py-3 px-5 font-medium">Route</th>
                                                <th className="py-3 px-5 font-medium">Status</th>
                                                <th className="py-3 px-5 font-medium">Module Status</th>
                                                <th className="py-3 px-5 font-medium">User Visibility</th>
                                                <th className="py-3 px-5 font-medium text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-800">
                                            {SECTION_KEYS.map((k) => {
                                                const s = draftSections[k];
                                                if (!s) return null;

                                                return (
                                                    <tr key={s.id} className="hover:bg-zinc-900/40 transition-colors">
                                                        <td className="py-3.5 px-5 font-medium text-white">{s.name}</td>
                                                        <td className="py-3.5 px-5 font-mono text-xs text-zinc-400">
                                                            {s.path}
                                                        </td>
                                                        <td className="py-3.5 px-5">
                                                            <StatusIndicator status={s.status} />
                                                        </td>
                                                        <td className="py-3.5 px-5">
                                                            <span
                                                                className={`text-xs font-medium font-mono ${
                                                                    s.enabled ? 'text-zinc-200' : 'text-zinc-500'
                                                                }`}
                                                            >
                                                                {s.enabled ? 'ON' : 'OFF'}
                                                            </span>
                                                        </td>
                                                        <td className="py-3.5 px-5">
                                                            <span
                                                                className={`text-xs font-medium font-mono ${
                                                                    s.visibleToUsers ? 'text-emerald-400' : 'text-zinc-500'
                                                                }`}
                                                            >
                                                                {s.visibleToUsers ? 'ON' : 'OFF'}
                                                            </span>
                                                        </td>
                                                        <td className="py-3.5 px-5 text-right">
                                                            <Link
                                                                to={s.path}
                                                                className="text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                                                            >
                                                                Manage →
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: SETTINGS */}
                    {activeTab === 'settings' && (
                        <div className="space-y-8 max-w-3xl">
                            <div>
                                <h1 className="text-2xl font-semibold text-white tracking-tight">Platform settings</h1>
                                <p className="text-sm text-zinc-400 mt-1">
                                    Security verification and platform configuration settings.
                                </p>
                            </div>

                            {/* Administrator Identity (Sharp) */}
                            <div className="p-6 rounded-none bg-[#0c0c0e] border border-zinc-800">
                                <h2 className="text-base font-semibold text-white mb-4">Administrator account</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-xs text-zinc-500 block font-mono">Email</span>
                                        <span className="font-medium text-zinc-200">{currentUser?.email || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-xs text-zinc-500 block font-mono">Assigned role</span>
                                        <span className="font-medium text-emerald-400 capitalize">
                                            {userProfile?.role || 'Administrator'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-xs text-zinc-500 block font-mono">Configuration collection</span>
                                        <span className="font-mono text-xs text-zinc-400">platformConfig/sections</span>
                                    </div>
                                    <div>
                                        <span className="text-xs text-zinc-500 block font-mono">Account UID</span>
                                        <span className="font-mono text-xs text-zinc-400 truncate block">
                                            {currentUser?.uid || 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Security Architecture (Sharp) */}
                            <div className="p-6 rounded-none bg-[#0c0c0e] border border-zinc-800">
                                <h2 className="text-base font-semibold text-white mb-2">Access & security rules</h2>
                                <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
                                    Platform configuration documents in Firestore are guarded by strict rule verification. Only verified administrator accounts can write to these configurations.
                                </p>
                                <div className="space-y-3 text-xs">
                                    <div className="p-3.5 rounded-none bg-zinc-950 border border-zinc-800">
                                        <span className="font-medium text-zinc-200 block mb-1">Firestore Security Rules</span>
                                        <p className="text-zinc-400">
                                            The <code className="text-zinc-300 font-mono">isAdmin()</code> rule requires the request author to have verified administrator status before any document write is permitted.
                                        </p>
                                    </div>
                                    <div className="p-3.5 rounded-none bg-zinc-950 border border-zinc-800">
                                        <span className="font-medium text-zinc-200 block mb-1">Route Protection</span>
                                        <p className="text-zinc-400">
                                            The <code className="text-zinc-300 font-mono">&lt;AdminRoute&gt;</code> guard restricts dashboard access to authenticated administrators only.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Reset Section (Sharp) */}
                            <div className="p-6 rounded-none bg-[#0c0c0e] border border-zinc-800">
                                <h2 className="text-base font-semibold text-white mb-2">Reset platform configuration</h2>
                                <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
                                    Reset all platform section availability and status back to the default deployment settings in Firestore.
                                </p>
                                <button
                                    onClick={handleResetToSystemDefaults}
                                    disabled={saving}
                                    className="px-4 py-2 text-xs font-medium rounded-none text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors"
                                >
                                    Reset to defaults
                                </button>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default AdminPage;
