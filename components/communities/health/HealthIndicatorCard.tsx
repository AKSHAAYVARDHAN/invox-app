import React, { useState } from 'react';
import {
    COMMUNITY_HEALTH_INDICATOR_CATALOG,
    type HealthIndicatorResult,
} from '../../../services/communityHealthTypes';
import {
    AlertTriangleIcon,
    CheckCircleIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    ClockIcon,
    InformationCircleIcon,
} from '../../ui/Icons';
import { CONFIDENCE_META } from './healthStatusUtils';

interface HealthIndicatorCardProps {
    indicator: HealthIndicatorResult;
    titleOverride?: string;
    descriptionOverride?: string;
    secondaryContext?: string;
}

const ConfidenceIcon: React.FC<{ status: HealthIndicatorResult['status']; className?: string }> = ({
    status,
    className = 'w-3.5 h-3.5',
}) => {
    if (status === 'actual') {
        return <CheckCircleIcon className={className} />;
    }
    if (status === 'estimated') {
        return <InformationCircleIcon className={className} />;
    }
    if (status === 'unavailable') {
        return <AlertTriangleIcon className={className} />;
    }
    return <ClockIcon className={className} />;
};

export const HealthIndicatorCard: React.FC<HealthIndicatorCardProps> = ({
    indicator,
    titleOverride,
    descriptionOverride,
    secondaryContext,
}) => {
    const [showMethodology, setShowMethodology] = useState(false);

    const catalogDef = COMMUNITY_HEALTH_INDICATOR_CATALOG[indicator.definitionId];
    const confMeta = CONFIDENCE_META[indicator.status];
    const displayTitle = titleOverride || indicator.label || catalogDef?.label || indicator.definitionId;
    const whatItMeasures = descriptionOverride || catalogDef?.whatItMeasures || indicator.confidenceNote;

    const periodLabel =
        indicator.periodKey === '7d'
            ? '7-day window'
            : indicator.periodKey === '90d'
            ? '90-day window'
            : '30-day window';

    const hasNumericValue = indicator.value !== null && !isNaN(indicator.value);
    const ratioDetail =
        indicator.numerator !== undefined && indicator.denominator !== undefined && indicator.denominator > 0
            ? `${indicator.numerator.toLocaleString()} / ${indicator.denominator.toLocaleString()}`
            : null;

    return (
        <article className="bg-[#0c0c0e] border border-zinc-800 p-4 sm:p-5 flex flex-col justify-between gap-4 min-w-0">
            <div className="space-y-3 min-w-0">
                {/* Header Row: Title + Reliability State + Period */}
                <div className="flex items-start justify-between gap-3 min-w-0">
                    <div className="space-y-1 min-w-0">
                        <h4 className="text-sm font-semibold text-white tracking-tight font-sans leading-snug break-words">
                            {displayTitle}
                        </h4>
                        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px] font-mono text-zinc-500">
                            <span>{periodLabel}</span>
                            <span aria-hidden="true">·</span>
                            <span className={`inline-flex items-center gap-1 font-semibold ${confMeta.textClass}`}>
                                <ConfidenceIcon status={indicator.status} className="w-3.5 h-3.5 shrink-0" />
                                <span>{confMeta.label}</span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Primary Value Readout */}
                <div className="pt-0.5 flex items-baseline justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                        {hasNumericValue ? (
                            <span className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums tracking-tight">
                                {indicator.formattedValue}
                            </span>
                        ) : (
                            <span
                                className={`text-base sm:text-lg font-semibold font-mono tracking-tight ${
                                    indicator.status === 'unavailable' ? 'text-rose-300' : 'text-zinc-400'
                                }`}
                            >
                                {indicator.status === 'unavailable' ? 'Unavailable' : 'Insufficient data'}
                            </span>
                        )}
                    </div>

                    {(ratioDetail || secondaryContext) && (
                        <div className="text-[11px] font-mono tabular-nums text-zinc-400 text-right">
                            {secondaryContext || ratioDetail}
                        </div>
                    )}
                </div>

                {/* Concise Purpose & Confidence Context */}
                <div className="space-y-1.5 min-w-0">
                    <p className="text-xs text-zinc-300 font-sans leading-relaxed break-words">
                        {whatItMeasures}
                    </p>
                    <p className="text-[11px] text-zinc-500 font-sans leading-relaxed break-words">
                        {indicator.confidenceNote}
                    </p>
                </div>
            </div>

            {/* Footer Action: Expandable Methodology & Source Specification */}
            <div className="pt-3 border-t border-zinc-850/90 space-y-2.5">
                <button
                    type="button"
                    onClick={() => setShowMethodology((prev) => !prev)}
                    aria-expanded={showMethodology}
                    className="w-full flex items-center justify-between gap-2 text-[11px] font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer py-1"
                >
                    <span className="uppercase tracking-wider font-medium">
                        {showMethodology ? 'Hide Methodology' : 'Methodology & Sources'}
                    </span>
                    {showMethodology ? (
                        <ChevronUpIcon className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                        <ChevronDownIcon className="w-3.5 h-3.5 shrink-0" />
                    )}
                </button>

                {showMethodology && (
                    <div className="pt-2 border-t border-zinc-900 space-y-2 text-[11px] font-sans text-zinc-400 leading-relaxed">
                        {catalogDef && (
                            <>
                                <div>
                                    <span className="text-zinc-500 font-mono uppercase text-[10px] block mb-0.5">
                                        Calculation
                                    </span>
                                    <p className="text-zinc-300 break-words">{catalogDef.calculationMethodology}</p>
                                </div>
                                <div>
                                    <span className="text-zinc-500 font-mono uppercase text-[10px] block mb-0.5">
                                        Source Collections
                                    </span>
                                    <p className="text-zinc-400 font-mono text-[10px] break-words">
                                        {catalogDef.sourceCollections.join(' · ')}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-zinc-500 font-mono uppercase text-[10px] block mb-0.5">
                                        Reliability & Missing Data Rule
                                    </span>
                                    <p className="text-zinc-400 break-words">{catalogDef.missingDataHandling}</p>
                                </div>
                            </>
                        )}
                        {!catalogDef && (
                            <p className="text-zinc-400 break-words">{confMeta.description}</p>
                        )}
                    </div>
                )}
            </div>
        </article>
    );
};
