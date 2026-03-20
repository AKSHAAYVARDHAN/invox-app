
import React, { useState } from 'react';
import type { StreamLoop } from '../../types';
import { EllipsisVerticalIcon, PencilSwooshIcon } from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';
import ImageZoomModal from '../ui/ImageZoomModal';

interface LoopCardProps {
    loop: StreamLoop;
}

const categoryColors: { [key: string]: string } = {
    Zaps: 'from-yellow-500 to-orange-500',
    Mood: 'from-indigo-500 to-purple-500',
    Thought: 'from-cyan-500 to-blue-500',
    Music: 'from-pink-500 to-rose-500',
};

const LoopCard: React.FC<LoopCardProps> = ({ loop }) => {
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

    return (
        <>
            <div className="bg-invox-dark-accent rounded-lg overflow-hidden border border-gray-800 flex flex-col h-full">
                <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                        <img src={loop.author.avatarUrl} onError={handleImageError} alt={loop.author.name} className="w-8 h-8 rounded-full object-cover" />
                        <p className="font-semibold text-white text-sm">{loop.author.name}</p>
                    </div>
                    <button className="text-invox-light-gray hover:text-white transition-transform duration-200 transform hover:scale-110 active:scale-100">
                        <EllipsisVerticalIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="relative flex-grow">
                    <div className={`absolute top-0 left-0 -mt-2 -ml-2 w-24 h-8 bg-gradient-to-r ${categoryColors[loop.category]} transform -rotate-45 flex items-end justify-center`}>
                        <span className="text-white font-bold text-xs transform rotate-0 translate-y-1">{loop.category}</span>
                    </div>
                    <div className="p-4 pt-8 h-full flex flex-col justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2">{loop.title}</h3>
                            <p className="text-gray-400 text-sm">{loop.content}</p>
                        </div>
                        <div className="relative mt-4">
                            <img 
                                src={loop.imageUrl} 
                                onError={handleImageError} 
                                alt={loop.title} 
                                className="w-full h-32 object-cover rounded-lg cursor-zoom-in"
                                onClick={() => setZoomedImageUrl(loop.imageUrl)}
                            />
                            <button className="absolute bottom-2 right-2 bg-invox-red rounded-full p-2 text-white hover:bg-invox-red-hover transition-all duration-200 transform hover:scale-110 active:scale-100">
                                <PencilSwooshIcon className="w-5 h-5" />
                            </button>
                        </div>
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

export default LoopCard;
