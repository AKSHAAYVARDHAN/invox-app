import React, { useEffect } from 'react';
import { CloseIcon } from '../ui/Icons';
import { CollabManagementHub } from './CollabManagementHub';

interface CollabDashboardModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: 'applications' | 'my_applications' | 'active' | 'published';
    viewMode?: 'spotlight' | 'myspace' | 'all';
}

export const CollabDashboardModal: React.FC<CollabDashboardModalProps> = ({
    isOpen,
    onClose,
    initialTab = 'applications',
    viewMode = 'spotlight',
}) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/85 backdrop-blur-sm flex justify-center items-center z-50 p-2 sm:p-4 md:p-6 overflow-hidden transition-opacity duration-200"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
            aria-labelledby="collab-dashboard-title"
        >
            <div
                className="bg-[#0c0c0e] border border-zinc-800 w-full max-w-5xl h-[92vh] max-h-[920px] flex flex-col font-mono text-zinc-300 shadow-2xl overflow-hidden animate-fadeIn"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-black flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-white uppercase tracking-widest border border-zinc-700 px-2 py-0.5 bg-zinc-900">
                            {viewMode === 'myspace' ? '// MY SPACE' : '// MY COLLABS'}
                        </span>
                        <div>
                            <h2 id="collab-dashboard-title" className="text-sm md:text-base font-bold text-white uppercase tracking-wider">
                                {viewMode === 'myspace' ? '// COLLAB MANAGEMENT' : '// MY COLLABS MANAGEMENT'}
                            </h2>
                            <p className="text-[11px] text-zinc-500 hidden sm:block">
                                {viewMode === 'myspace'
                                    ? 'Manage published collab signals and your submitted applications'
                                    : 'Review incoming team applications and active project collaborations'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-zinc-400 hover:text-white p-1.5 transition-colors border border-transparent hover:border-zinc-800"
                        aria-label="Close Collab Dashboard"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Body: Collab Management Hub */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar">
                    <CollabManagementHub
                        initialTab={initialTab}
                        viewMode={viewMode}
                        isModal={true}
                        onClose={onClose}
                    />
                </div>
            </div>
        </div>
    );
};

export default CollabDashboardModal;
