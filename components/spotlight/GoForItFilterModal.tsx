
import React, { useState, useEffect } from 'react';
import { CloseIcon, BriefcaseIcon, BuildingOffice2Icon, MapPinIcon } from '../ui/Icons';

interface GoForItFilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    filters: {
        company: string;
        skills: string;
        location: string;
        opportunityType: string;
        category: string;
        experienceLevel: string;
        searchTerm: string;
    };
    setFilters: (filters: GoForItFilterModalProps['filters']) => void;
}

const opportunityTypes = ['All', 'Full-Time', 'Gigs', 'Invites', 'Others'];
const categories = ['All', 'Web Development', 'Backend', 'Product Management', 'Design', 'Machine Learning', 'Cybersecurity', 'Fintech', 'App Development', 'Cloud Computing', 'Ethical AI', 'Community Management'];
const experienceLevels = ['All', 'Entry', 'Mid', 'Senior'];

const GoForItFilterModal: React.FC<GoForItFilterModalProps> = ({ isOpen, onClose, filters, setFilters }) => {
    const [localFilters, setLocalFilters] = useState(filters);

    useEffect(() => {
        setLocalFilters(filters);
    }, [filters]);

    if (!isOpen) return null;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setLocalFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleApply = () => {
        setFilters(localFilters);
        onClose();
    };

    const handleClear = () => {
        const cleared = {
            company: '',
            skills: '',
            location: '',
            opportunityType: 'All',
            category: 'All',
            experienceLevel: 'All',
            searchTerm: '',
        };
        setLocalFilters(cleared);
        setFilters(cleared);
    };

    const formElementClass = "w-full bg-black border border-zinc-800 p-2.5 font-mono text-xs text-white focus:outline-none focus:border-zinc-500 transition-colors";
    const labelClass = "block text-zinc-400 mb-1.5 font-mono text-xs uppercase tracking-wider";

    return (
        <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 transition-opacity duration-300" 
            onClick={onClose}
            aria-modal="true"
            role="dialog"
            aria-labelledby="filter-modal-title"
        >
            <div 
                className="bg-[#0c0c0e] shadow-2xl w-full max-w-2xl flex flex-col border border-zinc-800 m-4 max-h-[90vh]" 
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-zinc-800 bg-black flex-shrink-0">
                    <h2 id="filter-modal-title" className="font-mono text-xs font-bold text-white uppercase tracking-wider">// FILTER_OPPORTUNITIES</h2>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors" aria-label="Close filter modal">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body - The form */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 overflow-y-auto font-mono">
                    <div>
                        <label htmlFor="opportunityType" className={labelClass}>TYPE</label>
                        <select id="opportunityType" name="opportunityType" value={localFilters.opportunityType} onChange={handleInputChange} className={formElementClass}>
                            {opportunityTypes.map(type => <option key={type} value={type} className="bg-black text-white">{type}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="category" className={labelClass}>CATEGORY / DOMAIN</label>
                        <select id="category" name="category" value={localFilters.category} onChange={handleInputChange} className={formElementClass}>
                            {categories.map(cat => <option key={cat} value={cat} className="bg-black text-white">{cat}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="experienceLevel" className={labelClass}>EXPERIENCE LEVEL</label>
                        <select id="experienceLevel" name="experienceLevel" value={localFilters.experienceLevel} onChange={handleInputChange} className={formElementClass}>
                            {experienceLevels.map(level => <option key={level} value={level} className="bg-black text-white">{level.charAt(0).toUpperCase() + level.slice(1)}</option>)}
                        </select>
                    </div>
                    <div className="relative">
                        <label htmlFor="company" className={labelClass}>POSTED BY (COMPANY)</label>
                        <BuildingOffice2Icon className="absolute left-3 top-9 w-4 h-4 text-zinc-500 pointer-events-none" />
                        <input id="company" type="text" name="company" placeholder="e.g. Google" value={localFilters.company} onChange={handleInputChange} className={`${formElementClass} pl-9`} />
                    </div>
                    <div className="relative">
                        <label htmlFor="location" className={labelClass}>LOCATION</label>
                        <MapPinIcon className="absolute left-3 top-9 w-4 h-4 text-zinc-500 pointer-events-none" />
                        <input id="location" type="text" name="location" placeholder="e.g. Remote" value={localFilters.location} onChange={handleInputChange} className={`${formElementClass} pl-9`} />
                    </div>
                    <div className="md:col-span-2 relative">
                        <label htmlFor="skills" className={labelClass}>REQUIRED SKILLS</label>
                        <BriefcaseIcon className="absolute left-3 top-9 w-4 h-4 text-zinc-500 pointer-events-none" />
                        <input id="skills" type="text" name="skills" value={localFilters.skills} onChange={handleInputChange} className={`${formElementClass} pl-9`} placeholder="e.g. React, Node.js, Python" />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 flex justify-end items-center gap-3 p-4 border-t border-zinc-800 bg-black">
                    <button onClick={handleClear} className="bg-black border border-zinc-800 px-5 py-2 font-mono text-xs text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors uppercase">RESET</button>
                    <button onClick={handleApply} className="bg-white text-black px-6 py-2 font-mono text-xs font-bold hover:bg-zinc-200 transition-colors uppercase">APPLY_FILTERS</button>
                </div>
            </div>
        </div>
    );
};

export default GoForItFilterModal;