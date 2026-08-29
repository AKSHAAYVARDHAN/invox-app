import React, { useState, useEffect, useRef } from 'react';
import { 
    ChevronDownIcon, 
    FireIcon, 
    CheckIcon,
    MagnifyingGlassIcon,
    ClipboardListIcon
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
}

const DomainFilter: React.FC<DomainFilterProps> = ({ selectedDomains, onSelectionChange, domains, buttonText = 'DOMAINS' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Reset search term when dropdown is closed
    useEffect(() => {
        if (!isOpen) {
            setSearchTerm('');
        }
    }, [isOpen]);

    const handleToggleDomain = (domainName: string) => {
        const newSelection = selectedDomains.includes(domainName)
            ? selectedDomains.filter(d => d !== domainName)
            : [...selectedDomains, domainName];
        onSelectionChange(newSelection);
    };

    const getButtonText = () => {
        if (selectedDomains.length === 0) {
            return buttonText;
        }
        if (selectedDomains.length === 1) {
            return selectedDomains[0];
        }
        return `${selectedDomains.length} Domains Selected`;
    };

    const filteredDomains = domains.filter(domain =>
        domain.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="relative w-full mb-4" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="group flex items-center justify-between w-full px-4 py-2.5 text-xs font-mono text-left text-zinc-200 bg-[#0c0c0e] border border-zinc-800 hover:border-zinc-700 focus:outline-none transition-all duration-150"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500">// DOMAIN:</span>
                    <span className="tracking-wider uppercase font-semibold text-white">{getButtonText()}</span>
                    <ChevronDownIcon className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-150 ${isOpen ? 'transform rotate-180' : ''}`} />
                </div>
                <div className="flex items-center gap-1.5 text-zinc-500 font-mono text-[10px]">
                    <FireIcon className="w-4 h-4 text-zinc-400" />
                    <span>FILTER</span>
                </div>
            </button>

            {isOpen && (
                <div className="absolute z-30 w-full mt-1 bg-[#0c0c0e] border border-zinc-700 shadow-2xl">
                    {/* Search Bar */}
                    <div className="p-2 border-b border-zinc-800">
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                            <input
                                type="search"
                                placeholder="Filter domains..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-[#141416] border border-zinc-800 p-1.5 pl-8 focus:outline-none focus:border-zinc-600 text-xs font-mono text-white placeholder-zinc-600"
                                autoFocus
                            />
                        </div>
                    </div>
                    <ul
                        className="py-1 max-h-60 overflow-y-auto no-scrollbar"
                        role="listbox"
                        aria-multiselectable="true"
                    >
                        <li
                            role="option"
                            aria-selected={selectedDomains.length === 0}
                            className={`px-3 py-2 cursor-pointer transition-colors flex items-center justify-between text-xs font-mono border-b border-zinc-900/60 ${selectedDomains.length === 0 ? 'bg-zinc-800/80 text-white font-medium' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}
                            onClick={() => onSelectionChange([])}
                        >
                            <div className="flex items-center gap-2.5">
                                <ClipboardListIcon className="w-4 h-4 text-zinc-400" />
                                <span>All Domains</span>
                            </div>
                            <div className={`w-3.5 h-3.5 border flex items-center justify-center ${selectedDomains.length === 0 ? 'border-white bg-white text-black' : 'border-zinc-700 bg-transparent'}`}>
                                {selectedDomains.length === 0 && <CheckIcon className="w-3 h-3 stroke-[3]" />}
                            </div>
                        </li>
                        {filteredDomains.length > 0 ? (
                            filteredDomains.map((domain) => {
                                const isSelected = selectedDomains.includes(domain.name);
                                return (
                                    <li
                                        key={domain.name}
                                        role="option"
                                        aria-selected={isSelected}
                                        className={`px-3 py-2 cursor-pointer transition-colors flex items-center justify-between text-xs font-mono border-b border-zinc-900/60 last:border-0 ${isSelected ? 'bg-zinc-800/80 text-white font-medium' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}
                                        onClick={() => handleToggleDomain(domain.name)}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <domain.icon className="w-4 h-4 text-zinc-400" />
                                            <span>{domain.name}</span>
                                        </div>
                                        <div className={`w-3.5 h-3.5 border flex items-center justify-center ${isSelected ? 'border-white bg-white text-black' : 'border-zinc-700 bg-transparent'}`}>
                                            {isSelected && <CheckIcon className="w-3 h-3 stroke-[3]" />}
                                        </div>
                                    </li>
                                );
                            })
                        ) : (
                           <p className="text-zinc-500 font-mono text-center py-4 text-xs">No domains found.</p> 
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default DomainFilter;