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
  Collab = 'Collab',
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  handle?: string;
  domain?: string;
  category?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  ownerId: string;
  authorId?: string;
  authorName: string;
  authorAvatarUrl?: string;
  subscriberCount: number;
  followersCount?: number;
  postCount: number;
  createdAt: Date | any;
  updatedAt?: Date | any;
}

export interface Post {
  id: string;
  channelId?: string;
  channelName?: string;
  channelAvatarUrl?: string;
  authorId?: string;
  author: {
    name: string;
    avatarUrl: string;
    username?: string;
    isVerified?: boolean;
  };
  aiSummary: string;
  oneLine?: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  thumbnailUrl?: string;
  stats: {
    likes: number;
    views: number;
    comments: number;
  };
  likeCount?: number;
  viewCount?: number;
  commentCount?: number;
  saveCount?: number;
  type: PostType;
  postType?: string;
  category: string;
  domain?: string;
  tags?: string[];
  visibility?: string;
  createdAt: Date;
  updatedAt?: Date;
  userCommented?: boolean;
  userSharedInsight?: boolean;
  collabDetails?: CollabDetails;
}

export interface CollabRole {
  id: string;
  title: string;
  count: number | string;
  skills: string[];
  responsibilities: string;
}

export interface CollabDetails {
  roles: CollabRole[];
  experience?: string;
  background?: string;
  availability?: string;
  location?: string;
  specificLocation?: string;
  collabTypes?: string[];
  projectStatus?: string;
}

export type CollabApplicationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN';

export interface CollabApplication {
  id: string;
  collabId: string;
  creatorId: string;
  ownerId?: string;
  applicantId: string;
  roleId: string;
  roleTitle: string;
  applicant: {
    uid: string;
    displayName: string;
    username: string;
    photoURL?: string | null;
    headline?: string;
    bio?: string;
    skills: string[];
    location?: string;
    portfolioURL?: string;
    website?: string;
    email?: string | null;
  };
  collabTitle: string;
  collabDomain?: string;
  collabOverview?: string;
  collabCreatorName?: string;
  collabCreatorAvatar?: string;
  message?: string;
  supportingDocument?: {
    name: string;
    url: string;
    size?: number;
    type?: string;
    uploadedAt?: string;
  };
  status: CollabApplicationStatus;
  createdAt: Date | any;
  updatedAt?: Date | any;
}

export interface PostComment {
  id: string;
  postId: string;
  targetId?: string;
  targetType?: string;
  type?: 'comment' | 'insight';
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorUsername?: string;
  text: string;
  createdAt: Date | any;
  updatedAt?: Date | any;
}

export interface Project {
    id: string;
    authorId?: string;
    author: {
        name: string;
        avatarUrl: string;
        isVerified?: boolean;
    };
    aiSummary: string;
    oneLine?: string;
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
    domain?: string;
    createdAt: Date;
    collabDetails?: CollabDetails;
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

export type SectionId = 'explore' | 'trendz' | 'spotlight' | 'communities' | 'hub' | 'mySpace';

export type SectionStatus = 'live' | 'development' | 'coming_soon' | 'disabled';

export interface SectionConfig {
    id: SectionId;
    name: string;
    enabled: boolean;
    visibleToUsers: boolean;
    status: SectionStatus;
    path: string;
    description?: string;
}

export type PlatformSectionsConfig = Record<SectionId, SectionConfig>;

export interface PollOption {
  id: string;
  text: string;
  voteCount: number;
}

export type PollDuration = '1d' | '3d' | '7d' | '30d' | 'never';

export interface Poll {
  id: string;
  authorId: string;
  author: {
    name: string;
    username?: string;
    avatarUrl: string;
    isVerified?: boolean;
  };
  question: string;
  description?: string;
  options: PollOption[];
  createdAt: Date;
  updatedAt?: Date;
  expiresAt: Date | null;
  duration?: PollDuration;
  totalVotes: number;
  status: 'active' | 'expired';
  category: string;
  domain?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  stats: {
    likes: number;
    views: number;
    comments: number;
  };
  likeCount?: number;
  viewCount?: number;
  commentCount?: number;
  type: PostType.Poll;
  userVotedOptionId?: string;
}

export interface CreatePollInput {
  question: string;
  description?: string;
  options: string[];
  duration: PollDuration;
  category: string;
  domain?: string;
  mediaFile?: File | null;
  mediaUrl?: string;
  authorProfile?: {
    displayName?: string;
    username?: string;
    photoURL?: string;
    role?: UserRole;
  };
}

export interface PollVote {
  userId: string;
  pollId: string;
  optionId: string;
  votedAt: Date;
}
