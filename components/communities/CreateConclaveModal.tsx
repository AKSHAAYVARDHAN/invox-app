import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Community } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import {
    MapPinIcon,
    GlobeAltIcon,
    CalendarDaysIcon,
    ClockIcon,
    UsersIcon,
    ShieldCheckIcon,
    LockClosedIcon,
    CloseIcon,
    CheckIcon,
    ArrowUpTrayIcon,
    PhotoIcon,
    VideoCameraIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    TrashIcon,
    EyeIcon,
    AlertTriangleIcon,
} from '../ui/Icons';
import {
    createConclaveEvent,
    updateConclaveEvent,
    validateConclaveEventInput,
    canUserCreateConclave,
} from '../../services/conclaveService';
import type {
    ConclaveEvent,
    ConclaveEventType,
    ConclaveEventStatus,
    CreateConclaveEventInput,
    UpdateConclaveEventInput,
    ConclaveProtectedAccess,
} from '../../services/conclaveTypes';
import { uploadFile, getStoragePath } from '../../services/storageService';

// Timezone definitions with IANA IDs and descriptive labels
interface TimezoneOption {
    id: string;
    label: string;
    offset: string;
}

const COMMON_TIMEZONES: TimezoneOption[] = [
    { id: 'UTC', label: 'UTC (Coordinated Universal Time)', offset: 'UTC+00:00' },
    { id: 'America/New_York', label: 'New York (Eastern Time)', offset: 'UTC-05:00' },
    { id: 'America/Chicago', label: 'Chicago (Central Time)', offset: 'UTC-06:00' },
    { id: 'America/Denver', label: 'Denver (Mountain Time)', offset: 'UTC-07:00' },
    { id: 'America/Los_Angeles', label: 'Los Angeles / San Francisco (Pacific Time)', offset: 'UTC-08:00' },
    { id: 'America/Toronto', label: 'Toronto (Eastern Time)', offset: 'UTC-05:00' },
    { id: 'America/Vancouver', label: 'Vancouver (Pacific Time)', offset: 'UTC-08:00' },
    { id: 'America/Sao_Paulo', label: 'São Paulo (Brasília Time)', offset: 'UTC-03:00' },
    { id: 'Europe/London', label: 'London (GMT / BST)', offset: 'UTC+00:00' },
    { id: 'Europe/Berlin', label: 'Berlin / Frankfurt (Central European Time)', offset: 'UTC+01:00' },
    { id: 'Europe/Paris', label: 'Paris (Central European Time)', offset: 'UTC+01:00' },
    { id: 'Europe/Amsterdam', label: 'Amsterdam (Central European Time)', offset: 'UTC+01:00' },
    { id: 'Europe/Zurich', label: 'Zurich (Central European Time)', offset: 'UTC+01:00' },
    { id: 'Europe/Stockholm', label: 'Stockholm (Central European Time)', offset: 'UTC+01:00' },
    { id: 'Europe/Warsaw', label: 'Warsaw (Central European Time)', offset: 'UTC+01:00' },
    { id: 'Europe/Kyiv', label: 'Kyiv (Eastern European Time)', offset: 'UTC+02:00' },
    { id: 'Asia/Dubai', label: 'Dubai (Gulf Standard Time)', offset: 'UTC+04:00' },
    { id: 'Asia/Kolkata', label: 'India (IST - Mumbai, New Delhi, Bengaluru)', offset: 'UTC+05:30' },
    { id: 'Asia/Singapore', label: 'Singapore (Singapore Standard Time)', offset: 'UTC+08:00' },
    { id: 'Asia/Hong_Kong', label: 'Hong Kong (Hong Kong Time)', offset: 'UTC+08:00' },
    { id: 'Asia/Shanghai', label: 'Shanghai / Beijing (China Standard Time)', offset: 'UTC+08:00' },
    { id: 'Asia/Tokyo', label: 'Tokyo (Japan Standard Time)', offset: 'UTC+09:00' },
    { id: 'Asia/Seoul', label: 'Seoul (Korea Standard Time)', offset: 'UTC+09:00' },
    { id: 'Australia/Sydney', label: 'Sydney / Melbourne (AEST)', offset: 'UTC+10:00' },
    { id: 'Australia/Perth', label: 'Perth (AWST)', offset: 'UTC+08:00' },
    { id: 'Pacific/Auckland', label: 'Auckland / Wellington (NZST)', offset: 'UTC+12:00' },
    { id: 'Pacific/Honolulu', label: 'Honolulu (Hawaii Time)', offset: 'UTC-10:00' },
];

const PRESET_CATEGORIES = [
    'Technical Summit & Architecture',
    'Workshop & Hands-on Lab',
    'Working Group & Roadmap',
    'Community Assembly & Governance',
    'Hackathon & Demo Day',
    'Research & Deep Dive',
    'Networking & Social Meetup',
    'Keynote & Speaker Session',
];

interface CreateConclaveModalProps {
    isOpen: boolean;
    community: Community;
    isMember?: boolean;
    initialEvent?: ConclaveEvent | null;
    onClose: () => void;
    onSaved: (event: ConclaveEvent) => void;
    onPreview?: (event: Partial<ConclaveEvent>) => void;
}

export const CreateConclaveModal: React.FC<CreateConclaveModalProps> = ({
    isOpen,
    community,
    isMember = false,
    initialEvent,
    onClose,
    onSaved,
}) => {
    const { currentUser, userProfile } = useAuth();
    const isEditing = Boolean(initialEvent);

    // Step state: 1..5
    const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

    // Step 01: Event Basics
    const [eventType, setEventType] = useState<ConclaveEventType>(initialEvent?.eventType || 'ONSITE');
    const [title, setTitle] = useState(initialEvent?.title || '');
    const [description, setDescription] = useState(initialEvent?.description || '');
    const [category, setCategory] = useState(initialEvent?.category || 'Technical Summit & Architecture');
    const [customCategory, setCustomCategory] = useState('');

    // Step 02: Media & Presentation
    const [coverImageUrl, setCoverImageUrl] = useState(initialEvent?.coverImageUrl || '');
    const [promoVideoUrl, setPromoVideoUrl] = useState(initialEvent?.promoVideoUrl || '');
    const [coverImageMode, setCoverImageMode] = useState<'upload' | 'url'>('upload');
    const [promoVideoMode, setPromoVideoMode] = useState<'upload' | 'url'>('upload');
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [imageUploadProgress, setImageUploadProgress] = useState<number>(0);
    const [imageUploadError, setImageUploadError] = useState<string | null>(null);
    const [isUploadingVideo, setIsUploadingVideo] = useState(false);
    const [videoUploadProgress, setVideoUploadProgress] = useState<number>(0);
    const [videoUploadError, setVideoUploadError] = useState<string | null>(null);
    const [isDraggingImage, setIsDraggingImage] = useState(false);
    const [isDraggingVideo, setIsDraggingVideo] = useState(false);

    const imageFileInputRef = useRef<HTMLInputElement>(null);
    const videoFileInputRef = useRef<HTMLInputElement>(null);

    // Step 03: Schedule & Location
    // Helper to get formatted date string (YYYY-MM-DD)
    const getTomorrowDate = () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    };

    const [startDate, setStartDate] = useState(initialEvent?.startDate || getTomorrowDate());
    const [startTime, setStartTime] = useState(initialEvent?.startTime || '14:00');
    const [endDate, setEndDate] = useState(initialEvent?.endDate || initialEvent?.startDate || getTomorrowDate());
    const [endTime, setEndTime] = useState(initialEvent?.endTime || '16:00');
    const [timezone, setTimezone] = useState(initialEvent?.timezone || 'UTC');
    const [timezoneSearch, setTimezoneSearch] = useState('');
    const [isTimezoneDropdownOpen, setIsTimezoneDropdownOpen] = useState(false);
    const timezoneDropdownRef = useRef<HTMLDivElement>(null);

    // On-site fields
    const [venueName, setVenueName] = useState(initialEvent?.onSite?.venueName || initialEvent?.location || '');
    const [address, setAddress] = useState(initialEvent?.onSite?.address || '');
    const [city, setCity] = useState(initialEvent?.onSite?.city || '');
    const [stateRegion, setStateRegion] = useState(initialEvent?.onSite?.state || '');
    const [country, setCountry] = useState(initialEvent?.onSite?.country || '');
    const [postalCode, setPostalCode] = useState(initialEvent?.onSite?.postalCode || '');
    const [lat, setLat] = useState<string>(initialEvent?.onSite?.coordinates?.lat?.toString() || '');
    const [lng, setLng] = useState<string>(initialEvent?.onSite?.coordinates?.lng?.toString() || '');
    const [venueInstructions, setVenueInstructions] = useState(initialEvent?.onSite?.venueInstructions || '');

    // Virtual fields
    const [platform, setPlatform] = useState(initialEvent?.virtual?.platform || 'Google Meet');
    const [meetingUrl, setMeetingUrl] = useState(initialEvent?.virtual?.meetingUrl || initialEvent?.virtualUrl || '');
    const [accessInstructions, setAccessInstructions] = useState(initialEvent?.virtual?.accessInstructions || '');
    const [requiresProtectedAccess, setRequiresProtectedAccess] = useState(Boolean(initialEvent?.virtual?.requiresProtectedAccess));
    const [meetingPassword, setMeetingPassword] = useState('');
    const [accessCode, setAccessCode] = useState('');

    // Step 04: Registration & Access
    const [capacity, setCapacity] = useState<number>(initialEvent?.capacity ?? 80);
    const [isUnlimitedCapacity, setIsUnlimitedCapacity] = useState<boolean>(initialEvent?.capacity === 0 || initialEvent?.capacity === -1);
    const [accessPolicy, setAccessPolicy] = useState<'ALL_MEMBERS' | 'ADMINS_ONLY' | 'PUBLIC'>(
        (initialEvent?.accessPolicy as any) || 'ALL_MEMBERS'
    );
    const [registrationAvailability, setRegistrationAvailability] = useState<'OPEN' | 'WAITLIST' | 'CLOSED'>('OPEN');
    const [participationInstructions, setParticipationInstructions] = useState(initialEvent?.participationInstructions || '');

    // Submission states
    const [submitting, setSubmitting] = useState(false);
    const [stepValidationErrors, setStepValidationErrors] = useState<string[]>([]);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

    // Close timezone dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (timezoneDropdownRef.current && !timezoneDropdownRef.current.contains(e.target as Node)) {
                setIsTimezoneDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter timezones
    const filteredTimezones = useMemo(() => {
        if (!timezoneSearch.trim()) return COMMON_TIMEZONES;
        const q = timezoneSearch.toLowerCase();
        return COMMON_TIMEZONES.filter(
            tz => tz.id.toLowerCase().includes(q) ||
                  tz.label.toLowerCase().includes(q) ||
                  tz.offset.toLowerCase().includes(q)
        );
    }, [timezoneSearch]);

    // Active timezone label
    const selectedTimezoneLabel = useMemo(() => {
        const match = COMMON_TIMEZONES.find(t => t.id === timezone);
        return match ? `${match.label} [${match.offset}]` : timezone;
    }, [timezone]);

    // Duration calculation
    const calculatedDuration = useMemo(() => {
        if (!startDate || !startTime || !endTime) return null;
        try {
            const startD = new Date(`${startDate}T${startTime}`);
            const endD = new Date(`${endDate || startDate}T${endTime}`);
            const diffMs = endD.getTime() - startD.getTime();
            if (isNaN(diffMs)) return null;
            if (diffMs <= 0) return 'Invalid duration: end is before start';
            const totalMinutes = Math.floor(diffMs / (1000 * 60));
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            const days = Math.floor(hours / 24);

            if (days > 0) {
                const remHours = hours % 24;
                return `${days} day${days > 1 ? 's' : ''}${remHours > 0 ? ` ${remHours} hr${remHours > 1 ? 's' : ''}` : ''}`;
            }
            if (hours === 0) return `${minutes} mins`;
            return `${hours} hr${hours > 1 ? 's' : ''}${minutes > 0 ? ` ${minutes} mins` : ''}`;
        } catch {
            return null;
        }
    }, [startDate, startTime, endDate, endTime]);

    // Assemble payload
    const getPayload = (targetStatus: ConclaveEventStatus): CreateConclaveEventInput => {
        const coords = lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng))
            ? { lat: Number(lat), lng: Number(lng) }
            : undefined;

        const effectiveCapacity = isUnlimitedCapacity ? 0 : Number(capacity) || 100;
        const effectiveCategory = category === 'CUSTOM' ? (customCategory.trim() || 'General Gathering') : category;

        const protectedAccess: ConclaveProtectedAccess | undefined = requiresProtectedAccess
            ? {
                meetingPassword: meetingPassword.trim() || undefined,
                accessCode: accessCode.trim() || undefined,
            }
            : undefined;

        return {
            communityId: community.id,
            communityName: community.name,
            communityAvatarUrl: community.avatarUrl,
            title: title.trim(),
            description: description.trim(),
            category: effectiveCategory,
            coverImageUrl: coverImageUrl.trim() || undefined,
            promoVideoUrl: promoVideoUrl.trim() || undefined,
            eventType,
            startDate: startDate.trim(),
            startTime: startTime.trim(),
            startTimestamp: new Date(`${startDate}T${startTime}`).getTime() || Date.now(),
            endDate: endDate.trim() || undefined,
            endTime: endTime.trim() || undefined,
            endTimestamp: endDate && endTime ? new Date(`${endDate}T${endTime}`).getTime() : undefined,
            timezone: timezone.trim() || 'UTC',
            capacity: effectiveCapacity,
            accessPolicy,
            participationInstructions: participationInstructions.trim() || undefined,
            eventStatus: targetStatus,
            onSite: eventType === 'ONSITE' ? {
                venueName: venueName.trim(),
                address: address.trim(),
                city: city.trim(),
                state: stateRegion.trim() || undefined,
                country: country.trim() || undefined,
                postalCode: postalCode.trim() || undefined,
                coordinates: coords,
                venueInstructions: venueInstructions.trim() || undefined,
            } : undefined,
            virtual: eventType === 'VIRTUAL' ? {
                platform: platform.trim(),
                meetingUrl: meetingUrl.trim(),
                accessInstructions: accessInstructions.trim() || undefined,
                requiresProtectedAccess,
            } : undefined,
            protectedAccess,
        };
    };

    // Step validation helper
    const validateStep = (stepNumber: 1 | 2 | 3 | 4 | 5): boolean => {
        const errors: string[] = [];

        if (stepNumber === 1) {
            if (!title.trim() || title.trim().length < 3) {
                errors.push('Event title must be at least 3 characters.');
            }
            if (!description.trim() || description.trim().length < 10) {
                errors.push('Event description must be at least 10 characters.');
            }
        }

        if (stepNumber === 3) {
            if (!startDate) errors.push('Start date is required.');
            if (!startTime) errors.push('Start time is required.');
            if (!timezone) errors.push('Timezone is required.');

            if (startDate && startTime && endTime) {
                const startD = new Date(`${startDate}T${startTime}`).getTime();
                const endD = new Date(`${endDate || startDate}T${endTime}`).getTime();
                if (endD <= startD) {
                    errors.push('End date and time must be later than start date and time.');
                }
            }

            if (eventType === 'ONSITE') {
                if (!venueName.trim()) errors.push('Venue name is required for On-Site Conclave.');
                if (!address.trim()) errors.push('Street address is required for On-Site Conclave.');
                if (!city.trim()) errors.push('City is required for On-Site Conclave.');
            } else {
                if (!platform.trim()) errors.push('Meeting platform is required for Virtual Conclave.');
                if (!meetingUrl.trim()) {
                    errors.push('Meeting URL or room reference is required for Virtual Conclave.');
                }
            }
        }

        if (stepNumber === 4) {
            if (!isUnlimitedCapacity) {
                const cap = Number(capacity);
                if (!cap || cap <= 0) {
                    errors.push('Registration capacity must be a positive number.');
                }
                if (isEditing && initialEvent?.registeredCount && cap < initialEvent.registeredCount) {
                    errors.push(`Registration capacity cannot be lower than current registrants (${initialEvent.registeredCount}).`);
                }
            }
        }

        setStepValidationErrors(errors);
        return errors.length === 0;
    };

    // Step Navigation
    const handleNext = () => {
        if (validateStep(currentStep)) {
            setStepValidationErrors([]);
            if (currentStep < 5) {
                setCurrentStep((prev) => (prev + 1) as any);
            }
        }
    };

    const handlePrev = () => {
        setStepValidationErrors([]);
        if (currentStep > 1) {
            setCurrentStep((prev) => (prev - 1) as any);
        }
    };

    const handleStepJump = (target: 1 | 2 | 3 | 4 | 5) => {
        // Can always jump backwards
        if (target < currentStep) {
            setStepValidationErrors([]);
            setCurrentStep(target);
            return;
        }
        // If jumping forward, validate current step
        if (validateStep(currentStep)) {
            setStepValidationErrors([]);
            setCurrentStep(target);
        }
    };

    // Quick Duration Adjusters
    const applyDuration = (hoursToAdd: number) => {
        if (!startDate || !startTime) return;
        const [h, m] = startTime.split(':').map(Number);
        const totalMinutes = h * 60 + m + hoursToAdd * 60;
        const newH = Math.floor(totalMinutes / 60) % 24;
        const newM = totalMinutes % 60;
        const nextDay = Math.floor(totalMinutes / (24 * 60));

        const timeStr = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
        setEndTime(timeStr);

        if (nextDay > 0) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + nextDay);
            setEndDate(d.toISOString().split('T')[0]);
        } else {
            setEndDate(startDate);
        }
    };

    // Cover Image Upload Handler
    const handleImageFile = async (file: File) => {
        if (!currentUser?.uid) return;
        setImageUploadError(null);

        // Validation
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            setImageUploadError('Please select a valid image file (JPEG, PNG, WebP, GIF).');
            return;
        }
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            setImageUploadError('Cover image must be smaller than 10MB.');
            return;
        }

        setIsUploadingImage(true);
        setImageUploadProgress(5);

        try {
            const storagePath = getStoragePath('conclaves/covers', currentUser.uid, file.name);
            const uploaded = await uploadFile(storagePath, file, {
                allowedTypes: validTypes,
                maxSizeBytes: maxSize,
                onProgress: (p) => setImageUploadProgress(p),
            });
            setCoverImageUrl(uploaded.url);
            setIsUploadingImage(false);
            setImageUploadProgress(100);
        } catch (err: any) {
            console.warn('[CONCLAVE_COVER_UPLOAD_ERR]', err);
            // Fallback: create object preview URL so user is never blocked
            const localUrl = URL.createObjectURL(file);
            setCoverImageUrl(localUrl);
            setIsUploadingImage(false);
            setImageUploadError(
                'Storage network note: Loaded asset locally. You can also paste an external image URL if preferred.'
            );
        }
    };

    // Promo Video Upload Handler
    const handleVideoFile = async (file: File) => {
        if (!currentUser?.uid) return;
        setVideoUploadError(null);

        const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
        if (!validTypes.includes(file.type)) {
            setVideoUploadError('Please select a valid video format (MP4, WebM, QuickTime MOV).');
            return;
        }
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            setVideoUploadError('Video file must be smaller than 50MB.');
            return;
        }

        setIsUploadingVideo(true);
        setVideoUploadProgress(5);

        try {
            const storagePath = getStoragePath('conclaves/videos', currentUser.uid, file.name);
            const uploaded = await uploadFile(storagePath, file, {
                allowedTypes: validTypes,
                maxSizeBytes: maxSize,
                onProgress: (p) => setVideoUploadProgress(p),
            });
            setPromoVideoUrl(uploaded.url);
            setIsUploadingVideo(false);
            setVideoUploadProgress(100);
        } catch (err: any) {
            console.warn('[CONCLAVE_VIDEO_UPLOAD_ERR]', err);
            const localUrl = URL.createObjectURL(file);
            setPromoVideoUrl(localUrl);
            setIsUploadingVideo(false);
            setVideoUploadError(
                'Storage network note: Loaded video preview locally. You can also paste an external video URL.'
            );
        }
    };

    // Submit: Save as DRAFT
    const handleSaveDraft = async () => {
        if (!currentUser?.uid) return;
        setSubmitting(true);
        setStepValidationErrors([]);

        const payload = getPayload('DRAFT');
        const validation = validateConclaveEventInput(payload, false, initialEvent);
        if (!validation.valid) {
            setStepValidationErrors(validation.errors);
            setSubmitting(false);
            return;
        }

        if (isEditing && initialEvent) {
            const res = await updateConclaveEvent(
                initialEvent.id,
                payload as UpdateConclaveEventInput,
                currentUser.uid,
                community
            );
            if (res.success && res.event) {
                onSaved(res.event);
                onClose();
            } else {
                setStepValidationErrors(res.errors || ['Failed to update draft gathering.']);
            }
        } else {
            const res = await createConclaveEvent(
                payload,
                {
                    uid: currentUser.uid,
                    displayName: currentUser.displayName || userProfile?.displayName || 'Council Organizer',
                    photoURL: currentUser.photoURL || undefined,
                },
                community,
                isMember
            );
            if (res.success && res.event) {
                onSaved(res.event);
                onClose();
            } else {
                setStepValidationErrors(res.errors || ['Failed to create draft gathering.']);
            }
        }
        setSubmitting(false);
    };

    // Submit: PUBLISH Immediately
    const handlePublish = async () => {
        if (!currentUser?.uid) return;
        setSubmitting(true);
        setStepValidationErrors([]);

        const payload = getPayload('PUBLISHED');
        const validation = validateConclaveEventInput(payload, true, initialEvent);
        if (!validation.valid) {
            setStepValidationErrors(validation.errors);
            setSubmitting(false);
            return;
        }

        if (isEditing && initialEvent) {
            const res = await updateConclaveEvent(
                initialEvent.id,
                payload as UpdateConclaveEventInput,
                currentUser.uid,
                community
            );
            if (res.success && res.event) {
                onSaved(res.event);
                onClose();
            } else {
                setStepValidationErrors(res.errors || ['Failed to publish Conclave gathering.']);
            }
        } else {
            const res = await createConclaveEvent(
                payload,
                {
                    uid: currentUser.uid,
                    displayName: currentUser.displayName || userProfile?.displayName || 'Council Organizer',
                    photoURL: currentUser.photoURL || undefined,
                },
                community,
                isMember
            );
            if (res.success && res.event) {
                onSaved(res.event);
                onClose();
            } else {
                setStepValidationErrors(res.errors || ['Failed to publish Conclave gathering.']);
            }
        }
        setSubmitting(false);
    };

    // Calculate if user has made unsaved changes
    const hasUnsavedChanges = useMemo(() => {
        if (isEditing && initialEvent) {
            const initialVenue = initialEvent.onSite?.venueName || initialEvent.location || '';
            const initialAddress = initialEvent.onSite?.address || '';
            const initialCity = initialEvent.onSite?.city || '';
            const initialMeetingUrl = initialEvent.virtual?.meetingUrl || initialEvent.virtualUrl || '';
            const initialPlatform = initialEvent.virtual?.platform || 'Google Meet';

            return (
                title.trim() !== (initialEvent.title || '').trim() ||
                description.trim() !== (initialEvent.description || '').trim() ||
                eventType !== (initialEvent.eventType || 'ONSITE') ||
                coverImageUrl.trim() !== (initialEvent.coverImageUrl || '').trim() ||
                promoVideoUrl.trim() !== (initialEvent.promoVideoUrl || '').trim() ||
                startDate !== (initialEvent.startDate || '') ||
                startTime !== (initialEvent.startTime || '') ||
                endDate !== (initialEvent.endDate || initialEvent.startDate || '') ||
                endTime !== (initialEvent.endTime || '') ||
                timezone !== (initialEvent.timezone || 'UTC') ||
                venueName.trim() !== initialVenue.trim() ||
                address.trim() !== initialAddress.trim() ||
                city.trim() !== initialCity.trim() ||
                meetingUrl.trim() !== initialMeetingUrl.trim() ||
                platform.trim() !== initialPlatform.trim() ||
                participationInstructions.trim() !== (initialEvent.participationInstructions || '').trim()
            );
        }

        // Creating brand new event: dirty if any core input contains data
        return Boolean(
            title.trim() ||
            description.trim() ||
            coverImageUrl.trim() ||
            promoVideoUrl.trim() ||
            venueName.trim() ||
            address.trim() ||
            city.trim() ||
            meetingUrl.trim() ||
            customCategory.trim() ||
            participationInstructions.trim() ||
            meetingPassword.trim() ||
            accessCode.trim()
        );
    }, [
        isEditing,
        initialEvent,
        title,
        description,
        eventType,
        coverImageUrl,
        promoVideoUrl,
        startDate,
        startTime,
        endDate,
        endTime,
        timezone,
        venueName,
        address,
        city,
        meetingUrl,
        platform,
        participationInstructions,
        customCategory,
        meetingPassword,
        accessCode,
    ]);

    // Close immediately and reset state
    const handleDirectClose = () => {
        setShowDiscardConfirm(false);
        setStepValidationErrors([]);
        setCurrentStep(1);
        onClose();
    };

    // Cancel: if dirty, confirm; otherwise close immediately
    const handleCancel = () => {
        if (hasUnsavedChanges) {
            setShowDiscardConfirm(true);
        } else {
            handleDirectClose();
        }
    };

    // Keyboard navigation: Escape key closes or dismisses confirm dialog
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showDiscardConfirm) {
                    setShowDiscardConfirm(false);
                } else {
                    handleCancel();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, showDiscardConfirm, hasUnsavedChanges]);

    // Prevent background scrolling while modal is open
    useEffect(() => {
        if (!isOpen) return;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto font-mono text-zinc-200"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    handleCancel();
                }
            }}
        >
            {/* Modal Container */}
            <div 
                className="bg-[#0b0b0e] border border-zinc-800 w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl relative"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Top Header */}
                <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-black/60 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shrink-0">
                            {eventType === 'ONSITE' ? (
                                <MapPinIcon className="w-4 h-4 text-amber-400" />
                            ) : (
                                <GlobeAltIcon className="w-4 h-4 text-cyan-400" />
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                                    CONCLAVE ARCHITECT
                                </span>
                                <span className="text-zinc-700">·</span>
                                <span className="text-[10px] text-zinc-400 uppercase font-bold truncate max-w-[200px]">
                                    {community.name}
                                </span>
                            </div>
                            <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wide">
                                {isEditing
                                    ? `EDIT CONCLAVE: ${initialEvent?.title || 'UNTITLED'}`
                                    : 'SCHEDULE COLLECTIVE CONCLAVE GATHERING'}
                            </h2>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDirectClose();
                        }}
                        className="p-2 text-zinc-400 hover:text-white transition-colors cursor-pointer border border-transparent hover:border-zinc-800 shrink-0 relative z-10"
                        title="Close modal"
                        aria-label="Close modal"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Step Progress Indicator */}
                <div className="bg-black/40 border-b border-zinc-850 px-3 sm:px-6 py-2.5 overflow-x-auto shrink-0">
                    <div className="flex items-center justify-between min-w-[620px] gap-2">
                        {[
                            { num: 1, label: '01. BASICS' },
                            { num: 2, label: '02. MEDIA & ASSETS' },
                            { num: 3, label: '03. SCHEDULE & VENUE' },
                            { num: 4, label: '04. REGISTRATION' },
                            { num: 5, label: '05. REVIEW & PUBLISH' },
                        ].map((step) => {
                            const isCurrent = currentStep === step.num;
                            const isPast = currentStep > step.num;
                            return (
                                <button
                                    key={step.num}
                                    type="button"
                                    onClick={() => handleStepJump(step.num as any)}
                                    className={`flex items-center gap-2 py-1 px-2.5 border transition-all text-xs cursor-pointer whitespace-nowrap ${
                                        isCurrent
                                            ? 'bg-zinc-900 border-white text-white font-bold'
                                            : isPast
                                            ? 'border-zinc-800 text-zinc-300 hover:border-zinc-700'
                                            : 'border-transparent text-zinc-600 hover:text-zinc-400'
                                    }`}
                                >
                                    <span
                                        className={`w-4 h-4 text-[10px] flex items-center justify-center font-bold ${
                                            isCurrent
                                                ? 'bg-white text-black'
                                                : isPast
                                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                                : 'bg-zinc-900 text-zinc-600'
                                        }`}
                                    >
                                        {isPast ? '✓' : step.num}
                                    </span>
                                    <span>{step.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Validation Feedback Banner */}
                {stepValidationErrors.length > 0 && (
                    <div className="mx-4 sm:mx-6 mt-4 p-3 bg-rose-950/40 border border-rose-800 text-rose-300 space-y-1 text-xs shrink-0">
                        <div className="font-bold uppercase text-[11px] flex items-center gap-1.5">
                            <AlertTriangleIcon className="w-4 h-4 text-rose-400 shrink-0" />
                            <span>ATTENTION: VALIDATION REQUIREMENTS MISSING</span>
                        </div>
                        <ul className="list-disc list-inside text-[11px] space-y-0.5 text-rose-300 pl-1">
                            {stepValidationErrors.map((err, i) => (
                                <li key={i}>{err}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Scrollable Workflow Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 text-xs space-y-6">
                    {/* ============================================================== */}
                    {/* STEP 01: EVENT BASICS                                          */}
                    {/* ============================================================== */}
                    {currentStep === 1 && (
                        <div className="space-y-6 max-w-3xl mx-auto">
                            {/* Format Selection Cards */}
                            <div className="space-y-2">
                                <label className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider block">
                                    PRIMARY EVENT FORMAT *
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* On-Site Card */}
                                    <div
                                        onClick={() => setEventType('ONSITE')}
                                        className={`p-4 border transition-all cursor-pointer relative flex flex-col justify-between ${
                                            eventType === 'ONSITE'
                                                ? 'bg-amber-950/20 border-amber-500 text-amber-200'
                                                : 'bg-black/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                                        }`}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="w-7 h-7 bg-amber-950/60 border border-amber-600/40 flex items-center justify-center">
                                                    <MapPinIcon className="w-4 h-4 text-amber-400" />
                                                </div>
                                                {eventType === 'ONSITE' && (
                                                    <span className="text-[10px] bg-amber-400 text-black px-1.5 py-0.5 font-bold uppercase">
                                                        SELECTED
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="font-bold uppercase text-xs tracking-wider text-white">
                                                ON-SITE CONCLAVE
                                            </h3>
                                            <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                                                Physical gathering held at a verified venue or workspace. Features street address, city, navigation coordinates, and check-in protocols.
                                            </p>
                                        </div>
                                        <div className="mt-3 pt-2 border-t border-zinc-850 flex items-center gap-1.5 text-[10px] text-amber-400/80 uppercase">
                                            <span>Examples: Meetups · Workshops · Summits · Whiteboard Labs</span>
                                        </div>
                                    </div>

                                    {/* Virtual Card */}
                                    <div
                                        onClick={() => setEventType('VIRTUAL')}
                                        className={`p-4 border transition-all cursor-pointer relative flex flex-col justify-between ${
                                            eventType === 'VIRTUAL'
                                                ? 'bg-cyan-950/20 border-cyan-500 text-cyan-200'
                                                : 'bg-black/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                                        }`}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="w-7 h-7 bg-cyan-950/60 border border-cyan-600/40 flex items-center justify-center">
                                                    <GlobeAltIcon className="w-4 h-4 text-cyan-400" />
                                                </div>
                                                {eventType === 'VIRTUAL' && (
                                                    <span className="text-[10px] bg-cyan-400 text-black px-1.5 py-0.5 font-bold uppercase">
                                                        SELECTED
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="font-bold uppercase text-xs tracking-wider text-white">
                                                VIRTUAL CONCLAVE
                                            </h3>
                                            <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                                                Remote gathering hosted via video platform or live stream. Includes platform selection, encrypted links, and optional protected PIN credentials.
                                            </p>
                                        </div>
                                        <div className="mt-3 pt-2 border-t border-zinc-850 flex items-center gap-1.5 text-[10px] text-cyan-400/80 uppercase">
                                            <span>Examples: Assemblies · Syncs · Keynotes · AMA Streams</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Event Title */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider block">
                                        EVENT TITLE *
                                    </label>
                                    <span className="text-[10px] text-zinc-500">{title.length} / 120</span>
                                </div>
                                <input
                                    type="text"
                                    value={title}
                                    maxLength={120}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Distributed Consensus Architecture Summit & Working Group"
                                    className="w-full bg-black border border-zinc-800 p-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400 text-xs font-mono"
                                />
                            </div>

                            {/* Event Category */}
                            <div className="space-y-2">
                                <label className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider block">
                                    EVENT CATEGORY *
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                    {PRESET_CATEGORIES.map((cat) => {
                                        const isSelected = category === cat;
                                        return (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => setCategory(cat)}
                                                className={`px-2.5 py-1.5 border text-[11px] uppercase transition-colors cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-zinc-800 border-white text-white font-bold'
                                                        : 'bg-black/60 border-zinc-850 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                                                }`}
                                            >
                                                {cat}
                                            </button>
                                        );
                                    })}
                                    <button
                                        type="button"
                                        onClick={() => setCategory('CUSTOM')}
                                        className={`px-2.5 py-1.5 border text-[11px] uppercase transition-colors cursor-pointer ${
                                            category === 'CUSTOM'
                                                ? 'bg-zinc-800 border-white text-white font-bold'
                                                : 'bg-black/60 border-zinc-850 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                                        }`}
                                    >
                                        + OTHER CATEGORY
                                    </button>
                                </div>
                                {category === 'CUSTOM' && (
                                    <input
                                        type="text"
                                        value={customCategory}
                                        onChange={(e) => setCustomCategory(e.target.value)}
                                        placeholder="Specify custom gathering category..."
                                        className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400 text-xs mt-1"
                                    />
                                )}
                            </div>

                            {/* Description & Agenda */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider block">
                                        EVENT DESCRIPTION & AGENDA *
                                    </label>
                                    <span className="text-[10px] text-zinc-500">{description.length} chars</span>
                                </div>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Provide detailed information regarding the agenda, key presentation topics, speaker roster, required preparation, and expected technical deliverables..."
                                    rows={6}
                                    className="w-full bg-black border border-zinc-800 p-3 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400 text-xs font-mono leading-relaxed resize-y"
                                />
                            </div>
                        </div>
                    )}

                    {/* ============================================================== */}
                    {/* STEP 02: MEDIA & PRESENTATION                                  */}
                    {/* ============================================================== */}
                    {currentStep === 2 && (
                        <div className="space-y-6 max-w-3xl mx-auto">
                            {/* Cover Image Section */}
                            <div className="space-y-3 p-4 bg-black/40 border border-zinc-850">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                        <PhotoIcon className="w-4 h-4 text-zinc-300" />
                                        <label className="text-[11px] text-white font-bold uppercase tracking-wider">
                                            COVER IMAGE BANNER
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-1 p-0.5 bg-black border border-zinc-850">
                                        <button
                                            type="button"
                                            onClick={() => setCoverImageMode('upload')}
                                            className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-colors ${
                                                coverImageMode === 'upload' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                                            }`}
                                        >
                                            FILE UPLOAD
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCoverImageMode('url')}
                                            className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-colors ${
                                                coverImageMode === 'url' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                                            }`}
                                        >
                                            EXTERNAL URL
                                        </button>
                                    </div>
                                </div>

                                {imageUploadError && (
                                    <div className="p-2.5 bg-rose-950/40 border border-rose-800 text-rose-300 text-[11px]">
                                        {imageUploadError}
                                    </div>
                                )}

                                {coverImageUrl ? (
                                    <div className="space-y-2">
                                        <div className="relative aspect-video w-full max-h-56 bg-black border border-zinc-800 overflow-hidden group">
                                            <img
                                                src={coverImageUrl}
                                                alt="Event cover banner preview"
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => imageFileInputRef.current?.click()}
                                                    className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 text-white uppercase text-xs font-bold hover:bg-zinc-800 cursor-pointer"
                                                >
                                                    REPLACE IMAGE
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setCoverImageUrl('')}
                                                    className="px-3 py-1.5 bg-rose-950 border border-rose-700 text-rose-300 uppercase text-xs font-bold hover:bg-rose-900 cursor-pointer"
                                                >
                                                    REMOVE
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] text-zinc-500">
                                            <span className="truncate max-w-[400px]">URL: {coverImageUrl}</span>
                                            <button
                                                type="button"
                                                onClick={() => setCoverImageUrl('')}
                                                className="text-rose-400 hover:underline cursor-pointer"
                                            >
                                                CLEAR COVER IMAGE
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        {coverImageMode === 'upload' ? (
                                            <div
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    setIsDraggingImage(true);
                                                }}
                                                onDragLeave={() => setIsDraggingImage(false)}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    setIsDraggingImage(false);
                                                    if (e.dataTransfer.files?.[0]) {
                                                        handleImageFile(e.dataTransfer.files[0]);
                                                    }
                                                }}
                                                className={`p-6 border-2 border-dashed text-center transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer ${
                                                    isDraggingImage
                                                        ? 'border-white bg-zinc-900/60'
                                                        : 'border-zinc-800 bg-black/50 hover:border-zinc-700'
                                                }`}
                                                onClick={() => imageFileInputRef.current?.click()}
                                            >
                                                <input
                                                    ref={imageFileInputRef}
                                                    type="file"
                                                    accept="image/png,image/jpeg,image/webp,image/gif"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        if (e.target.files?.[0]) {
                                                            handleImageFile(e.target.files[0]);
                                                        }
                                                    }}
                                                />
                                                <ArrowUpTrayIcon className="w-6 h-6 text-zinc-500" />
                                                <div className="space-y-0.5">
                                                    <p className="font-bold text-zinc-300 uppercase text-xs">
                                                        DRAG & DROP COVER IMAGE, OR CLICK TO BROWSE
                                                    </p>
                                                    <p className="text-[10px] text-zinc-500">
                                                        Supports JPEG, PNG, WebP, GIF (Max 10MB). Recommended: 16:9 ratio (1280x720).
                                                    </p>
                                                </div>
                                                {isUploadingImage && (
                                                    <div className="w-full max-w-xs mt-2 space-y-1">
                                                        <div className="h-1.5 w-full bg-zinc-900 overflow-hidden">
                                                            <div
                                                                className="h-full bg-white transition-all duration-150"
                                                                style={{ width: `${imageUploadProgress}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[10px] text-zinc-400">
                                                            Uploading cover asset: {imageUploadProgress}%
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="space-y-1.5">
                                                <input
                                                    type="url"
                                                    value={coverImageUrl}
                                                    onChange={(e) => setCoverImageUrl(e.target.value)}
                                                    placeholder="https://example.com/conclave-banner.jpg"
                                                    className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400 text-xs"
                                                />
                                                <p className="text-[10px] text-zinc-500">
                                                    Enter direct public image URL (HTTPS).
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Promotional Video Section (Optional) */}
                            <div className="space-y-3 p-4 bg-black/40 border border-zinc-850">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                        <VideoCameraIcon className="w-4 h-4 text-zinc-300" />
                                        <label className="text-[11px] text-white font-bold uppercase tracking-wider">
                                            PROMOTIONAL VIDEO (OPTIONAL)
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-1 p-0.5 bg-black border border-zinc-850">
                                        <button
                                            type="button"
                                            onClick={() => setPromoVideoMode('upload')}
                                            className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-colors ${
                                                promoVideoMode === 'upload' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                                            }`}
                                        >
                                            FILE UPLOAD
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPromoVideoMode('url')}
                                            className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-colors ${
                                                promoVideoMode === 'url' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                                            }`}
                                        >
                                            EXTERNAL URL
                                        </button>
                                    </div>
                                </div>

                                {videoUploadError && (
                                    <div className="p-2.5 bg-rose-950/40 border border-rose-800 text-rose-300 text-[11px]">
                                        {videoUploadError}
                                    </div>
                                )}

                                {promoVideoUrl ? (
                                    <div className="space-y-2">
                                        <div className="relative aspect-video w-full max-h-56 bg-black border border-zinc-800 overflow-hidden">
                                            <video
                                                src={promoVideoUrl}
                                                controls
                                                className="w-full h-full object-contain bg-black"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] text-zinc-500">
                                            <span className="truncate max-w-[400px]">URL: {promoVideoUrl}</span>
                                            <button
                                                type="button"
                                                onClick={() => setPromoVideoUrl('')}
                                                className="text-rose-400 hover:underline cursor-pointer"
                                            >
                                                REMOVE VIDEO
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        {promoVideoMode === 'upload' ? (
                                            <div
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    setIsDraggingVideo(true);
                                                }}
                                                onDragLeave={() => setIsDraggingVideo(false)}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    setIsDraggingVideo(false);
                                                    if (e.dataTransfer.files?.[0]) {
                                                        handleVideoFile(e.dataTransfer.files[0]);
                                                    }
                                                }}
                                                className={`p-6 border-2 border-dashed text-center transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer ${
                                                    isDraggingVideo
                                                        ? 'border-white bg-zinc-900/60'
                                                        : 'border-zinc-800 bg-black/50 hover:border-zinc-700'
                                                }`}
                                                onClick={() => videoFileInputRef.current?.click()}
                                            >
                                                <input
                                                    ref={videoFileInputRef}
                                                    type="file"
                                                    accept="video/mp4,video/webm,video/quicktime"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        if (e.target.files?.[0]) {
                                                            handleVideoFile(e.target.files[0]);
                                                        }
                                                    }}
                                                />
                                                <VideoCameraIcon className="w-6 h-6 text-zinc-500" />
                                                <div className="space-y-0.5">
                                                    <p className="font-bold text-zinc-300 uppercase text-xs">
                                                        DRAG & DROP VIDEO TEASER, OR CLICK TO BROWSE
                                                    </p>
                                                    <p className="text-[10px] text-zinc-500">
                                                        Supports MP4, WebM, QuickTime MOV (Max 50MB). Optional teaser/demo clip.
                                                    </p>
                                                </div>
                                                {isUploadingVideo && (
                                                    <div className="w-full max-w-xs mt-2 space-y-1">
                                                        <div className="h-1.5 w-full bg-zinc-900 overflow-hidden">
                                                            <div
                                                                className="h-full bg-cyan-400 transition-all duration-150"
                                                                style={{ width: `${videoUploadProgress}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[10px] text-zinc-400">
                                                            Uploading video asset: {videoUploadProgress}%
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="space-y-1.5">
                                                <input
                                                    type="url"
                                                    value={promoVideoUrl}
                                                    onChange={(e) => setPromoVideoUrl(e.target.value)}
                                                    placeholder="https://example.com/teaser.mp4 or YouTube / Vimeo embed"
                                                    className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400 text-xs"
                                                />
                                                <p className="text-[10px] text-zinc-500">
                                                    Enter direct public video file URL or video link.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ============================================================== */}
                    {/* STEP 03: SCHEDULE & LOCATION                                   */}
                    {/* ============================================================== */}
                    {currentStep === 3 && (
                        <div className="space-y-6 max-w-3xl mx-auto">
                            {/* Schedule Card */}
                            <div className="p-4 bg-black/40 border border-zinc-850 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CalendarDaysIcon className="w-4 h-4 text-zinc-300" />
                                        <h3 className="font-bold text-white uppercase tracking-wider text-xs">
                                            SCHEDULE & TIMING SPECIFICATION
                                        </h3>
                                    </div>
                                    {calculatedDuration && (
                                        <span className="text-[10px] px-2 py-0.5 bg-zinc-900 border border-zinc-700 text-emerald-400 font-bold uppercase">
                                            DURATION: {calculatedDuration}
                                        </span>
                                    )}
                                </div>

                                {/* Start Date & Time */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-zinc-400 uppercase font-bold block">
                                            START DATE *
                                        </label>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => {
                                                setStartDate(e.target.value);
                                                if (!endDate || endDate < e.target.value) {
                                                    setEndDate(e.target.value);
                                                }
                                            }}
                                            required
                                            className="w-full bg-black border border-zinc-800 p-2.5 text-white focus:outline-none focus:border-zinc-400 text-xs [color-scheme:dark]"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] text-zinc-400 uppercase font-bold block">
                                            START TIME *
                                        </label>
                                        <input
                                            type="time"
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                            required
                                            className="w-full bg-black border border-zinc-800 p-2.5 text-white focus:outline-none focus:border-zinc-400 text-xs [color-scheme:dark]"
                                        />
                                    </div>
                                </div>

                                {/* End Date & Time */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-zinc-400 uppercase font-bold block">
                                            END DATE (OPTIONAL / SAME-DAY)
                                        </label>
                                        <input
                                            type="date"
                                            value={endDate}
                                            min={startDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="w-full bg-black border border-zinc-800 p-2.5 text-white focus:outline-none focus:border-zinc-400 text-xs [color-scheme:dark]"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] text-zinc-400 uppercase font-bold block">
                                            END TIME (OPTIONAL)
                                        </label>
                                        <input
                                            type="time"
                                            value={endTime}
                                            onChange={(e) => setEndTime(e.target.value)}
                                            className="w-full bg-black border border-zinc-800 p-2.5 text-white focus:outline-none focus:border-zinc-400 text-xs [color-scheme:dark]"
                                        />
                                    </div>
                                </div>

                                {/* Quick Duration Shortcuts */}
                                <div className="space-y-1.5 pt-1">
                                    <span className="text-[10px] text-zinc-500 uppercase block">QUICK DURATION PRESETS:</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {[
                                            { label: '+1 HR', hours: 1 },
                                            { label: '+2 HRS', hours: 2 },
                                            { label: '+3 HRS', hours: 3 },
                                            { label: '+4 HRS (HALF DAY)', hours: 4 },
                                            { label: '+8 HRS (FULL DAY)', hours: 8 },
                                        ].map((dur) => (
                                            <button
                                                key={dur.label}
                                                type="button"
                                                onClick={() => applyDuration(dur.hours)}
                                                className="px-2.5 py-1 bg-black border border-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-white uppercase text-[10px] transition-colors cursor-pointer"
                                            >
                                                {dur.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Timezone Searchable Dropdown */}
                                <div className="space-y-1 relative" ref={timezoneDropdownRef}>
                                    <label className="text-[10px] text-zinc-400 uppercase font-bold block">
                                        TIMEZONE (IANA IDENTIFIER) *
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setIsTimezoneDropdownOpen(!isTimezoneDropdownOpen)}
                                        className="w-full bg-black border border-zinc-800 p-2.5 text-left text-white flex items-center justify-between text-xs focus:outline-none focus:border-zinc-400 cursor-pointer"
                                    >
                                        <span className="truncate">{selectedTimezoneLabel}</span>
                                        <span className="text-zinc-500 text-[10px]">▼</span>
                                    </button>

                                    {isTimezoneDropdownOpen && (
                                        <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-[#101014] border border-zinc-700 shadow-2xl max-h-60 flex flex-col">
                                            <div className="p-2 border-b border-zinc-800">
                                                <input
                                                    type="text"
                                                    value={timezoneSearch}
                                                    onChange={(e) => setTimezoneSearch(e.target.value)}
                                                    placeholder="Search city, country, or code (e.g. London, PST, UTC)..."
                                                    className="w-full bg-black border border-zinc-800 p-1.5 text-white text-xs focus:outline-none"
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="overflow-y-auto flex-1">
                                                {filteredTimezones.length === 0 ? (
                                                    <div className="p-3 text-zinc-500 text-center text-xs">
                                                        No matching timezone found.
                                                    </div>
                                                ) : (
                                                    filteredTimezones.map((tz) => (
                                                        <button
                                                            key={tz.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setTimezone(tz.id);
                                                                setIsTimezoneDropdownOpen(false);
                                                                setTimezoneSearch('');
                                                            }}
                                                            className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs transition-colors hover:bg-zinc-800 cursor-pointer ${
                                                                timezone === tz.id ? 'bg-zinc-800/80 text-white font-bold' : 'text-zinc-300'
                                                            }`}
                                                        >
                                                            <span>{tz.label}</span>
                                                            <span className="text-zinc-500 text-[10px] font-mono">{tz.offset}</span>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Format-Specific Location / Meeting Details */}
                            {eventType === 'ONSITE' ? (
                                <div className="p-4 bg-amber-950/20 border border-amber-900/50 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <MapPinIcon className="w-4 h-4 text-amber-400" />
                                        <h3 className="font-bold text-amber-300 uppercase tracking-wider text-xs">
                                            PHYSICAL VENUE SPECIFICATION
                                        </h3>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-[10px] text-zinc-400 uppercase font-bold block">
                                                VENUE NAME *
                                            </label>
                                            <input
                                                type="text"
                                                value={venueName}
                                                onChange={(e) => setVenueName(e.target.value)}
                                                placeholder="e.g. Metropolitan Tech Foundry, Main Hall"
                                                className="w-full bg-black border border-zinc-800 p-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 text-xs"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                            <div className="sm:col-span-2">
                                                <label className="text-[10px] text-zinc-400 uppercase font-bold block">
                                                    STREET ADDRESS *
                                                </label>
                                                <input
                                                    type="text"
                                                    value={address}
                                                    onChange={(e) => setAddress(e.target.value)}
                                                    placeholder="550 Howard Street, Suite 400"
                                                    className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 text-xs"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-[10px] text-zinc-400 uppercase font-bold block">
                                                    CITY *
                                                </label>
                                                <input
                                                    type="text"
                                                    value={city}
                                                    onChange={(e) => setCity(e.target.value)}
                                                    placeholder="San Francisco"
                                                    className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 text-xs"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                            <div>
                                                <label className="text-[10px] text-zinc-400 uppercase block">
                                                    STATE / REGION
                                                </label>
                                                <input
                                                    type="text"
                                                    value={stateRegion}
                                                    onChange={(e) => setStateRegion(e.target.value)}
                                                    placeholder="California"
                                                    className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 text-xs"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-[10px] text-zinc-400 uppercase block">
                                                    POSTAL CODE
                                                </label>
                                                <input
                                                    type="text"
                                                    value={postalCode}
                                                    onChange={(e) => setPostalCode(e.target.value)}
                                                    placeholder="94105"
                                                    className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 text-xs"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-[10px] text-zinc-400 uppercase block">
                                                    COUNTRY
                                                </label>
                                                <input
                                                    type="text"
                                                    value={country}
                                                    onChange={(e) => setCountry(e.target.value)}
                                                    placeholder="United States"
                                                    className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 text-xs"
                                                />
                                            </div>
                                        </div>

                                        {/* Optional Coordinates */}
                                        <div className="grid grid-cols-2 gap-2.5 pt-1">
                                            <div>
                                                <label className="text-[10px] text-zinc-400 uppercase block">
                                                    LATITUDE (OPTIONAL)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={lat}
                                                    onChange={(e) => setLat(e.target.value)}
                                                    placeholder="37.7749"
                                                    className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 text-xs"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-[10px] text-zinc-400 uppercase block">
                                                    LONGITUDE (OPTIONAL)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={lng}
                                                    onChange={(e) => setLng(e.target.value)}
                                                    placeholder="-122.4194"
                                                    className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 text-xs"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] text-zinc-400 uppercase block">
                                                ADDITIONAL VENUE INSTRUCTIONS
                                            </label>
                                            <input
                                                type="text"
                                                value={venueInstructions}
                                                onChange={(e) => setVenueInstructions(e.target.value)}
                                                placeholder="e.g. Check in at north lobby reception desk with INVOX membership badge."
                                                className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 text-xs"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-cyan-950/20 border border-cyan-900/50 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <GlobeAltIcon className="w-4 h-4 text-cyan-400" />
                                        <h3 className="font-bold text-cyan-300 uppercase tracking-wider text-xs">
                                            VIRTUAL ROOM SPECIFICATION
                                        </h3>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            <div>
                                                <label className="text-[10px] text-zinc-400 uppercase font-bold block">
                                                    MEETING PLATFORM *
                                                </label>
                                                <select
                                                    value={platform}
                                                    onChange={(e) => setPlatform(e.target.value)}
                                                    className="w-full bg-black border border-zinc-800 p-2.5 text-white focus:outline-none focus:border-cyan-500 text-xs"
                                                >
                                                    <option value="Google Meet">Google Meet</option>
                                                    <option value="Zoom">Zoom</option>
                                                    <option value="Discord">Discord</option>
                                                    <option value="Microsoft Teams">Microsoft Teams</option>
                                                    <option value="Custom Stream">Custom Stream / WebRTC</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="text-[10px] text-zinc-400 uppercase font-bold block">
                                                    MEETING URL OR ROOM REFERENCE *
                                                </label>
                                                <input
                                                    type="url"
                                                    value={meetingUrl}
                                                    onChange={(e) => setMeetingUrl(e.target.value)}
                                                    placeholder="https://meet.google.com/abc-defg-hij"
                                                    className="w-full bg-black border border-zinc-800 p-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 text-xs"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] text-zinc-400 uppercase block">
                                                MEETING ACCESS INSTRUCTIONS
                                            </label>
                                            <input
                                                type="text"
                                                value={accessInstructions}
                                                onChange={(e) => setAccessInstructions(e.target.value)}
                                                placeholder="Direct meeting link unlocked for confirmed registrants; audio/video enabled for Q&A"
                                                className="w-full bg-black border border-zinc-800 p-2 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 text-xs"
                                            />
                                        </div>

                                        {/* Protected Meeting Credentials */}
                                        <div className="pt-2 border-t border-cyan-900/40 space-y-2">
                                            <label className="flex items-center gap-2 cursor-pointer text-cyan-200">
                                                <input
                                                    type="checkbox"
                                                    checked={requiresProtectedAccess}
                                                    onChange={(e) => setRequiresProtectedAccess(e.target.checked)}
                                                    className="accent-cyan-500 cursor-pointer"
                                                />
                                                <span className="text-[11px] font-bold uppercase">
                                                    ENABLE PROTECTED MEETING CREDENTIALS
                                                </span>
                                            </label>
                                            <p className="text-[10px] text-zinc-400">
                                                Credentials are saved to protected subcollection and only disclosed to confirmed participants.
                                            </p>

                                            {requiresProtectedAccess && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                                                    <div>
                                                        <label className="text-[10px] text-zinc-400 uppercase block">
                                                            ROOM PASSWORD (OPTIONAL)
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={meetingPassword}
                                                            onChange={(e) => setMeetingPassword(e.target.value)}
                                                            placeholder="Password"
                                                            className="w-full bg-black border border-zinc-800 p-2 text-white focus:outline-none focus:border-cyan-500 text-xs"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="text-[10px] text-zinc-400 uppercase block">
                                                            ACCESS CODE / PIN (OPTIONAL)
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={accessCode}
                                                            onChange={(e) => setAccessCode(e.target.value)}
                                                            placeholder="Dial-in PIN"
                                                            className="w-full bg-black border border-zinc-800 p-2 text-white focus:outline-none focus:border-cyan-500 text-xs"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ============================================================== */}
                    {/* STEP 04: REGISTRATION & ACCESS                                 */}
                    {/* ============================================================== */}
                    {currentStep === 4 && (
                        <div className="space-y-6 max-w-3xl mx-auto">
                            {/* Registration Capacity */}
                            <div className="p-4 bg-black/40 border border-zinc-850 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <UsersIcon className="w-4 h-4 text-zinc-300" />
                                        <h3 className="font-bold text-white uppercase tracking-wider text-xs">
                                            REGISTRATION CAPACITY
                                        </h3>
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer text-zinc-300 text-[11px]">
                                        <input
                                            type="checkbox"
                                            checked={isUnlimitedCapacity}
                                            onChange={(e) => setIsUnlimitedCapacity(e.target.checked)}
                                            className="accent-white cursor-pointer"
                                        />
                                        <span>UNLIMITED CAPACITY</span>
                                    </label>
                                </div>

                                {!isUnlimitedCapacity && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                value={capacity}
                                                onChange={(e) => setCapacity(Math.max(1, Number(e.target.value)))}
                                                min={isEditing ? (initialEvent?.registeredCount || 1) : 1}
                                                max={10000}
                                                className="w-36 bg-black border border-zinc-800 p-2 text-white font-mono text-sm focus:outline-none focus:border-zinc-400"
                                            />
                                            <span className="text-zinc-500 text-xs">
                                                Maximum confirmed participants
                                                {isEditing && initialEvent?.registeredCount
                                                    ? ` (current: ${initialEvent.registeredCount})`
                                                    : ''}
                                            </span>
                                        </div>

                                        {/* Capacity Presets */}
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {[25, 50, 80, 100, 200, 500].map((preset) => (
                                                <button
                                                    key={preset}
                                                    type="button"
                                                    onClick={() => setCapacity(preset)}
                                                    className={`px-2.5 py-1 text-[11px] border transition-colors cursor-pointer ${
                                                        capacity === preset
                                                            ? 'bg-zinc-800 border-white text-white font-bold'
                                                            : 'bg-black border-zinc-850 text-zinc-400 hover:text-white'
                                                    }`}
                                                >
                                                    {preset} SLOTS
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Eligibility Policy */}
                            <div className="p-4 bg-black/40 border border-zinc-850 space-y-3">
                                <div className="flex items-center gap-2">
                                    <ShieldCheckIcon className="w-4 h-4 text-zinc-300" />
                                    <h3 className="font-bold text-white uppercase tracking-wider text-xs">
                                        PARTICIPATION ELIGIBILITY & ACCESS POLICY
                                    </h3>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                    {[
                                        {
                                            id: 'ALL_MEMBERS',
                                            title: 'ALL MEMBERS (DEFAULT)',
                                            desc: 'Any verified member of this collective can register and participate.',
                                        },
                                        {
                                            id: 'ADMINS_ONLY',
                                            title: 'COUNCIL ONLY',
                                            desc: 'Restricted gathering strictly for appointed administrators and council.',
                                        },
                                        {
                                            id: 'PUBLIC',
                                            title: 'PUBLIC ACCESS',
                                            desc: community.visibility === 'public'
                                                ? 'Open to external INVOX ecosystem participants.'
                                                : 'Requires private collective membership approval first.',
                                        },
                                    ].map((policy) => (
                                        <div
                                            key={policy.id}
                                            onClick={() => setAccessPolicy(policy.id as any)}
                                            className={`p-3 border transition-colors cursor-pointer flex flex-col justify-between ${
                                                accessPolicy === policy.id
                                                    ? 'bg-zinc-900 border-white text-white font-bold'
                                                    : 'bg-black border-zinc-850 text-zinc-400 hover:border-zinc-700'
                                            }`}
                                        >
                                            <div>
                                                <p className="uppercase text-xs tracking-wider">{policy.title}</p>
                                                <p className="text-[10px] text-zinc-500 mt-1 leading-normal">
                                                    {policy.desc}
                                                </p>
                                            </div>
                                            <div className="mt-2 text-[10px]">
                                                {accessPolicy === policy.id ? '● ACTIVE' : '○ SELECT'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Additional Instructions */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider block">
                                    PARTICIPANT PREPARATION & PREREQUISITES
                                </label>
                                <textarea
                                    value={participationInstructions}
                                    onChange={(e) => setParticipationInstructions(e.target.value)}
                                    placeholder="e.g. Ensure local development environment has Node.js 20+ and Docker configured; review architectural draft prior to assembly..."
                                    rows={3}
                                    className="w-full bg-black border border-zinc-800 p-3 text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400 text-xs font-mono leading-relaxed"
                                />
                            </div>
                        </div>
                    )}

                    {/* ============================================================== */}
                    {/* STEP 05: REVIEW & PUBLISH                                      */}
                    {/* ============================================================== */}
                    {currentStep === 5 && (
                        <div className="space-y-6 max-w-3xl mx-auto">
                            {/* Event Preview Dossier Card */}
                            <div className="border border-zinc-800 bg-[#0c0c0f] overflow-hidden">
                                {/* Banner / Media Header */}
                                {coverImageUrl ? (
                                    <div className="relative aspect-video max-h-60 w-full overflow-hidden bg-black">
                                        <img
                                            src={coverImageUrl}
                                            alt={title}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                                        <div className="absolute top-3 left-3 flex items-center gap-2">
                                            <span
                                                className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
                                                    eventType === 'ONSITE'
                                                        ? 'bg-amber-950/80 border border-amber-500 text-amber-300'
                                                        : 'bg-cyan-950/80 border border-cyan-500 text-cyan-300'
                                                }`}
                                            >
                                                {eventType === 'ONSITE' ? 'ON-SITE CONCLAVE' : 'VIRTUAL CONCLAVE'}
                                            </span>
                                            <span className="px-2 py-1 bg-black/80 border border-zinc-700 text-zinc-300 text-xs font-mono">
                                                {category === 'CUSTOM' ? customCategory : category}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 border-b border-zinc-850 bg-black/60 flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
                                                    eventType === 'ONSITE'
                                                        ? 'bg-amber-950/80 border border-amber-500 text-amber-300'
                                                        : 'bg-cyan-950/80 border border-cyan-500 text-cyan-300'
                                                }`}
                                            >
                                                {eventType === 'ONSITE' ? 'ON-SITE CONCLAVE' : 'VIRTUAL CONCLAVE'}
                                            </span>
                                            <span className="px-2 py-1 bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs">
                                                {category === 'CUSTOM' ? customCategory : category}
                                            </span>
                                        </div>
                                        <span className="text-zinc-500 text-xs">
                                            {isEditing ? '[EDITING EVENT]' : '[READY FOR PUBLICATION]'}
                                        </span>
                                    </div>
                                )}

                                {/* Content Details */}
                                <div className="p-5 space-y-5">
                                    {/* Title & Description */}
                                    <div className="space-y-2">
                                        <h1 className="text-lg font-bold text-white uppercase tracking-tight">
                                            {title || 'UNTITLED CONCLAVE'}
                                        </h1>
                                        <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap text-xs">
                                            {description || 'No description provided.'}
                                        </p>
                                    </div>

                                    {/* Promotional Video preview if attached */}
                                    {promoVideoUrl && (
                                        <div className="p-3 bg-black border border-zinc-850 space-y-1.5">
                                            <p className="text-[10px] text-zinc-400 font-bold uppercase">ATTACHED VIDEO TEASER:</p>
                                            <div className="aspect-video max-h-48 overflow-hidden bg-black">
                                                <video src={promoVideoUrl} controls className="w-full h-full object-contain" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Schedule Summary Card */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-black border border-zinc-850">
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-zinc-500 uppercase block font-bold">
                                                DATE & TIME
                                            </span>
                                            <p className="text-white font-bold">
                                                {startDate} · {startTime}
                                                {endTime ? ` - ${endTime}` : ''}
                                            </p>
                                            <p className="text-zinc-400 text-[11px]">
                                                Timezone: {timezone}
                                                {calculatedDuration ? ` (${calculatedDuration})` : ''}
                                            </p>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-[10px] text-zinc-500 uppercase block font-bold">
                                                REGISTRATION & CAPACITY
                                            </span>
                                            <p className="text-emerald-400 font-bold uppercase">
                                                {isUnlimitedCapacity ? 'UNLIMITED PARTICIPANTS' : `${capacity} MAXIMUM SEATS`}
                                            </p>
                                            <p className="text-zinc-400 text-[11px]">
                                                Eligibility: {accessPolicy}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Location / Meeting Summary */}
                                    <div className="p-3.5 bg-black border border-zinc-850 space-y-2">
                                        {eventType === 'ONSITE' ? (
                                            <div className="space-y-1">
                                                <span className="text-[10px] text-amber-400 uppercase font-bold block">
                                                    ON-SITE VENUE SPECIFICATION
                                                </span>
                                                <p className="text-white font-bold">{venueName || 'Pending venue name'}</p>
                                                <p className="text-zinc-400">
                                                    {address} {city ? `· ${city}` : ''} {stateRegion ? `· ${stateRegion}` : ''}
                                                </p>
                                                {venueInstructions && (
                                                    <p className="text-zinc-500 italic text-[11px] pt-1">
                                                        Check-in instructions: {venueInstructions}
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <span className="text-[10px] text-cyan-400 uppercase font-bold block">
                                                    VIRTUAL MEETING SPECIFICATION
                                                </span>
                                                <p className="text-white font-bold">Platform: {platform}</p>
                                                <p className="text-zinc-400">
                                                    Meeting link will be unlocked upon confirmed participant registration.
                                                </p>
                                                {accessInstructions && (
                                                    <p className="text-zinc-500 italic text-[11px]">
                                                        Note: {accessInstructions}
                                                    </p>
                                                )}
                                                {requiresProtectedAccess && (
                                                    <span className="inline-block text-[10px] text-cyan-300 bg-cyan-950/60 border border-cyan-800 px-2 py-0.5 mt-1 font-bold">
                                                        ENCRYPTED CREDENTIALS ENABLED (PASSWORD/PIN)
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Organizer Snapshot */}
                                    <div className="flex items-center justify-between border-t border-zinc-850 pt-3 text-[11px] text-zinc-500">
                                        <div className="flex items-center gap-2">
                                            <span className="text-zinc-400">CONCLAVE ORGANIZER:</span>
                                            <strong className="text-white">
                                                {currentUser?.displayName || userProfile?.displayName || 'Council Organizer'}
                                            </strong>
                                        </div>
                                        <span>Status: {initialEvent?.eventStatus || 'UNPUBLISHED'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer / Navigation Controls */}
                <div className="p-4 sm:p-5 border-t border-zinc-800 bg-black/60 flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                        {currentStep > 1 && (
                            <button
                                type="button"
                                onClick={handlePrev}
                                className="px-4 py-2 bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white uppercase font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                                <ChevronLeftIcon className="w-4 h-4" />
                                <span>PREVIOUS STEP</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCancel();
                            }}
                            className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white uppercase font-bold text-xs transition-colors cursor-pointer"
                        >
                            CANCEL
                        </button>
                    </div>

                    <div className="flex items-center gap-2.5">
                        {currentStep < 5 ? (
                            <>
                                {/* Save as Draft shortcut available at any step */}
                                <button
                                    type="button"
                                    onClick={handleSaveDraft}
                                    disabled={submitting}
                                    className="px-4 py-2 bg-purple-950/50 border border-purple-700/80 text-purple-300 hover:bg-purple-900 font-bold uppercase text-xs transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    {submitting ? 'SAVING...' : 'SAVE DRAFT'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    className="px-5 py-2 bg-white text-black font-bold uppercase text-xs hover:bg-zinc-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>CONTINUE</span>
                                    <ChevronRightIcon className="w-4 h-4" />
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => handleStepJump(1)}
                                    className="px-3.5 py-2 bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white font-bold uppercase text-xs transition-colors cursor-pointer"
                                >
                                    BACK TO EDIT
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveDraft}
                                    disabled={submitting}
                                    className="px-4 py-2 bg-purple-950/60 border border-purple-600 text-purple-200 hover:bg-purple-900 font-bold uppercase text-xs transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    {submitting ? 'SAVING DRAFT...' : 'SAVE AS DRAFT'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handlePublish}
                                    disabled={submitting}
                                    className="px-5 py-2 bg-white text-black font-bold uppercase text-xs hover:bg-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    {submitting ? 'PUBLISHING...' : isEditing && initialEvent?.eventStatus === 'PUBLISHED' ? 'UPDATE CONCLAVE' : 'PUBLISH CONCLAVE'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Discard Confirmation Modal */}
            {showDiscardConfirm && (
                <div 
                    className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4 font-mono"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowDiscardConfirm(false);
                        }
                    }}
                >
                    <div 
                        className="bg-[#0f0f13] border border-zinc-700 max-w-md w-full p-5 space-y-4 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2 text-rose-400">
                            <AlertTriangleIcon className="w-5 h-5 text-rose-400" />
                            <h4 className="font-bold uppercase text-sm">DISCARD UNFINISHED CONCLAVE?</h4>
                        </div>
                        <p className="text-zinc-300 text-xs leading-relaxed">
                            You have unsaved changes in the Conclave architect. If you discard now, all entered event information, schedule parameters, and uploaded media will be lost.
                        </p>
                        <div className="pt-2 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setShowDiscardConfirm(false)}
                                className="px-4 py-2 bg-zinc-900 border border-zinc-700 text-white font-bold uppercase text-xs hover:bg-zinc-800 cursor-pointer"
                            >
                                CONTINUE EDITING
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowDiscardConfirm(false);
                                    handleDirectClose();
                                }}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold uppercase text-xs transition-colors cursor-pointer"
                            >
                                DISCARD & EXIT
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
