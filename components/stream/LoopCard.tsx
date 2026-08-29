
import React, { useState } from 'react';
import type { StreamLoop } from '../../types';
import { EllipsisVerticalIcon, PencilSwooshIcon } from '../ui/Icons';
import { handleImageError } from '../utils/imageUtils';
import ImageZoomModal from '../ui/ImageZoomModal';

interface LoopCardProps {
    loop: StreamLoop;
}

const LoopCard: React.FC<LoopCardProps> = ({ loop }) => {
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

    return (
        <>
            <div className="bg-[#0c0c0e] border border-zinc-800 flex flex-col h-full">
                <div className="flex items-center justify-between p-3 border-b border-zinc-800/80">
                    <div className="flex items-center gap-2">
                        <img src={loop.author.avatarUrl} onError={handleImageError} alt={loop.author.name} className="w-7 h-7 object-cover border border-zinc-700" />
                        <div>
                            <p className="font-bold text-white text-xs font-mono uppercase tracking-wider">{loop.author.name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 border border-zinc-700 text-zinc-400 bg-zinc-900/60">
                            {loop.category}
                        </span>
                        <button className="text-zinc-500 hover:text-white transition-colors p-1">
                            <EllipsisVerticalIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="p-4 flex flex-col justify-between flex-grow">
                    <div>
                        {loop.title && <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider mb-2">{loop.title}</h3>}
                        {loop.content && <p className="text-zinc-400 text-xs font-mono leading-relaxed mb-3">{loop.content}</p>}
                    </div>
                    <div className="relative mt-2 border border-zinc-800">
                        <img 
                            src={loop.imageUrl} 
                            onError={handleImageError} 
                            alt={loop.title} 
                            className="w-full h-36 object-cover cursor-zoom-in"
                            onClick={() => setZoomedImageUrl(loop.imageUrl)}
                        />
                        <button className="absolute bottom-2 right-2 bg-white text-black border border-white p-2 hover:bg-zinc-200 transition-colors">
                            <PencilSwooshIcon className="w-4 h-4" />
                        </button>
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
