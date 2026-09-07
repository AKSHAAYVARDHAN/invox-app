import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    ChevronDownIcon, 
    FireIcon, 
    CheckIcon,
    MagnifyingGlassIcon,
    ClipboardListIcon,
    XMarkIcon
} from './Icons';

interface Domain {
    name: string;
    icon: React.FC<{ className?: string }>;
}

interface DomainFilterProps {
    selectedDomains: string[];
    onSelectionChange: (domains: string[]) => void;
    domains: Domain[];
    buttonText?: string;
    className?: string;
    isTrending?: boolean;
    onToggleTrending?: () => void;
}

const DomainFilter: React.FC<DomainFilterProps> = ({ 
    selectedDomains, 
    onSelectionChange, 
    domains, 
    buttonText = 'DOMAINS',
    className = '',
    isTrending = false,
    onToggleTrending
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Close on click outside or Escape key
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    // Reset search term and auto-focus input when opened
    useEffect(() => {
        if (!isOpen) {
            setSearchTerm('');
        } else {
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 50);
        }
    }, [isOpen]);

    const handleToggleDomain = useCallback((domainName: string) => {
        const exists = selectedDomains.includes(domainName);
        let newSelection: string[];
        if (exists) {
            newSelection = selectedDomains.filter(d => d !== domainName);
        } else {
            newSelection = [...selectedDomains, domainName];
        }
        onSelectionChange(newSelection);
    }, [selectedDomains, onSelectionChange]);

    const handleSelectAll = useCallback(() => {
        onSelectionChange([]);
    }, [onSelectionChange]);

    const handleClear = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onSelectionChange([]);
    }, [onSelectionChange]);

    const isAllSelected = selectedDomains.length === 0;

    const getButtonText = () => {
        if (isAllSelected) {
            return buttonText === 'DOMAINS' ? 'ALL DOMAINS' : buttonText;
        }
        if (selectedDomains.length === 1) {
            return selectedDomains[0].toUpperCase();
        }
        if (selectedDomains.length === 2) {
            return `${selectedDomains[0].toUpperCase()} + ${selectedDomains[1].toUpperCase()}`;
        }
        return `${selectedDomains.length} SELECTED`;
    };

    const trimmedSearch = searchTerm.trim().toLowerCase();
    const filteredDomains = domains.filter(domain =>
        domain.name.toLowerCase().includes(trimmedSearch)
    );

    const showAllOption = !trimmedSearch || 'all domains'.includes(trimmedSearch);

    return (
        <div className={`relative w-full mb-4 ${className}`} ref={dropdownRef}>
            {/* Collapsed Domain Bar Trigger Container */}
            <div
                className={`group flex items-center justify-between w-full px-4 py-2.5 text-xs font-mono text-left transition-all duration-150 border ${
                    !isAllSelected 
                        ? 'bg-[#0f0f12] border-zinc-700 text-white shadow-sm' 
                        : 'bg-[#0c0c0e] border-zinc-800 text-zinc-200 hover:border-zinc-700'
                }`}
            >
                {/* Left: Domain Indicator Label (Clickable Trigger) */}
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 min-w-0 pr-2 flex-1 text-left"
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                >
                    <span className="text-[10px] text-zinc-500 font-mono shrink-0">// DOMAIN:</span>
                    <span className="tracking-wider uppercase font-semibold text-white truncate">
                        {getButtonText()}
                    </span>
                    {!isAllSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 shrink-0" title="Domain filter active" />
                    )}
                    <ChevronDownIcon className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform duration-150 ${isOpen ? 'transform rotate-180' : ''}`} />
                </button>

                {/* Right: Actions / Status */}
                <div className="flex items-center gap-2 shrink-0">
                    {!isAllSelected && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-[10px] text-zinc-400 hover:text-white uppercase font-mono px-1.5 py-0.5 border border-zinc-800 hover:border-zinc-600 bg-black/60 transition-colors"
                            title="Reset to All Domains"
                        >
                            CLEAR
                        </button>
                    )}
                    {onToggleTrending ? (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleTrending();
                            }}
                            className={`flex items-center gap-1.5 font-mono text-[10px] transition-colors cursor-pointer ${
                                isTrending 
                                    ? 'text-white hover:text-zinc-200 font-bold' 
                                    : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                            title={isTrending ? "Trending active: Click to return to default ordering" : "Click to view Trending content"}
                            aria-pressed={isTrending}
                        >
                            <FireIcon className={`w-4 h-4 transition-colors ${isTrending ? 'text-white' : 'text-zinc-400'}`} />
                            <span className="uppercase font-semibold">TRENDING</span>
                            {isTrending && (
                                <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" title="Trending active" />
                            )}
                        </button>
                    ) : !isAllSelected ? (
                        <button
                            type="button"
                            onClick={() => setIsOpen(!isOpen)}
                            className="flex items-center gap-1 text-zinc-300 font-mono text-[10px] hover:text-white"
                            title="Toggle domain selector"
                        >
                            <FireIcon className="w-3.5 h-3.5 text-zinc-400" />
                            <span className="hidden sm:inline font-bold">ACTIVE</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setIsOpen(!isOpen)}
                            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 font-mono text-[10px]"
                            title="Filter by domain"
                        >
                            <FireIcon className="w-4 h-4 text-zinc-400" />
                            <span>FILTER</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute z-40 w-full mt-1 bg-[#0c0c0e] border border-zinc-700 shadow-2xl font-mono text-xs">
                    {/* Search Field */}
                    <div className="p-2 border-b border-zinc-800 bg-[#09090b]">
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                            <input
                                ref={searchInputRef}
                                type="search"
                                placeholder="Filter domains..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-[#141416] border border-zinc-800 p-1.5 pl-8 focus:outline-none focus:border-zinc-600 text-xs font-mono text-white placeholder-zinc-600"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                                >
                                    <XMarkIcon className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Sub-bar: Instructions & Clear Action */}
                    <div className="px-3 py-1.5 bg-black/40 border-b border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500">
                        <span>// SELECT ONE OR MULTIPLE</span>
                        {!isAllSelected && (
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className="text-zinc-400 hover:text-white uppercase tracking-wider font-semibold transition-colors"
                            >
                                CLEAR FILTERS
                            </button>
                        )}
                    </div>

                    {/* Domains List */}
                    <ul
                        className="py-1 max-h-64 overflow-y-auto no-scrollbar"
                        role="listbox"
                        aria-multiselectable="true"
                    >
                        {/* "All Domains" Option */}
                        {showAllOption && (
                            <li
                                role="option"
                                aria-selected={isAllSelected}
                                className={`px-3 py-2 cursor-pointer transition-colors flex items-center justify-between border-b border-zinc-900/80 select-none ${
                                    isAllSelected 
                                        ? 'bg-zinc-800 text-white font-semibold' 
                                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                                }`}
                                onClick={handleSelectAll}
                            >
                                <div className="flex items-center gap-2.5">
                                    <ClipboardListIcon className="w-4 h-4 text-zinc-400" />
                                    <span>All Domains</span>
                                    <span className="text-[10px] text-zinc-500 font-normal uppercase tracking-widest">[RESET]</span>
                                </div>
                                <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-colors ${
                                    isAllSelected 
                                        ? 'border-white bg-white text-black' 
                                        : 'border-zinc-700 bg-transparent'
                                }`}>
                                    {isAllSelected && <CheckIcon className="w-3 h-3 stroke-[3]" />}
                                </div>
                            </li>
                        )}

                        {/* Filtered Domain Items */}
                        {filteredDomains.length > 0 ? (
                            filteredDomains.map((domain) => {
                                const isSelected = selectedDomains.includes(domain.name);
                                return (
                                    <li
                                        key={domain.name}
                                        role="option"
                                        aria-selected={isSelected}
                                        className={`px-3 py-2 cursor-pointer transition-colors flex items-center justify-between border-b border-zinc-900/60 last:border-0 select-none ${
                                            isSelected 
                                                ? 'bg-zinc-800 text-white font-semibold' 
                                                : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                                        }`}
                                        onClick={() => handleToggleDomain(domain.name)}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <domain.icon className="w-4 h-4 text-zinc-400" />
                                            <span>{domain.name}</span>
                                        </div>
                                        <div className={`w-3.5 h-3.5 border flex items-center justify-center transition-colors ${
                                            isSelected 
                                                ? 'border-white bg-white text-black' 
                                                : 'border-zinc-700 bg-transparent hover:border-zinc-500'
                                        }`}>
                                            {isSelected && <CheckIcon className="w-3 h-3 stroke-[3]" />}
                                        </div>
                                    </li>
                                );
                            })
                        ) : (
                            !showAllOption && (
                                <div className="py-6 text-center text-zinc-500 font-mono text-xs uppercase tracking-wider">
                                    NO DOMAINS FOUND
                                </div>
                            )
                        )}
                    </ul>

                    {/* Bottom Status Footer */}
                    <div className="p-2 border-t border-zinc-800 bg-[#09090b] flex items-center justify-between text-[10px]">
                        <span className="text-zinc-500">
                            {isAllSelected 
                                ? '// ALL TRANSMISSIONS VISIBLE' 
                                : `// ${selectedDomains.length} ACTIVE FILTER${selectedDomains.length > 1 ? 'S' : ''}`}
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="text-zinc-400 hover:text-white uppercase tracking-wider px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors"
                        >
                            CLOSE [ESC]
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DomainFilter;