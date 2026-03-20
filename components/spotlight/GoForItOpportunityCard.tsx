
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

    const typeColors: { [key: string]: string } = {
        'Full-Time': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        'Gigs': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        'Invites': 'bg-green-500/20 text-green-400 border-green-500/30',
        'Others': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };

    return (
        <div className="bg-invox-dark-accent p-4 rounded-lg border border-gray-800 flex flex-col sm:flex-row gap-4">
            <img src={offer.companyAvatarUrl} onError={handleImageError} alt={offer.companyName} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
            <div className="flex-1">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-bold text-white">{offer.companyName}</p>
                        <h4 className="font-semibold text-lg text-gray-200 mt-1">{offer.title}</h4>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400 mt-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${typeColors[offer.type] || typeColors['Others']}`}>{offer.type}</span>
                            {offer.location && (
                                <>
                                    <span>•</span>
                                    <div className="flex items-center gap-1">
                                        <MapPinIcon className="w-4 h-4" />
                                        <span>{offer.location}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <button className="text-gray-400 hover:text-white p-1 transition-transform duration-200 transform hover:scale-110 active:scale-100" onClick={() => toggleSaveOffer(offer.id)}>
                        {isSaved ? <BookmarkIconSolid className="w-5 h-5 text-white"/> : <BookmarkIcon className="w-5 h-5"/>}
                    </button>
                </div>

                <p className="text-sm text-gray-400 mt-3 line-clamp-2">
                    {offer.description}
                </p>

                {offer.skills && (
                    <div className="flex flex-wrap gap-2 mt-3">
                        {offer.skills.slice(0, 4).map(skill => (
                            <span key={skill} className="bg-gray-800/50 text-gray-300 px-2.5 py-1 rounded-md text-xs font-medium border border-gray-800">
                                {skill}
                            </span>
                        ))}
                    </div>
                )}
                
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-800">
                    <span className="text-xs text-gray-500">Posted {offer.createdAt}</span>
                    <button
                        onClick={onViewDetails}
                        className="bg-invox-red px-5 py-2 rounded-lg text-sm font-semibold text-white text-center hover:bg-invox-red-hover transition-all duration-200 transform hover:scale-105 active:scale-95 inline-block"
                    >
                        View Opportunity
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GoForItOpportunityCard;
