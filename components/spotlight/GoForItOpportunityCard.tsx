
import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import type { Offer } from '../../types';
import { handleImageError } from '../utils/imageUtils';
import { BookmarkIcon, MapPinIcon, BookmarkIconSolid } from '../ui/Icons';

interface GoForItOpportunityCardProps {
    offer: Offer;
    savedOfferIds: string[];
    toggleSaveOffer: (offerId: string) => void;
    onViewDetails: () => void;
}

const GoForItOpportunityCard: React.FC<GoForItOpportunityCardProps> = ({ offer, savedOfferIds, toggleSaveOffer, onViewDetails }) => {
    const isSaved = savedOfferIds.includes(offer.id);

    return (
        <div className="bg-[#0c0c0e] p-4 border border-zinc-800 flex flex-col sm:flex-row gap-4 hover:border-zinc-700 transition-colors">
            <img src={offer.companyAvatarUrl} onError={handleImageError} alt={offer.companyName} className="w-14 h-14 border border-zinc-800 object-cover flex-shrink-0" />
            <div className="flex-1">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-mono text-xs text-zinc-500 uppercase tracking-wider">{offer.companyName}</p>
                        <h4 className="font-mono font-bold text-base text-white mt-0.5">{offer.title}</h4>
                        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-zinc-400 mt-2">
                            <span className="px-2 py-0.5 border border-zinc-700 bg-black text-zinc-300 text-[10px] uppercase font-bold">{offer.type}</span>
                            {offer.location && (
                                <>
                                    <span className="text-zinc-600">//</span>
                                    <div className="flex items-center gap-1 text-zinc-400">
                                        <MapPinIcon className="w-3.5 h-3.5" />
                                        <span>{offer.location}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <button className="text-zinc-400 hover:text-white p-1 transition-colors" onClick={() => toggleSaveOffer(offer.id)}>
                        {isSaved ? <BookmarkIconSolid className="w-4 h-4 text-white"/> : <BookmarkIcon className="w-4 h-4"/>}
                    </button>
                </div>

                <p className="font-mono text-xs text-zinc-400 mt-2.5 line-clamp-2 leading-relaxed">
                    {offer.description}
                </p>

                {offer.skills && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                        {offer.skills.slice(0, 4).map(skill => (
                            <span key={skill} className="bg-black text-zinc-400 px-2 py-0.5 font-mono text-[10px] uppercase border border-zinc-850">
                                {skill}
                            </span>
                        ))}
                    </div>
                )}
                
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-zinc-850 font-mono text-xs">
                    <span className="text-[10px] text-zinc-600 uppercase">POSTED: {offer.createdAt}</span>
                    <button
                        onClick={onViewDetails}
                        className="bg-white text-black px-4 py-1.5 font-mono text-xs font-bold uppercase hover:bg-zinc-200 transition-colors"
                    >
                        VIEW_DETAILS
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GoForItOpportunityCard;
