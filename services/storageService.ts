import {
    UploadTaskSnapshot,
    deleteObject,
    getDownloadURL,
    ref,
    uploadBytesResumable,
} from 'firebase/storage';
import { storage } from '../firebase';

const DEFAULT_MAX_FILE_SIZE = 20 * 1024 * 1024;

export interface UploadOptions {
    allowedTypes?: string[];
    maxSizeBytes?: number;
    metadata?: Record<string, string>;
    onProgress?: (progress: number, snapshot: UploadTaskSnapshot) => void;
}

export interface UploadedFile {
    path: string;
    url: string;
    name: string;
    size: number;
    contentType: string;
}

export const validateFile = (file: File, options: UploadOptions = {}) => {
    const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_FILE_SIZE;

    if (file.size > maxSizeBytes) {
        throw new Error(`File must be smaller than ${Math.round(maxSizeBytes / 1024 / 1024)}MB.`);
    }

    if (options.allowedTypes?.length && !options.allowedTypes.includes(file.type)) {
        throw new Error('This file type is not supported.');
    }
};

export const uploadFile = async (path: string, file: File, options: UploadOptions = {}): Promise<UploadedFile> => {
    validateFile(file, options);

    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type,
        customMetadata: options.metadata,
    });

    await new Promise<void>((resolve, reject) => {
        uploadTask.on(
            'state_changed',
            snapshot => {
                const progress = snapshot.totalBytes > 0
                    ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
                    : 0;
                options.onProgress?.(progress, snapshot);
            },
            reject,
            resolve,
        );
    });

    const url = await getDownloadURL(uploadTask.snapshot.ref);

    return {
        path,
        url,
        name: file.name,
        size: file.size,
        contentType: file.type,
    };
};

export const deleteFile = async (path: string) => {
    await deleteObject(ref(storage, path));
};

export const getStoragePath = (scope: string, ownerId: string, fileName: string) => {
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${scope}/${ownerId}/${Date.now()}-${safeFileName}`;
};
