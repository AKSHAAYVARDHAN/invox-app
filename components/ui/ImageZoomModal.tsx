import React from 'react';
import { CloseIcon } from './Icons';
import { handleImageError } from '../utils/imageUtils';

interface ImageZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
}

const ImageZoomModal: React.FC<ImageZoomModalProps> = ({ isOpen, onClose, imageUrl }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex justify-center items-center z-50 transition-opacity duration-300" 
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label="Image zoom modal"
    >
      <div 
        className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center"
        onClick={e => e.stopPropagation()}
      >
        <img 
          src={imageUrl} 
          onError={handleImageError}
          alt="Zoomed view" 
          className="max-w-full max-h-full object-contain rounded-lg" 
        />
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-white bg-black/50 p-2 rounded-full hover:bg-black/80 transition-colors" 
          aria-label="Close zoomed image"
        >
          <CloseIcon className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default ImageZoomModal;