import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project } from '../../types';
import { useLazyLoad } from '../hooks/useLazyLoad';
import { getProjectCreatorId } from '../../services/connectionService';
import { formatNumber } from '../../utils/formatters';
import { handleImageError } from '../utils/imageUtils';
import { ProfileIcon } from '../ui/Icons';

export interface SuggestionCardProps {
  project: Project | any;
  /**
   * Optional custom click handler if parent wants to override.
   * By default, opens #/spotlight/project/:projectId in a new browser tab.
   */
  onClick?: (project: Project, e: React.MouseEvent) => void;
  /**
   * Whether to force opening in a new tab (defaults to true).
   */
  openInNewTab?: boolean;
}

export const SuggestionCard: React.FC<SuggestionCardProps> = ({ 
  project, 
  onClick,
  openInNewTab = true 
}) => {
  const [imageRef, isVisible] = useLazyLoad<HTMLImageElement>();
  const navigate = useNavigate();
  const proj = project as Project;

  const creatorId = 
    getProjectCreatorId(proj) || 
    project.author?.id || 
    project.author?.uid || 
    (proj as any).authorId || 
    (proj as any).userId || 
    (project.author?.username ? `seed_${project.author.username}` : undefined);

  const upvotes = (project as any).upvotes ?? proj.stats?.likes ?? (project as any).likeCount ?? 0;
  const projectMediaUrl = (project as any).imageUrl || proj.thumbnailUrl || proj.mediaUrl || `https://picsum.photos/seed/${project.id}/400/400`;

  // 1. Project Title: Primary text element in title area
  const rawTitle = 
    proj.title || 
    (proj as any).collabTitle || 
    (proj as any).projectTitle || 
    proj.name || 
    (proj as any).roleTitle || 
    (project as any).title || 
    (project as any).name;

  const projectTitle = (rawTitle && typeof rawTitle === 'string' && rawTitle.trim() && rawTitle.trim().toLowerCase() !== 'undefined' && rawTitle.trim().toLowerCase() !== 'null')
    ? rawTitle.trim()
    : 'Untitled Project';

  // 2. Project Hook: Short compelling one-line statement, falling back to beginning of description if missing
  const rawHook = 
    (proj as any).hook || 
    proj.oneLine || 
    (proj as any).collabHook || 
    proj.aiSummary || 
    (project as any).hook || 
    (project as any).oneLine;

  const fallbackDescription = 
    project.description || 
    (proj as any).content || 
    (proj as any).overview || 
    '';

  const projectHook = (rawHook && typeof rawHook === 'string' && rawHook.trim() && rawHook.trim().toLowerCase() !== 'undefined' && rawHook.trim().toLowerCase() !== 'null')
    ? rawHook.trim()
    : (fallbackDescription && typeof fallbackDescription === 'string' && fallbackDescription.trim() && fallbackDescription.trim().toLowerCase() !== 'undefined' && fallbackDescription.trim().toLowerCase() !== 'null')
      ? fallbackDescription.trim()
      : 'No overview available for this project.';

  const categoryLabel = proj.category || proj.domain || (project as any).category || (project as any).domain;

  const projectDetailHref = `#/spotlight/project/${encodeURIComponent(project.id)}`;

  const handleCardClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick(proj, e);
      return;
    }

    if (openInNewTab) {
      e.preventDefault();
      window.open(projectDetailHref, '_blank', 'noopener,noreferrer');
    }
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (creatorId) {
      navigate(`/profile/${creatorId}`);
    }
  };

  return (
    <a 
      href={projectDetailHref}
      target={openInNewTab ? '_blank' : undefined}
      rel={openInNewTab ? 'noopener noreferrer' : undefined}
      onClick={handleCardClick}
      className="bg-[#0c0c0e] p-4 border border-zinc-800 flex gap-4 min-h-48 hover:border-zinc-700 transition-colors cursor-pointer group text-left block no-underline focus:outline-none focus:border-zinc-600"
    >
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header: Clickable Profile Image + Project Title */}
        <div className="flex items-start gap-2.5 min-w-0">
          <div 
            onClick={handleProfileClick}
            title={project.author?.name ? `View ${project.author.name}'s profile` : 'View creator profile'}
            className="w-8 h-8 bg-zinc-900 flex items-center justify-center border border-zinc-800 flex-shrink-0 overflow-hidden cursor-pointer hover:border-zinc-500 hover:opacity-85 transition-all duration-150 group/avatar mt-0.5"
          >
            {project.author?.avatarUrl ? (
              <img 
                src={project.author.avatarUrl} 
                onError={handleImageError} 
                alt={project.author?.name || 'Creator avatar'} 
                className="w-full h-full object-cover group-hover/avatar:scale-105 transition-transform duration-200" 
              />
            ) : (
              <ProfileIcon className="w-4 h-4 text-zinc-400 group-hover/avatar:text-zinc-200 transition-colors" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 
              title={projectTitle}
              className="font-bold text-white font-mono text-sm uppercase tracking-wide line-clamp-2 break-words leading-snug group-hover:text-zinc-200 transition-colors"
            >
              {projectTitle}
            </h4>
          </div>
        </div>

        {/* Hook: Placed directly below the title, clamped to 2-3 lines */}
        <p 
          title={projectHook}
          className="text-xs font-mono text-zinc-400 mt-2 line-clamp-3 break-words leading-relaxed flex-grow"
        >
          {projectHook}
        </p>

        {/* Card Footer: Upvotes & Category */}
        <div className="border-t border-zinc-800 my-2.5 mt-auto" />
        <div className="flex items-center justify-between gap-2 min-w-0 text-xs font-mono text-zinc-400">
          <div className="flex-shrink-0 whitespace-nowrap">
            <span>UPVOTES : </span>
            <span className="text-white font-bold">{formatNumber(upvotes)}</span>
          </div>
          {categoryLabel && (
            <div className="min-w-0 flex-1 flex justify-end">
              <span 
                title={categoryLabel}
                className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 truncate block text-right max-w-full"
              >
                {categoryLabel}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Project Media Thumbnail */}
      <div ref={imageRef} className="w-40 h-40 bg-zinc-900 border border-zinc-800 self-center flex-shrink-0 overflow-hidden">
        {isVisible && (
          <img 
            src={projectMediaUrl} 
            onError={handleImageError} 
            alt={projectTitle} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
          />
        )}
      </div>
    </a>
  );
};

export default SuggestionCard;
