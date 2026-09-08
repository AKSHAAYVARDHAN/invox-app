import React, { useState, useEffect, useRef } from 'react';

export const PREDEFINED_DOMAINS = [
    'Technology',
    'Artificial Intelligence',
    'Start Up',
    'Coding',
    'Design',
    'Science',
    'Product',
    'Business',
] as const;

export type PredefinedDomain = typeof PREDEFINED_DOMAINS[number];

export function formatDomainName(raw: string): string {
    const cleaned = raw.trim().replace(/\s+/g, ' ');
    if (!cleaned) return '';
    return cleaned
        .split(' ')
        .map(word => {
            if (!word) return '';
            // Preserve short uppercase acronyms like AI, API, VR, etc.
            if (word.length <= 4 && word === word.toUpperCase()) return word;
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
}

export interface TargetDomainSelectorProps {
    value: string;
    onChange: (domain: string, isValid: boolean) => void;
    label?: string;
    subLabel?: string;
    error?: string | null;
    className?: string;
    disabled?: boolean;
}

export const TargetDomainSelector: React.FC<TargetDomainSelectorProps> = ({
    value,
    onChange,
    label = 'Target Domain',
    subLabel,
    error: externalError,
    className = '',
    disabled = false,
}) => {
    // Determine initial state based on whether value matches a predefined domain
    const isValuePredefined = PREDEFINED_DOMAINS.some(
        d => d.toLowerCase() === (value || '').trim().toLowerCase()
    );

    const [isCustom, setIsCustom] = useState<boolean>(() => {
        if (!value) return false;
        return !isValuePredefined;
    });

    const [selectedPredefined, setSelectedPredefined] = useState<string>(() => {
        if (isValuePredefined) {
            return PREDEFINED_DOMAINS.find(
                d => d.toLowerCase() === (value || '').trim().toLowerCase()
            ) || PREDEFINED_DOMAINS[0];
        }
        return PREDEFINED_DOMAINS[0];
    });

    const [customInput, setCustomInput] = useState<string>(() => {
        if (!isValuePredefined && value) {
            return value.trim();
        }
        return '';
    });

    const [touched, setTouched] = useState<boolean>(false);
    const [internalError, setInternalError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Synchronize if external value changes (e.g. form reset)
    useEffect(() => {
        const matchesPredefined = PREDEFINED_DOMAINS.find(
            d => d.toLowerCase() === (value || '').trim().toLowerCase()
        );
        if (matchesPredefined) {
            setIsCustom(false);
            setSelectedPredefined(matchesPredefined);
            setCustomInput('');
            setInternalError(null);
        } else if (value && value.trim()) {
            setIsCustom(true);
            setCustomInput(value.trim());
        }
    }, [value]);

    const handleSelectPredefined = (domain: PredefinedDomain) => {
        if (disabled) return;
        setIsCustom(false);
        setSelectedPredefined(domain);
        setCustomInput('');
        setInternalError(null);
        setTouched(false);
        onChange(domain, true);
    };

    const handleSelectCustom = () => {
        if (disabled) return;
        setIsCustom(true);
        setTouched(true);
        const trimmed = customInput.trim();
        if (trimmed) {
            validateAndPropagate(trimmed);
        } else {
            setInternalError('Custom domain is required.');
            onChange('', false);
        }
        setTimeout(() => {
            inputRef.current?.focus();
        }, 50);
    };

    const validateAndPropagate = (text: string) => {
        const cleaned = text.trim().replace(/\s+/g, ' ');
        if (!cleaned) {
            setInternalError('Custom domain is required.');
            onChange('', false);
            return false;
        }
        if (cleaned.length > 40) {
            setInternalError('Domain must be 40 characters or less.');
            onChange('', false);
            return false;
        }
        if (!/[a-zA-Z0-9]/.test(cleaned)) {
            setInternalError('Please enter a valid domain name.');
            onChange('', false);
            return false;
        }
        const lower = cleaned.toLowerCase();
        if (lower === 'other' || lower === 'custom' || lower === 'other / custom' || lower === 'other/custom') {
            setInternalError('Please specify the domain or field (e.g. Psychology, Astronomy).');
            onChange('', false);
            return false;
        }

        setInternalError(null);
        const formatted = formatDomainName(cleaned);
        onChange(formatted, true);
        return true;
    };

    const handleCustomChange = (val: string) => {
        setCustomInput(val);
        setTouched(true);
        validateAndPropagate(val);
    };

    const displayError = externalError || (touched && internalError);

    return (
        <div className={`space-y-1.5 ${className}`}>
            <div className="flex items-center justify-between">
                <label className="block text-zinc-400 uppercase tracking-wider font-bold text-xs">
                    {label}
                </label>
                {subLabel && (
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                        {subLabel}
                    </span>
                )}
            </div>

            {/* Domain Button Options */}
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Target Domain">
                {PREDEFINED_DOMAINS.map((dom) => {
                    const isSelected = !isCustom && selectedPredefined.toLowerCase() === dom.toLowerCase();
                    return (
                        <button
                            key={dom}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            disabled={disabled}
                            onClick={() => handleSelectPredefined(dom)}
                            className={`py-1.5 px-2.5 border text-[11px] uppercase tracking-wider transition-all ${
                                isSelected
                                    ? 'border-white bg-zinc-900 text-white font-bold'
                                    : 'border-zinc-800 bg-black/40 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                            }`}
                        >
                            {dom}
                        </button>
                    );
                })}
                <button
                    type="button"
                    role="radio"
                    aria-checked={isCustom}
                    disabled={disabled}
                    onClick={handleSelectCustom}
                    className={`py-1.5 px-2.5 border text-[11px] uppercase tracking-wider transition-all ${
                        isCustom
                            ? 'border-white bg-zinc-900 text-white font-bold'
                            : 'border-zinc-800 bg-black/40 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                    }`}
                >
                    OTHER / CUSTOM
                </button>
            </div>

            {/* Custom Domain Input Field (revealed when OTHER / CUSTOM is selected) */}
            {isCustom && (
                <div className="mt-2 space-y-1">
                    <div className="relative">
                        <input
                            ref={inputRef}
                            type="text"
                            value={customInput}
                            disabled={disabled}
                            onChange={(e) => handleCustomChange(e.target.value)}
                            onBlur={() => setTouched(true)}
                            placeholder="ENTER CUSTOM DOMAIN..."
                            maxLength={40}
                            className={`w-full bg-[#0c0c0e] border ${
                                displayError
                                    ? 'border-red-500/80 focus:border-red-400'
                                    : 'border-zinc-700 focus:border-white'
                            } p-2.5 text-white text-xs font-mono placeholder-zinc-600 focus:outline-none transition-colors`}
                        />
                        {customInput.length > 0 && (
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 font-mono pointer-events-none">
                                {customInput.length}/40
                            </span>
                        )}
                    </div>
                    {displayError && (
                        <p className="text-[10px] font-mono text-red-400 flex items-center gap-1 mt-1">
                            <span>// ERROR:</span>
                            <span>{displayError}</span>
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default TargetDomainSelector;
