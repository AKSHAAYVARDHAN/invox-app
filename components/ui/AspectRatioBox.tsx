import React, { forwardRef } from 'react';

interface AspectRatioBoxProps {
  children: React.ReactNode;
  ratio?: 'video' | 'square';
  className?: string;
  // Allows any other div props to be passed
  [key: string]: any; 
}

export const AspectRatioBox = forwardRef<HTMLDivElement, AspectRatioBoxProps>(
  ({ children, ratio = 'video', className = '', ...props }, ref) => {
    const ratioClass = ratio === 'square' ? 'aspect-square' : 'aspect-video';
    
    // Base classes + ratio class + custom classes
    const combinedClassName = `relative w-full overflow-hidden ${ratioClass} ${className}`;

    return (
      <div ref={ref} className={combinedClassName.trim()} {...props}>
        {children}
      </div>
    );
  }
);

AspectRatioBox.displayName = 'AspectRatioBox';

export default AspectRatioBox;
