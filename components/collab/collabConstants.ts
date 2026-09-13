/**
 * Canonical Constants & Options for Collab Data Model
 * Single Source of Truth for Collab Creation, Editing, and Display
 */

export const EXPERIENCE_OPTIONS = ['Any', 'Beginner', 'Intermediate', 'Advanced'] as const;
export const BACKGROUND_OPTIONS = ['Student', 'Professional', 'Researcher', 'Creator', 'Anyone'] as const;
export const AVAILABILITY_OPTIONS = ['Flexible', 'Part-Time', 'Full-Time'] as const;
export const LOCATION_OPTIONS = ['Remote', 'Specific Location', 'Anywhere'] as const;

export const COLLAB_TYPES = [
    'Open Collaboration',
    'Paid',
    'Equity',
    'Volunteer',
    'Academic / Research',
    'Internship',
    'Flexible / To Be Discussed',
] as const;

export const PROJECT_STATUSES = [
    'Idea',
    'Early Concept',
    'Prototype',
    'MVP',
    'Active Project',
    'Scaling',
] as const;

export const COMMON_SKILL_SUGGESTIONS = [
    'React', 'TypeScript', 'Python', 'PyTorch', 'Node.js', 
    'Figma', 'UI/UX', 'Go', 'Next.js', 'Tailwind', 'Rust', 'GraphQL'
];
