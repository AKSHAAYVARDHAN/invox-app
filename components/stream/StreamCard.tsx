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
            <div className="bg-[#0c0c0e] border border-zinc-800 p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <img src={moment.author.avatarUrl} onError={handleImageError} alt={moment.author.name} className="w-9 h-9 object-cover border border-zinc-700" />
                        <div>
                            <p className="font-bold text-white text-xs font-mono uppercase tracking-wider">{moment.author.name}</p>
                            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">// {moment.type}</span>
                        </div>
                    </div>
                    <button className="text-zinc-400 hover:text-white transition-colors p-1">
                        <EllipsisVerticalIcon className="w-5 h-5" />
                    </button>
                </div>

                <AspectRatioBox 
                    ratio="video" 
                    className="mb-3 group bg-black cursor-zoom-in border border-zinc-800"
                    onClick={() => setZoomedImageUrl(moment.mediaUrl)}
                >
                    <img src={moment.mediaUrl} onError={handleImageError} alt={`${moment.type} by ${moment.author.name}`} className="w-full h-full object-cover" />
                    {moment.type === 'Tapes' && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                            <div className="w-14 h-14 bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                                <PlayIcon className="w-8 h-8 text-white" />
                            </div>
                        </div>
                    )}
                    <div className="absolute bottom-3 right-3 flex flex-col gap-2">
                        <button className="bg-black/80 backdrop-blur-sm border border-zinc-700 p-2.5 text-white hover:bg-zinc-800 transition-colors">
                            <ChatBubbleBottomCenterTextIcon className="w-5 h-5" />
                        </button>
                        <button className="bg-white text-black border border-white p-2.5 hover:bg-zinc-200 transition-colors">
                            <PencilSwooshIcon className="w-5 h-5" />
                        </button>
                    </div>
                </AspectRatioBox>

                <p className="text-xs text-zinc-300 font-mono mb-3 leading-relaxed">{moment.content}</p>
                
                <div className="flex justify-between items-center text-zinc-400 text-xs font-mono border-t border-zinc-800/80 pt-3">
                    <div className="flex items-center space-x-4">
                        <button className="flex items-center space-x-1.5 hover:text-white transition-colors">
                            <HeartIcon className="w-4 h-4" />
                            <span>{formatNumber(moment.stats.likes)}</span>
                        </button>
                        <div className="flex items-center space-x-1.5 text-zinc-500">
                            <TrendingUpIcon className="w-4 h-4" />
                            <span>{formatNumber(moment.stats.views)}</span>
                        </div>
                        <button className="flex items-center space-x-1.5 hover:text-white transition-colors">
                            <ChatIcon className="w-4 h-4" />
                            <span>{formatNumber(moment.stats.comments)}</span>
                        </button>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button className="hover:text-white transition-colors p-1"><ShareIcon className="w-4 h-4" /></button>
                        <button className="hover:text-white transition-colors p-1"><BookmarkIcon className="w-4 h-4" /></button>
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

export default StreamCard;