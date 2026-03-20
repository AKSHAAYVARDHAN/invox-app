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
                className="group flex items-center justify-between w-full px-4 py-3 text-sm font-semibold text-left text-white bg-invox-dark-accent border border-gray-800 rounded-lg focus:outline-none transition-all duration-200"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <div className="flex items-center">
                    <span className="tracking-wider group-hover:tracking-widest transition-all duration-300 uppercase">{getButtonText()}</span>
                    <ChevronDownIcon className={`w-5 h-5 ml-2 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />
                </div>
                <FireIcon className="w-6 h-6 text-gray-400" />
            </button>

            {isOpen && (
                <div className="absolute z-30 w-full mt-2 bg-invox-dark-accent border border-gray-800 rounded-lg shadow-lg">
                    {/* Search Bar */}
                    <div className="p-3 border-b border-gray-800">
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                            <input
                                type="search"
                                placeholder="Search domains..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-invox-dark rounded-md p-2 pl-10 focus:outline-none text-sm text-white"
                                autoFocus
                            />
                        </div>
                    </div>
                    <ul
                        className="py-1 max-h-60 overflow-y-auto"
                        role="listbox"
                        aria-multiselectable="true"
                    >
                        <li
                            role="option"
                            aria-selected={selectedDomains.length === 0}
                            className={`px-4 py-3 cursor-pointer hover:bg-gray-700/50 rounded-md mx-1 flex items-center justify-between ${selectedDomains.length === 0 ? 'bg-[#1F1F1F]' : ''}`}
                            onClick={() => onSelectionChange([])}
                        >
                            <div className="flex items-center text-white">
                                <ClipboardListIcon className="w-5 h-5 mr-3 text-gray-400" />
                                <span>All Domains</span>
                            </div>
                            {selectedDomains.length === 0 && <CheckIcon className="w-5 h-5 text-white" />}
                        </li>
                        <hr className="border-gray-800 my-1 mx-1"/>
                        {filteredDomains.length > 0 ? (
                            filteredDomains.map((domain) => {
                                const isSelected = selectedDomains.includes(domain.name);
                                return (
                                    <li
                                        key={domain.name}
                                        role="option"
                                        aria-selected={isSelected}
                                        className={`px-4 py-3 cursor-pointer hover:bg-gray-700/50 rounded-md mx-1 flex items-center justify-between ${isSelected ? 'bg-[#1F1F1F]' : ''}`}
                                        onClick={() => handleToggleDomain(domain.name)}
                                    >
                                        <div className="flex items-center text-white">
                                            <domain.icon className="w-5 h-5 mr-3 text-gray-400" />
                                            <span>{domain.name}</span>
                                        </div>
                                        {isSelected && <CheckIcon className="w-5 h-5 text-white" />}
                                    </li>
                                );
                            })
                        ) : (
                           <p className="text-gray-400 text-center py-4 text-sm">No domains found.</p> 
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default DomainFilter;