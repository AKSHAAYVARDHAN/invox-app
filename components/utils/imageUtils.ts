import React from 'react';

const placeholderSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 400 300" fill="none">
  <rect width="400" height="300" fill="#1E1E1E"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#D1D5DB">Image Unavailable</text>
</svg>
`;

const placeholderImage = `data:image/svg+xml;base64,${btoa(placeholderSvg)}`;

export const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
  if (e.currentTarget.src !== placeholderImage) {
    e.currentTarget.src = placeholderImage;
    e.currentTarget.style.objectFit = 'cover';
    e.currentTarget.onerror = null;
  }
};