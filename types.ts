import React from 'react';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export type UserRole = 'user' | 'moderator' | 'admin';

export interface ReputationScores {
  knowledge: number;
  contribution: number;
  innovation: number;
  collaboration: number;
}

export interface ProfileLink {
  label: string;
  url: string;
}

export interface InvoxUser extends User {
  username: string;
  role: UserRole;
  emailVerified: boolean;
  headline: string;
  bio: string;
  coverPhotoURL: string | null;
  skills: string[];
  interests: string[];
  links: ProfileLink[];
  location: string;
  website: string;
  portfolioURL: string;
  followerCount: number;
  followingCount: number;
  savedPostCount: number;
  savedProjectCount: number;
  savedOpportunityCount: number;
  reputation: ReputationScores;
  onboardingCompleted: boolean;
  profileCompletion: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  lastSeenAt?: unknown;
}

export enum PostType {
  Feed = 'Feed',
  Thread = 'Thread',
  Query = 'Query',
  Poll = 'Poll',
}

export interface Post {
  id: string;
  author: {
    name:string;
    avatarUrl: string;
    isVerified?: boolean;
  };
  aiSummary: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  thumbnailUrl?: string;
  stats: {
    likes: number;
    views: number;
    comments: number;
  };
  type: PostType;
  category: string;
  createdAt: Date;
  userCommented?: boolean;
  userSharedInsight?: boolean;
}

export interface Project {
    id: string;
    author: {
        name: string;
        avatarUrl: string;
        isVerified?: boolean;
    };
    aiSummary: string;
    description: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    thumbnailUrl?: string;
    stats: {
        likes: number;
        views: number;
        comments: number;
    };
    category: string;
    createdAt: Date;
}

export interface QuickCollab {
  id: string;
  author: {
    name: string;
    isVerified?: boolean;
  };
  description: string;
  imageUrl: string;
}

export interface ActivePing {
  id: string;
  name: string;
  avatarUrl?: string;
  message: string;
  timestamp: string;
  unreadCount: number;
  type: 'Full-Time' | 'Invites' | 'Gigs' | 'Others';
}

export interface Offer {
  id: string;
  companyName: string;
  companyAvatarUrl: string;
  title: string;
  description: string;
  status: 'New' | 'Active' | 'Expired';
  type: 'Full-Time' | 'Invites' | 'Gigs' | 'Others';
  createdAt: string;
  acceptedAt?: string;
  skills?: string[];
  location?: string;
  category?: string;
  experienceLevel?: 'Entry' | 'Mid' | 'Senior';
  hasNewMessage?: boolean;
}

export interface Trend {
  id: string;
  domain: {
    name: string;
    icon: React.FC<{ className?: string }>;
    isFollowed?: boolean;
  };
  title: string;
  summary: string;
  fullContent: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  thumbnailUrl?: string;
  mediaOverlayUrl: string;
  stats: {
    likes: number;
    views: number;
    comments: number;
  };
  details: {
    publishedBy: string;
    publishedOn: string;
    link: string;
  };
  createdAt: Date;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  avatarUrl?: string;
  members: number;
  rating: number;
  category: string;
  isVerified?: boolean;
}

export interface MyCommunity {
  id: string;
  name: string;
  latestMessage: string;
  timestamp: string;
  hasNotification: boolean;
  avatarUrl: string;
  category: string;
}

export interface HubContact {
  id: string;
  name: string;
  avatarUrl: string;
  isGroup?: boolean;
}

export interface Message {
  id: string;
  sender: 'me' | 'other';
  text?: string;
  timestamp: string;
  date: Date;
  type: 'text' | 'image' | 'file' | 'voice';
  mediaUrl?: string;
  fileInfo?: { name: string; size: string; };
  voiceDuration?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

export interface HubConversation {
  id: string;
  name: string;
  avatarUrl: string;
  messages: Message[];
  timestamp: string;
  unreadCount: number;
  category: 'comrade' | 'group' | 'explore' | 'spotlight';
  isGroup?: boolean;
}

export interface Conference {
  id: string;
  title: string;
  date: string;
  time: string;
  timezone: string;
  communityName: string;
  communityAvatarUrl: string;
  type: 'Online' | 'Offline';
}

export interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  timezone: string;
  communityName: string;
  communityAvatarUrl: string;
  eventType: 'Meetup' | 'Hackathon' | 'Talk';
  locationType: 'Online' | 'Offline';
}

export interface StreamMoment {
    id: string;
    author: {
        name: string;
        avatarUrl: string;
        isVerified?: boolean;
    };
    aiSummary: string;
    content: string;
    mediaUrl: string;
    mediaType: 'image' | 'video';
    thumbnailUrl?: string;
    type: 'Stills' | 'Tapes' | 'Knacks';
    stats: {
        likes: number;
        views: number;
        comments: number;
    };
}

export interface StreamLoop {
    id: string;
    author: {
        name: string;
        avatarUrl: string;
    };
    category: 'Zaps' | 'Mood' | 'Thought' | 'Music';
    title: string;
    content: string;
    imageUrl: string;
}
