import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePlatformConfig } from '../../contexts/PlatformConfigContext';
import {
    PlatformSectionsConfig,
    SectionConfig,
    SectionId,
    SectionStatus,
} from '../../types';
import { SECTION_KEYS, DEFAULT_SECTIONS_CONFIG } from '../../services/platformConfigService';

type AdminTab = 'dashboard' | 'sections' | 'settings';

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

    // Keep draft in sync with live sections when not dirty
    useEffect(() => {
        if (!hasUnsavedChanges) {
            setDraftSections(sections);
        }
    }, [sections, hasUnsavedChanges]);

    const handleToggleEnabled = (sectionId: SectionId) => {
        setDraftSections((prev) => {
            const next = {
                ...prev,
                [sectionId]: {
                    ...prev[sectionId],
                    enabled: !prev[sectionId].enabled,
                },
            };
            return next;
        });
        setHasUnsavedChanges(true);
        setSaveSuccess(false);
    };

    const handleToggleVisibility = (sectionId: SectionId) => {
        setDraftSections((prev) => {
            const next = {
                ...prev,
                [sectionId]: {
                    ...prev[sectionId],
                    visibleToUsers: !prev[sectionId].visibleToUsers,
                },
            };
            return next;
        });
        setHasUnsavedChanges(true);
        setSaveSuccess(false);
    };

    const handleStatusChange = (sectionId: SectionId, status: SectionStatus) => {
        setDraftSections((prev) => {
            const next = {
                ...prev,
                [sectionId]: {
                    ...prev[sectionId],
                    status,
                },
            };
            return next;
        });
        setHasUnsavedChanges(true);
        setSaveSuccess(false);
    };

    const handleApplyPreset = (presetName: string) => {
        let preset: PlatformSectionsConfig = { ...draftSections };

        if (presetName === 'focus_communities') {
            // Explore OFF, Trendz OFF, Spotlight OFF, Communities ON, Hub OFF, My Space OFF
            preset = {
                explore: { ...preset.explore, enabled: false, visibleToUsers: false },
                trendz: { ...preset.trendz, enabled: false, visibleToUsers: false },
                spotlight: { ...preset.spotlight, enabled: false, visibleToUsers: false },
                communities: { ...preset.communities, enabled: true, visibleToUsers: true, status: 'development' },
                hub: { ...preset.hub, enabled: false, visibleToUsers: false },
                mySpace: { ...preset.mySpace, enabled: false, visibleToUsers: false },
            };
            setStatusMessage('Applied preset: FOCUS_COMMUNITIES (Only Communities enabled & visible)');
        } else if (presetName === 'focus_explore') {
            preset = {
                explore: { ...preset.explore, enabled: true, visibleToUsers: true, status: 'live' },
                trendz: { ...preset.trendz, enabled: false, visibleToUsers: false },
                spotlight: { ...preset.spotlight, enabled: false, visibleToUsers: false },
                communities: { ...preset.communities, enabled: false, visibleToUsers: false },
                hub: { ...preset.hub, enabled: false, visibleToUsers: false },
                mySpace: { ...preset.mySpace, enabled: false, visibleToUsers: false },
            };
            setStatusMessage('Applied preset: FOCUS_EXPLORE (Only Explore enabled & visible)');
        } else if (presetName === 'all_live') {
            preset = {
                explore: { ...preset.explore, enabled: true, visibleToUsers: true, status: 'live' },
                trendz: { ...preset.trendz, enabled: false, visibleToUsers: false },
                spotlight: { ...preset.spotlight, enabled: false, visibleToUsers: false },
                communities: { ...preset.communities, enabled: false, visibleToUsers: false },
                hub: { ...preset.hub, enabled: true, visibleToUsers: true, status: 'live' },
                mySpace: { ...preset.mySpace, enabled: true, visibleToUsers: true, status: 'live' },
            };
            setStatusMessage('Applied preset: ALL_LIVE (Explore, Hub, My Space enabled)');
        } else if (presetName === 'default_all') {
            preset = { ...DEFAULT_SECTIONS_CONFIG };
            setStatusMessage('Applied preset: DEFAULT_SCHEMA (All 6 sections enabled with initial roles)');
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
            setStatusMessage('Platform section configuration successfully synced to Firestore.');
            setTimeout(() => setSaveSuccess(false), 4000);
        } catch (err: any) {
            setStatusMessage(`Error saving to Firestore: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDiscardDraft = () => {
        setDraftSections(sections);
        setHasUnsavedChanges(false);
        setStatusMessage('Unsaved draft reverted to current live configuration.');
    };

    const handleResetToSystemDefaults = async () => {
        if (window.confirm('Are you sure you want to reset all 6 sections to system defaults in Firestore?')) {
            setSaving(true);
            try {
                await resetToDefaults();
                setDraftSections(DEFAULT_SECTIONS_CONFIG);
                setHasUnsavedChanges(false);
                setSaveSuccess(true);
                setStatusMessage('System default configuration restored and saved.');
            } catch (err: any) {
                setStatusMessage(`Reset error: ${err.message}`);
            } finally {
                setSaving(false);
            }
        }
    };

    // Calculate metrics
    const totalCount = SECTION_KEYS.length;
    const enabledCount = SECTION_KEYS.filter((k) => draftSections[k]?.enabled).length;
    const visibleCount = SECTION_KEYS.filter((k) => draftSections[k]?.enabled && draftSections[k]?.visibleToUsers).length;
    const liveCount = SECTION_KEYS.filter((k) => draftSections[k]?.status === 'live').length;
    const devCount = SECTION_KEYS.filter((k) => draftSections[k]?.status === 'development').length;
    const comingSoonCount = SECTION_KEYS.filter((k) => draftSections[k]?.status === 'coming_soon').length;

    const visibleList = SECTION_KEYS.filter((k) => draftSections[k]?.enabled && draftSections[k]?.visibleToUsers).map(
        (k) => draftSections[k]?.name
    );
    const hiddenList = SECTION_KEYS.filter((k) => !draftSections[k]?.enabled || !draftSections[k]?.visibleToUsers).map(
        (k) => draftSections[k]?.name
    );

    return (
        <div className="min-h-screen bg-[#070709] text-zinc-300 font-sans selection:bg-zinc-800">
            {/* Top Command Bar */}
            <header className="border-b border-zinc-800/90 bg-[#0c0c0f] sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-none animate-pulse"></div>
                            <span className="font-mono text-xs font-bold text-white tracking-widest uppercase">
                                INVOX // ADMIN_CONTROL_CENTER
                            </span>
                        </div>
                        <span className="hidden md:inline-block px-2 py-0.5 bg-zinc-800/80 border border-zinc-700 text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                            RBAC // OPERATOR: {currentUser?.email || 'ADMIN'}
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            to={getDefaultRoute()}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-200 uppercase tracking-wider transition-colors"
                        >
                            <span>← Exit to Invox App</span>
                        </Link>
                    </div>
                </div>

                {/* Subnav Navigation */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between border-t border-zinc-800/60 text-xs font-mono">
                    <div className="flex gap-1">
                        <button
                            onClick={() => setActiveTab('sections')}
                            className={`px-4 py-2.5 border-b-2 uppercase tracking-wider transition-colors ${
                                activeTab === 'sections'
                                    ? 'border-emerald-500 text-white font-bold bg-zinc-900/50'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
                            }`}
                        >
                            [01] Sections Management
                        </button>
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={`px-4 py-2.5 border-b-2 uppercase tracking-wider transition-colors ${
                                activeTab === 'dashboard'
                                    ? 'border-emerald-500 text-white font-bold bg-zinc-900/50'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
                            }`}
                        >
                            [02] Overview & Telemetry
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`px-4 py-2.5 border-b-2 uppercase tracking-wider transition-colors ${
                                activeTab === 'settings'
                                    ? 'border-emerald-500 text-white font-bold bg-zinc-900/50'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
                            }`}
                        >
                            [03] System & Security
                        </button>
                    </div>

                    <div className="hidden sm:flex items-center gap-2 text-[11px] text-zinc-500">
                        <span>FIRESTORE:</span>
                        <span className="text-zinc-300 font-bold">platformConfig/sections</span>
                    </div>
                </div>
            </header>

            {/* Notification / Status Bar */}
            {statusMessage && (
                <div
                    className={`border-b text-xs font-mono px-4 py-2 transition-all flex items-center justify-between ${
                        statusMessage.includes('Error')
                            ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                            : 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                    }`}
                >
                    <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
                        <span>{statusMessage}</span>
                        <button onClick={() => setStatusMessage(null)} className="text-zinc-400 hover:text-white">
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* TAB 1: SECTIONS MANAGEMENT */}
                {activeTab === 'sections' && (
                    <div className="space-y-6">
                        {/* Control Bar & Action Header */}
                        <div className="bg-[#0d0d10] border border-zinc-800 p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-base sm:text-lg font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                    <span>// SECTION_AVAILABILITY_MATRIX</span>
                                    {hasUnsavedChanges && (
                                        <span className="text-[10px] px-2 py-0.5 bg-amber-950/80 border border-amber-800 text-amber-300">
                                            UNSAVED CHANGES PENDING
                                        </span>
                                    )}
                                </h1>
                                <p className="text-xs text-zinc-400 font-mono mt-1">
                                    Configure visibility, module enablement, and development phases. All changes directly control user navigation and routing.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2.5">
                                {hasUnsavedChanges && (
                                    <button
                                        onClick={handleDiscardDraft}
                                        disabled={saving}
                                        className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-400 hover:text-white transition-colors"
                                    >
                                        Discard Changes
                                    </button>
                                )}
                                <button
                                    onClick={handleSaveChanges}
                                    disabled={saving || !hasUnsavedChanges}
                                    className={`px-5 py-2 text-xs font-mono font-bold uppercase tracking-wider border transition-all flex items-center gap-2 ${
                                        hasUnsavedChanges
                                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-950/50'
                                            : 'bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed'
                                    }`}
                                >
                                    {saving ? (
                                        <>
                                            <span className="w-3 h-3 border-2 border-zinc-400 border-t-white rounded-none animate-spin"></span>
                                            <span>SAVING TO FIRESTORE...</span>
                                        </>
                                    ) : saveSuccess ? (
                                        <span>✓ SAVED & SYNCED</span>
                                    ) : (
                                        <span>SAVE CONFIGURATION</span>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Presets Bar */}
                        <div className="bg-[#0b0b0e] border border-zinc-800/80 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
                            <span className="text-zinc-400 uppercase tracking-wider text-[11px] font-bold">
                                // RAPID_DEVELOPMENT_PRESETS:
                            </span>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => handleApplyPreset('focus_communities')}
                                    className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-[11px] transition-colors"
                                    title="Explore OFF, Trendz OFF, Spotlight OFF, Communities ON, Hub OFF, My Space OFF"
                                >
                                    Focus: Communities Only
                                </button>
                                <button
                                    onClick={() => handleApplyPreset('focus_explore')}
                                    className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-[11px] transition-colors"
                                >
                                    Focus: Explore Only
                                </button>
                                <button
                                    onClick={() => handleApplyPreset('all_live')}
                                    className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-[11px] transition-colors"
                                >
                                    All Live Sections
                                </button>
                                <button
                                    onClick={() => handleApplyPreset('default_all')}
                                    className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-[11px] transition-colors"
                                >
                                    Reset All Defaults
                                </button>
                            </div>
                        </div>

                        {/* Real-time Normal User Simulation Box */}
                        <div className="bg-[#0e0e13] border border-zinc-800 p-4 font-mono text-xs">
                            <div className="flex items-center gap-2 mb-2 text-zinc-400">
                                <div className="w-2 h-2 rounded-none bg-cyan-400"></div>
                                <span className="font-bold uppercase tracking-wider">LIVE_AUDIT // NORMAL USER EXPERIENCE:</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                                <div className="border border-emerald-900/50 bg-emerald-950/20 p-3">
                                    <span className="text-emerald-400 font-bold block mb-1">
                                        ✓ Visible & Accessible to Normal Users ({visibleList.length}):
                                    </span>
                                    <span className="text-zinc-300">
                                        {visibleList.length > 0 ? visibleList.join(', ') : 'None (All sections currently hidden)'}
                                    </span>
                                </div>
                                <div className="border border-zinc-800 bg-zinc-950/40 p-3">
                                    <span className="text-zinc-500 font-bold block mb-1">
                                        ✕ Hidden / Inaccessible to Normal Users ({hiddenList.length}):
                                    </span>
                                    <span className="text-zinc-400">
                                        {hiddenList.length > 0 ? hiddenList.join(', ') : 'None (All sections visible)'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* The Six Section Cards Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {SECTION_KEYS.map((key) => {
                                const section = draftSections[key];
                                if (!section) return null;

                                const isNormalUserVisible = section.enabled && section.visibleToUsers;

                                return (
                                    <div
                                        key={section.id}
                                        className={`bg-[#0d0d11] border transition-all p-5 font-mono flex flex-col justify-between ${
                                            isNormalUserVisible
                                                ? 'border-zinc-700/80 shadow-md shadow-black/40'
                                                : 'border-zinc-800/60 opacity-90'
                                        }`}
                                    >
                                        {/* Card Header */}
                                        <div>
                                            <div className="flex items-start justify-between gap-2 pb-3 border-b border-zinc-800/80">
                                                <div>
                                                    <div className="flex items-center gap-2.5">
                                                        <h3 className="text-base font-bold text-white tracking-wider">
                                                            {section.name}
                                                        </h3>
                                                        <span className="text-[10px] px-2 py-0.5 bg-zinc-900 border border-zinc-700 text-zinc-400">
                                                            id: {section.id}
                                                        </span>
                                                    </div>
                                                    <span className="text-[11px] text-zinc-500 mt-0.5 block">
                                                        Route: {section.path}
                                                    </span>
                                                </div>

                                                {/* Normal User Access Pill */}
                                                <div className="text-right">
                                                    {isNormalUserVisible ? (
                                                        <span className="inline-block px-2.5 py-1 bg-emerald-950/60 border border-emerald-700 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                                                            ● USERS: VISIBLE
                                                        </span>
                                                    ) : (
                                                        <span className="inline-block px-2.5 py-1 bg-zinc-900 border border-zinc-700 text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                                                            ○ USERS: HIDDEN
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Description */}
                                            <p className="text-xs text-zinc-400 mt-3 mb-4 leading-relaxed">
                                                {section.description || DEFAULT_SECTIONS_CONFIG[key].description}
                                            </p>

                                            {/* Status Selector */}
                                            <div className="mb-4">
                                                <label className="text-[11px] text-zinc-400 uppercase tracking-wider block mb-2 font-bold">
                                                    Development Phase / Status:
                                                </label>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                                    {(['live', 'development', 'coming_soon', 'disabled'] as SectionStatus[]).map(
                                                        (statusOption) => {
                                                            const isCurrent = section.status === statusOption;
                                                            let colorClasses = '';

                                                            if (statusOption === 'live') {
                                                                colorClasses = isCurrent
                                                                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 font-bold'
                                                                    : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-300';
                                                            } else if (statusOption === 'development') {
                                                                colorClasses = isCurrent
                                                                    ? 'bg-amber-950/80 border-amber-500 text-amber-300 font-bold'
                                                                    : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-300';
                                                            } else if (statusOption === 'coming_soon') {
                                                                colorClasses = isCurrent
                                                                    ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 font-bold'
                                                                    : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-300';
                                                            } else {
                                                                colorClasses = isCurrent
                                                                    ? 'bg-rose-950/80 border-rose-500 text-rose-300 font-bold'
                                                                    : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-300';
                                                            }

                                                            return (
                                                                <button
                                                                    key={statusOption}
                                                                    type="button"
                                                                    onClick={() => handleStatusChange(key, statusOption)}
                                                                    className={`py-1.5 px-2 text-[10px] uppercase tracking-wider border text-center transition-all ${colorClasses}`}
                                                                >
                                                                    {statusOption.replace('_', ' ')}
                                                                </button>
                                                            );
                                                        }
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Toggles & Footer */}
                                        <div className="pt-4 border-t border-zinc-800/80 space-y-3">
                                            {/* Toggle 1: Enabled */}
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <span className="text-xs text-zinc-200 font-bold uppercase tracking-wider block">
                                                        Module Enabled
                                                    </span>
                                                    <span className="text-[10px] text-zinc-500">
                                                        Master switch for module code and processing
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleEnabled(key)}
                                                    className={`px-3 py-1 text-xs uppercase tracking-wider border transition-colors ${
                                                        section.enabled
                                                            ? 'bg-emerald-950/70 border-emerald-600 text-emerald-300 font-bold'
                                                            : 'bg-zinc-900 border-zinc-700 text-zinc-500'
                                                    }`}
                                                >
                                                    {section.enabled ? '[ENABLED]' : '[DISABLED]'}
                                                </button>
                                            </div>

                                            {/* Toggle 2: Visible to Users */}
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <span className="text-xs text-zinc-200 font-bold uppercase tracking-wider block">
                                                        Visible to Normal Users
                                                    </span>
                                                    <span className="text-[10px] text-zinc-500">
                                                        Renders in sidebar navigation and permits direct user routing
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleVisibility(key)}
                                                    className={`px-3 py-1 text-xs uppercase tracking-wider border transition-colors ${
                                                        section.visibleToUsers
                                                            ? 'bg-emerald-950/70 border-emerald-600 text-emerald-300 font-bold'
                                                            : 'bg-zinc-900 border-zinc-700 text-zinc-500'
                                                    }`}
                                                >
                                                    {section.visibleToUsers ? '[VISIBLE]' : '[HIDDEN]'}
                                                </button>
                                            </div>

                                            {/* Section Direct Test Link for Admin */}
                                            <div className="pt-2 flex justify-end">
                                                <Link
                                                    to={section.path}
                                                    className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                                                >
                                                    <span>Inspect {section.name} Section →</span>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* TAB 2: OVERVIEW & TELEMETRY */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-6">
                        {/* Metrics Bar */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
                            <div className="bg-[#0d0d10] border border-zinc-800 p-4">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Total Modules</span>
                                <span className="text-2xl font-bold text-white mt-1 block">{totalCount}</span>
                            </div>
                            <div className="bg-[#0d0d10] border border-zinc-800 p-4">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Enabled Modules</span>
                                <span className="text-2xl font-bold text-white mt-1 block">{enabledCount} / {totalCount}</span>
                            </div>
                            <div className="bg-[#0d0d10] border border-emerald-900/60 bg-emerald-950/10 p-4">
                                <span className="text-[10px] text-emerald-400 uppercase tracking-wider block">Normal User Visible</span>
                                <span className="text-2xl font-bold text-emerald-300 mt-1 block">{visibleCount} / {totalCount}</span>
                            </div>
                            <div className="bg-[#0d0d10] border border-zinc-800 p-4">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Phase: Live</span>
                                <span className="text-2xl font-bold text-emerald-400 mt-1 block">{liveCount}</span>
                            </div>
                            <div className="bg-[#0d0d10] border border-zinc-800 p-4">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Phase: Development</span>
                                <span className="text-2xl font-bold text-amber-400 mt-1 block">{devCount}</span>
                            </div>
                            <div className="bg-[#0d0d10] border border-zinc-800 p-4">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Phase: Coming Soon</span>
                                <span className="text-2xl font-bold text-cyan-400 mt-1 block">{comingSoonCount}</span>
                            </div>
                        </div>

                        {/* Section Status Matrix Table */}
                        <div className="bg-[#0d0d10] border border-zinc-800 p-6 font-mono">
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
                                // COMPONENT_STATUS_TELEMETRY
                            </h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-zinc-800 text-zinc-500 text-[10px] uppercase tracking-wider">
                                            <th className="py-2.5 px-3">Module</th>
                                            <th className="py-2.5 px-3">Path</th>
                                            <th className="py-2.5 px-3">Phase Status</th>
                                            <th className="py-2.5 px-3">Master Switch</th>
                                            <th className="py-2.5 px-3">User Visibility</th>
                                            <th className="py-2.5 px-3">Access State</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/60">
                                        {SECTION_KEYS.map((k) => {
                                            const s = draftSections[k];
                                            if (!s) return null;
                                            const isVisible = s.enabled && s.visibleToUsers;

                                            return (
                                                <tr key={s.id} className="hover:bg-zinc-900/30">
                                                    <td className="py-3 px-3 font-bold text-white">{s.name}</td>
                                                    <td className="py-3 px-3 text-zinc-400">{s.path}</td>
                                                    <td className="py-3 px-3">
                                                        <span
                                                            className={`px-2 py-0.5 text-[10px] border uppercase tracking-wider ${
                                                                s.status === 'live'
                                                                    ? 'border-emerald-800 text-emerald-400 bg-emerald-950/30'
                                                                    : s.status === 'development'
                                                                    ? 'border-amber-800 text-amber-400 bg-amber-950/30'
                                                                    : s.status === 'coming_soon'
                                                                    ? 'border-cyan-800 text-cyan-400 bg-cyan-950/30'
                                                                    : 'border-zinc-800 text-zinc-500 bg-zinc-900/30'
                                                            }`}
                                                        >
                                                            {s.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        {s.enabled ? (
                                                            <span className="text-emerald-400 font-bold">ON</span>
                                                        ) : (
                                                            <span className="text-zinc-500">OFF</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        {s.visibleToUsers ? (
                                                            <span className="text-emerald-400 font-bold">ON</span>
                                                        ) : (
                                                            <span className="text-zinc-500">OFF</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        {isVisible ? (
                                                            <span className="text-emerald-400">Normal User Accessible</span>
                                                        ) : (
                                                            <span className="text-amber-500">Admin Preview Only</span>
                                                        )}
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

                {/* TAB 3: SYSTEM & SECURITY */}
                {activeTab === 'settings' && (
                    <div className="space-y-6 max-w-4xl font-mono">
                        {/* Security Architecture Box */}
                        <div className="bg-[#0d0d10] border border-zinc-800 p-6">
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                                <span className="text-emerald-500">🛡</span>
                                <span>// AUTHORIZATION_AND_SECURITY_ENFORCEMENT</span>
                            </h2>
                            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                                Access to this Admin Control Center and write authority over platform configuration documents are strictly guarded at two complementary layers:
                            </p>
                            <div className="space-y-3 text-xs">
                                <div className="border border-zinc-800 bg-black/40 p-3.5">
                                    <span className="text-white font-bold block mb-1">1. Cloud Firestore Security Rules</span>
                                    <p className="text-zinc-400">
                                        All writes to <code className="text-zinc-200">platformConfig/*</code> require verification via the rule <code className="text-emerald-400">isAdmin()</code>, which checks both user profile role assignment in Firestore and verified authorization token claims.
                                    </p>
                                </div>
                                <div className="border border-zinc-800 bg-black/40 p-3.5">
                                    <span className="text-white font-bold block mb-1">2. Client-Side Route Protection</span>
                                    <p className="text-zinc-400">
                                        The <code className="text-zinc-200">&lt;AdminRoute&gt;</code> guard automatically inspects authenticated Firebase credentials. Normal authenticated users and guests attempting to access <code className="text-zinc-200">/admin</code> are safely blocked.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Active Operator Diagnostics */}
                        <div className="bg-[#0d0d10] border border-zinc-800 p-6">
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
                                // ACTIVE_OPERATOR_IDENTITY
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                <div>
                                    <span className="text-zinc-500 block text-[10px] uppercase">Authenticated Email</span>
                                    <span className="text-white font-bold">{currentUser?.email || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="text-zinc-500 block text-[10px] uppercase">Firebase UID</span>
                                    <span className="text-zinc-300 text-[11px] truncate block">{currentUser?.uid || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="text-zinc-500 block text-[10px] uppercase">Assigned System Role</span>
                                    <span className="text-emerald-400 font-bold uppercase">{userProfile?.role || 'admin'}</span>
                                </div>
                                <div>
                                    <span className="text-zinc-500 block text-[10px] uppercase">Firestore Target Document</span>
                                    <span className="text-zinc-300">platformConfig/sections</span>
                                </div>
                            </div>
                        </div>

                        {/* Factory Reset */}
                        <div className="bg-[#0d0d10] border border-rose-950/60 p-6">
                            <h2 className="text-sm font-bold text-rose-400 uppercase tracking-wider mb-2">
                                // DANGER_ZONE: RESET_CONFIGURATION
                            </h2>
                            <p className="text-xs text-zinc-400 mb-4">
                                Restore initial factory platform section settings in Firestore. This resets all six sections to their initial deployment defaults.
                            </p>
                            <button
                                onClick={handleResetToSystemDefaults}
                                disabled={saving}
                                className="px-4 py-2 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-200 text-xs uppercase tracking-wider transition-colors"
                            >
                                Reset to Default Schema
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminPage;
