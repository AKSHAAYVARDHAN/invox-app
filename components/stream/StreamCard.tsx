import React, { useState } from 'react';
import type { StreamMoment } from '../../types';
import { EllipsisVerticalIcon, HeartIcon, TrendingUpIcon, ChatIcon, ShareIcon, BookmarkIcon, PlayIcon, PencilSwooshIcon, ChatBubbleBottomCenterTextIcon } from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';
import AspectRatioBox from '../ui/AspectRatioBox';
import ImageZoomModal from '../ui/ImageZoomModal';

interface StreamCardProps {
    moment: StreamMoment;
}

const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num;
};

const StreamCard: React.FC<StreamCardProps> = ({ moment }) => {
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

    return (
        <>
            <div className="bg-invox-dark-accent rounded-lg overflow-hidden border border-gray-800 p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <img src={moment.author.avatarUrl} onError={handleImageError} alt={moment.author.name} className="w-10 h-10 rounded-full object-cover" />
                        <p className="font-bold text-white">{moment.author.name}</p>
                    </div>
                    <button className="text-invox-light-gray hover:text-white transition-transform duration-200 transform hover:scale-110 active:scale-100">
                        <EllipsisVerticalIcon className="w-6 h-6" />
                    </button>
                </div>

                <AspectRatioBox 
                    ratio="video" 
                    className="rounded-lg mb-4 group bg-invox-dark cursor-zoom-in"
                    // FIX: Changed moment.imageUrl to moment.mediaUrl to match the StreamMoment type.
                    onClick={() => setZoomedImageUrl(moment.mediaUrl)}
                >
                    {/* FIX: Changed moment.imageUrl to moment.mediaUrl to match the StreamMoment type. */}
                    <img src={moment.mediaUrl} onError={handleImageError} alt={`${moment.type} by ${moment.author.name}`} className="w-full h-full object-cover" />
                    {moment.type === 'Tapes' && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                            <PlayIcon className="w-16 h-16 text-white" />
                        </div>
                    )}
                    <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                        <button className="bg-black/50 backdrop-blur-sm rounded-full p-3 text-white hover:bg-invox-red transition-all duration-200 transform hover:scale-110 active:scale-100">
                            <ChatBubbleBottomCenterTextIcon className="w-6 h-6" />
                        </button>
                        <button className="bg-invox-red rounded-full p-3 text-white hover:bg-invox-red-hover transition-all duration-200 transform hover:scale-110 active:scale-100">
                            <PencilSwooshIcon className="w-6 h-6" />
                        </button>
                    </div>
                </AspectRatioBox>
                
                <div className="flex justify-between items-center text-invox-light-gray">
                    <div className="flex items-center space-x-4">
                        <button className="flex items-center space-x-1 hover:text-invox-red transition-all duration-200 transform hover:scale-110 active:scale-100">
                            <HeartIcon className="w-5 h-5" />
                            <span>{formatNumber(moment.stats.likes)}</span>
                        </button>
                        <div className="flex items-center space-x-1">
                            <TrendingUpIcon className="w-5 h-5" />
                            <span>{formatNumber(moment.stats.views)}</span>
                        </div>
                        <button className="flex items-center space-x-1 hover:text-white transition-all duration-200 transform hover:scale-110 active:scale-100">
                            <ChatIcon className="w-5 h-5" />
                            <span>{formatNumber(moment.stats.comments)}</span>
                        </button>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button className="hover:text-white transition-transform duration-200 transform hover:scale-110 active:scale-100"><ShareIcon className="w-5 h-5" /></button>
                        <button className="hover:text-white transition-transform duration-200 transform hover:scale-110 active:scale-100"><BookmarkIcon className="w-5 h-5" /></button>
                    </div>
                </div>
            </div>
            <ImageZoomModal 
                isOpen={!!zoomedImageUrl} 
                onClose={() => setZoomedImageUrl(null)} 
                imageUrl={zoomedImageUrl || ''}
            />
        </>
    );
};

export default StreamCard;