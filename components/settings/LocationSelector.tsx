import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Country, City, type ICountry, type ICity } from 'country-state-city';
import { MapPinIcon, ChevronDownIcon, CloseIcon, CheckIcon, MagnifyingGlassIcon } from '../ui/Icons';

export interface LocationData {
    location: string;
    country: string;
    countryCode: string;
    city: string;
}

interface LocationSelectorProps {
    value?: string;
    initialCountryCode?: string;
    initialCity?: string;
    onChange: (data: LocationData) => void;
    disabled?: boolean;
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({
    value = '',
    initialCountryCode = '',
    initialCity = '',
    onChange,
    disabled = false,
}) => {
    // All available countries from ISO dataset
    const allCountries = useMemo(() => Country.getAllCountries(), []);

    // Selected state
    const [selectedCountry, setSelectedCountry] = useState<ICountry | null>(null);
    const [selectedCityName, setSelectedCityName] = useState<string>('');

    // Dropdown toggles
    const [isCountryOpen, setIsCountryOpen] = useState(false);
    const [isCityOpen, setIsCityOpen] = useState(false);

    // Search filters
    const [countrySearch, setCountrySearch] = useState('');
    const [citySearch, setCitySearch] = useState('');

    // Refs for outside click handling
    const countryDropdownRef = useRef<HTMLDivElement>(null);
    const cityDropdownRef = useRef<HTMLDivElement>(null);
    const countryInputRef = useRef<HTMLInputElement>(null);
    const cityInputRef = useRef<HTMLInputElement>(null);

    // Initial pre-fill logic: parse incoming value or initials
    const initializedRef = useRef(false);
    useEffect(() => {
        if (initializedRef.current && (selectedCountry || selectedCityName)) return;

        if (initialCountryCode) {
            const found = allCountries.find(c => c.isoCode.toUpperCase() === initialCountryCode.toUpperCase());
            if (found) {
                setSelectedCountry(found);
                setSelectedCityName(initialCity || '');
                initializedRef.current = true;
                return;
            }
        }

        if (value && value.trim()) {
            const parts = value.split(',').map(s => s.trim());
            if (parts.length >= 2) {
                const potentialCity = parts[0];
                const potentialCountry = parts.slice(1).join(' ').trim();
                const matched = allCountries.find(
                    c => c.name.toLowerCase() === potentialCountry.toLowerCase() ||
                         c.isoCode.toLowerCase() === potentialCountry.toLowerCase()
                );
                if (matched) {
                    setSelectedCountry(matched);
                    setSelectedCityName(potentialCity);
                    initializedRef.current = true;
                    return;
                }
            }
            // Single name match (country only)
            const matchedCountry = allCountries.find(
                c => c.name.toLowerCase() === value.trim().toLowerCase() ||
                     c.isoCode.toLowerCase() === value.trim().toLowerCase()
            );
            if (matchedCountry) {
                setSelectedCountry(matchedCountry);
                setSelectedCityName('');
                initializedRef.current = true;
                return;
            }
            // Fallback: If free text doesn't match standard country, keep as custom city
            setSelectedCityName(value.trim());
            initializedRef.current = true;
        }
    }, [value, initialCountryCode, initialCity, allCountries]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
                setIsCountryOpen(false);
            }
            if (cityDropdownRef.current && !cityDropdownRef.current.contains(e.target as Node)) {
                setIsCityOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filtered countries
    const filteredCountries = useMemo(() => {
        const query = countrySearch.trim().toLowerCase();
        if (!query) return allCountries.slice(0, 50);
        return allCountries
            .filter(c => c.name.toLowerCase().includes(query) || c.isoCode.toLowerCase().includes(query))
            .slice(0, 50);
    }, [allCountries, countrySearch]);

    // All cities of selected country
    const countryCities = useMemo(() => {
        if (!selectedCountry) return [];
        return City.getCitiesOfCountry(selectedCountry.isoCode) || [];
    }, [selectedCountry]);

    // Filtered cities
    const filteredCities = useMemo(() => {
        const query = citySearch.trim().toLowerCase();
        if (!countryCities.length) return [];
        if (!query) return countryCities.slice(0, 50);
        return countryCities
            .filter(c => c.name.toLowerCase().includes(query))
            .slice(0, 50);
    }, [countryCities, citySearch]);

    // Trigger update
    const emitChange = (country: ICountry | null, city: string) => {
        let formatted = '';
        if (city && country) {
            formatted = `${city}, ${country.name}`;
        } else if (country) {
            formatted = country.name;
        } else if (city) {
            formatted = city;
        }

        onChange({
            location: formatted,
            country: country ? country.name : '',
            countryCode: country ? country.isoCode : '',
            city: city,
        });
    };

    const handleSelectCountry = (country: ICountry) => {
        setSelectedCountry(country);
        setIsCountryOpen(false);
        setCountrySearch('');
        // Reset or keep city
        emitChange(country, selectedCityName);
        // Focus city input next
        setTimeout(() => {
            cityInputRef.current?.focus();
            setIsCityOpen(true);
        }, 100);
    };

    const handleSelectCity = (city: ICity | { name: string }) => {
        setSelectedCityName(city.name);
        setIsCityOpen(false);
        setCitySearch('');
        emitChange(selectedCountry, city.name);
    };

    const handleCustomCitySubmit = () => {
        const custom = citySearch.trim();
        if (custom) {
            setSelectedCityName(custom);
            setIsCityOpen(false);
            setCitySearch('');
            emitChange(selectedCountry, custom);
        }
    };

    const handleClearLocation = () => {
        setSelectedCountry(null);
        setSelectedCityName('');
        setCountrySearch('');
        setCitySearch('');
        emitChange(null, '');
    };

    const formattedDisplay = useMemo(() => {
        if (selectedCityName && selectedCountry) {
            return `${selectedCityName}, ${selectedCountry.name}`;
        }
        if (selectedCountry) {
            return selectedCountry.name;
        }
        if (selectedCityName) {
            return selectedCityName;
        }
        return '';
    }, [selectedCityName, selectedCountry]);

    return (
        <div className="space-y-3 font-mono text-xs">
            {/* Country and City Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* ── Country Selector ── */}
                <div className="relative" ref={countryDropdownRef}>
                    <label className="block text-zinc-300 mb-1.5 text-xs tracking-wider">
                        Country / Region <span className="text-zinc-500 font-normal">(Required)</span>
                    </label>
                    <div
                        onClick={() => {
                            if (disabled) return;
                            setIsCountryOpen(!isCountryOpen);
                            if (!isCountryOpen) {
                                setTimeout(() => countryInputRef.current?.focus(), 50);
                            }
                        }}
                        className={`w-full bg-[#0c0c0e] border ${
                            isCountryOpen ? 'border-zinc-500' : 'border-zinc-800'
                        } p-2.5 flex items-center justify-between cursor-pointer transition-colors hover:border-zinc-700 min-h-[42px]`}
                    >
                        <div className="flex items-center gap-2 truncate">
                            {selectedCountry ? (
                                <>
                                    <span className="text-base leading-none select-none">{selectedCountry.flag}</span>
                                    <span className="text-white font-bold truncate">{selectedCountry.name}</span>
                                    <span className="text-[10px] text-zinc-500 bg-zinc-900 border border-zinc-800 px-1.5 py-0.2">
                                        {selectedCountry.isoCode}
                                    </span>
                                </>
                            ) : (
                                <span className="text-zinc-500">Select country...</span>
                            )}
                        </div>
                        <ChevronDownIcon className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${isCountryOpen ? 'rotate-180' : ''}`} />
                    </div>

                    {/* Country Dropdown Panel */}
                    {isCountryOpen && (
                        <div className="absolute left-0 top-full mt-1 w-full bg-[#09090b] border border-zinc-700 shadow-2xl z-50 animate-fadeInUp">
                            <div className="p-2 border-b border-zinc-800 bg-black flex items-center gap-2">
                                <MagnifyingGlassIcon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                <input
                                    ref={countryInputRef}
                                    type="text"
                                    value={countrySearch}
                                    onChange={e => setCountrySearch(e.target.value)}
                                    placeholder="Search countries..."
                                    className="w-full bg-transparent text-white text-xs placeholder-zinc-600 focus:outline-none font-mono"
                                />
                                {countrySearch && (
                                    <button
                                        type="button"
                                        onClick={() => setCountrySearch('')}
                                        className="text-zinc-500 hover:text-white text-xs px-1"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>

                            <div className="max-h-56 overflow-y-auto no-scrollbar divide-y divide-zinc-900">
                                {filteredCountries.length > 0 ? (
                                    filteredCountries.map(country => {
                                        const isSelected = selectedCountry?.isoCode === country.isoCode;
                                        return (
                                            <button
                                                key={country.isoCode}
                                                type="button"
                                                onClick={() => handleSelectCountry(country)}
                                                className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs transition-colors ${
                                                    isSelected
                                                        ? 'bg-zinc-800/90 text-white font-bold'
                                                        : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 truncate">
                                                    <span className="text-sm select-none">{country.flag}</span>
                                                    <span className="truncate">{country.name}</span>
                                                </div>
                                                <span className="text-[10px] text-zinc-500 font-mono ml-2 shrink-0">
                                                    {country.isoCode}
                                                </span>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="p-4 text-center text-zinc-600 text-xs">
                                        No matching countries
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── City Selector ── */}
                <div className="relative" ref={cityDropdownRef}>
                    <label className="block text-zinc-300 mb-1.5 text-xs tracking-wider">
                        City / Metro <span className="text-zinc-500 font-normal">(Cascading)</span>
                    </label>
                    <div
                        onClick={() => {
                            if (disabled || !selectedCountry) return;
                            setIsCityOpen(!isCityOpen);
                            if (!isCityOpen) {
                                setTimeout(() => cityInputRef.current?.focus(), 50);
                            }
                        }}
                        className={`w-full bg-[#0c0c0e] border ${
                            !selectedCountry
                                ? 'border-zinc-850 opacity-60 cursor-not-allowed'
                                : isCityOpen
                                ? 'border-zinc-500 cursor-pointer'
                                : 'border-zinc-800 hover:border-zinc-700 cursor-pointer'
                        } p-2.5 flex items-center justify-between transition-colors min-h-[42px]`}
                    >
                        <div className="flex items-center gap-2 truncate">
                            <MapPinIcon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            {selectedCityName ? (
                                <span className="text-white font-bold truncate">{selectedCityName}</span>
                            ) : (
                                <span className="text-zinc-500">
                                    {selectedCountry ? 'Select or type city...' : 'Select country first'}
                                </span>
                            )}
                        </div>
                        {selectedCountry && (
                            <ChevronDownIcon className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${isCityOpen ? 'rotate-180' : ''}`} />
                        )}
                    </div>

                    {/* City Dropdown Panel */}
                    {isCityOpen && selectedCountry && (
                        <div className="absolute left-0 top-full mt-1 w-full bg-[#09090b] border border-zinc-700 shadow-2xl z-50 animate-fadeInUp">
                            <div className="p-2 border-b border-zinc-800 bg-black flex items-center gap-2">
                                <MagnifyingGlassIcon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                <input
                                    ref={cityInputRef}
                                    type="text"
                                    value={citySearch}
                                    onChange={e => setCitySearch(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (filteredCities.length > 0) {
                                                handleSelectCity(filteredCities[0]);
                                            } else if (citySearch.trim()) {
                                                handleCustomCitySubmit();
                                            }
                                        }
                                    }}
                                    placeholder={`Search cities in ${selectedCountry.name}...`}
                                    className="w-full bg-transparent text-white text-xs placeholder-zinc-600 focus:outline-none font-mono"
                                />
                                {citySearch && (
                                    <button
                                        type="button"
                                        onClick={() => setCitySearch('')}
                                        className="text-zinc-500 hover:text-white text-xs px-1"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>

                            <div className="max-h-56 overflow-y-auto no-scrollbar divide-y divide-zinc-900">
                                {citySearch.trim() && (
                                    <button
                                        type="button"
                                        onClick={handleCustomCitySubmit}
                                        className="w-full text-left px-3 py-2 text-xs bg-zinc-950 hover:bg-zinc-900 text-emerald-400 font-mono flex items-center justify-between border-b border-zinc-800"
                                    >
                                        <span>+ Use &quot;{citySearch.trim()}&quot; as custom city</span>
                                        <span className="text-[10px] text-zinc-500">ENTER</span>
                                    </button>
                                )}

                                {filteredCities.length > 0 ? (
                                    filteredCities.map(city => {
                                        const isSelected = selectedCityName.toLowerCase() === city.name.toLowerCase();
                                        return (
                                            <button
                                                key={`${city.name}-${city.stateCode || ''}`}
                                                type="button"
                                                onClick={() => handleSelectCity(city)}
                                                className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs transition-colors ${
                                                    isSelected
                                                        ? 'bg-zinc-800/90 text-white font-bold'
                                                        : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                                                }`}
                                            >
                                                <span className="truncate">{city.name}</span>
                                                {city.stateCode && (
                                                    <span className="text-[10px] text-zinc-500 font-mono ml-2 shrink-0">
                                                        [{city.stateCode}]
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="p-3 text-center text-zinc-500 text-xs">
                                        No indexed cities found. Press enter or click above to use custom city.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Active Location Preview & Reset */}
            {formattedDisplay ? (
                <div className="flex items-center justify-between p-2.5 bg-black/60 border border-zinc-800/90">
                    <div className="flex items-center gap-2 text-xs truncate">
                        <MapPinIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-zinc-500 uppercase tracking-wider text-[10px]">Location:</span>
                        <span className="text-white font-bold truncate">{formattedDisplay}</span>
                    </div>
                    <button
                        type="button"
                        onClick={handleClearLocation}
                        className="text-[10px] text-zinc-500 hover:text-rose-400 uppercase tracking-wider transition-colors shrink-0 ml-2"
                        title="Clear location"
                    >
                        Clear
                    </button>
                </div>
            ) : (
                <p className="text-[10px] text-zinc-600 font-mono">
                    Select your country and city from the global location list.
                </p>
            )}
        </div>
    );
};

export default LocationSelector;
