
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

    const formElementClass = "w-full bg-invox-dark border border-gray-800 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-invox-red text-white";
    const labelClass = "block text-invox-light-gray mb-2 text-sm font-semibold";

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex justify-center items-center z-50 transition-opacity duration-300" 
            onClick={onClose}
            aria-modal="true"
            role="dialog"
            aria-labelledby="filter-modal-title"
        >
            <div 
                className="bg-invox-dark-accent rounded-xl shadow-2xl w-full max-w-2xl flex flex-col border border-gray-800 m-4 max-h-[90vh]" 
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-800 flex-shrink-0">
                    <h2 id="filter-modal-title" className="text-xl font-bold text-white">Filter Opportunities</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-transform duration-200 transform hover:scale-110 active:scale-100" aria-label="Close filter modal">
                        <CloseIcon />
                    </button>
                </div>

                {/* Body - The form */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 overflow-y-auto">
                    <div>
                        <label htmlFor="opportunityType" className={labelClass}>Opportunity Type</label>
                        <select id="opportunityType" name="opportunityType" value={localFilters.opportunityType} onChange={handleInputChange} className={formElementClass}>
                            {opportunityTypes.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="category" className={labelClass}>Category / Domain</label>
                        <select id="category" name="category" value={localFilters.category} onChange={handleInputChange} className={formElementClass}>
                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="experienceLevel" className={labelClass}>Experience Level</label>
                        <select id="experienceLevel" name="experienceLevel" value={localFilters.experienceLevel} onChange={handleInputChange} className={formElementClass}>
                            {experienceLevels.map(level => <option key={level} value={level}>{level.charAt(0).toUpperCase() + level.slice(1)}</option>)}
                        </select>
                    </div>
                    <div className="relative">
                        <label htmlFor="company" className={labelClass}>Posted By (Company)</label>
                        <BuildingOffice2Icon className="absolute left-3 top-10 w-5 h-5 text-gray-400 pointer-events-none" />
                        <input id="company" type="text" name="company" placeholder="e.g., Google" value={localFilters.company} onChange={handleInputChange} className={`${formElementClass} pl-10`} />
                    </div>
                    <div className="relative">
                        <label htmlFor="location" className={labelClass}>Location</label>
                        <MapPinIcon className="absolute left-3 top-10 w-5 h-5 text-gray-400 pointer-events-none" />
                        <input id="location" type="text" name="location" placeholder="e.g., Remote" value={localFilters.location} onChange={handleInputChange} className={`${formElementClass} pl-10`} />
                    </div>
                    <div className="md:col-span-2 relative">
                        <label htmlFor="skills" className={labelClass}>Skills Required</label>
                        <BriefcaseIcon className="absolute left-3 top-10 w-5 h-5 text-gray-400 pointer-events-none" />
                        <input id="skills" type="text" name="skills" value={localFilters.skills} onChange={handleInputChange} className={`${formElementClass} pl-10`} placeholder="e.g., React, Node.js, Python" />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 flex justify-end items-center gap-4 p-4 border-t border-gray-800 bg-invox-dark rounded-b-xl">
                    <button onClick={handleClear} className="bg-invox-dark border border-gray-800 px-6 py-2 rounded-lg font-semibold hover:bg-gray-700 transition-all duration-200 transform hover:scale-105 active:scale-95">Clear</button>
                    <button onClick={handleApply} className="bg-invox-red px-8 py-2 rounded-lg font-semibold hover:bg-invox-red-hover transition-all duration-200 transform hover:scale-105 active:scale-95">Apply Filters</button>
                </div>
            </div>
        </div>
    );
};

export default GoForItFilterModal;