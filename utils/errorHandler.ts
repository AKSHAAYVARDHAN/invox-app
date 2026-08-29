export const getFriendlyErrorMessage = (error: any): string => {
    if (!error) return 'An unknown error occurred.';

    // Extract error code if available directly or via message regex
    let code: string = '';
    if (typeof error === 'object' && error?.code && typeof error.code === 'string') {
        code = error.code.trim();
    } else {
        const errorString = typeof error === 'string' ? error : (error?.message || '');
        const authMatch = errorString.match(/\b(auth\/[a-z0-9-]+)\b/i);
        const storageMatch = errorString.match(/\b(storage\/[a-z0-9-]+)\b/i);
        const firestoreMatch = errorString.match(/\b(firestore\/[a-z0-9-]+)\b/i) || errorString.match(/\b(permission-denied|unavailable|resource-exhausted)\b/i);
        
        if (authMatch) {
            code = authMatch[1];
        } else if (storageMatch) {
            code = storageMatch[1];
        } else if (firestoreMatch) {
            code = firestoreMatch[1];
        }
    }

    if (code) {
        switch (code.toLowerCase()) {
            // Authentication errors
            case 'auth/invalid-credential':
            case 'auth/wrong-password':
                return 'Your email or password is incorrect. Please try again.';
            case 'auth/invalid-email':
                return 'The email address provided is not valid.';
            case 'auth/user-disabled':
                return 'This account has been disabled. Please contact support.';
            case 'auth/user-not-found':
                return 'No account exists with this email address.';
            case 'auth/email-already-in-use':
                return 'This email address is already in use by another account.';
            case 'auth/weak-password':
                return 'Your password is too weak. Please use at least 6 characters.';
            case 'auth/unauthorized-domain': {
                const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
                return currentHost
                    ? `This domain (${currentHost}) is not authorized in Firebase. Please add "${currentHost}" to Firebase Console → Authentication → Settings → Authorized domains.`
                    : 'This domain is not authorized for authentication. Please add it to Authorized Domains in the Firebase Console (Authentication > Settings > Authorized domains).';
            }
            case 'auth/network-request-failed':
                return 'Network error. Please check your internet connection.';
            case 'auth/too-many-requests':
                return 'Access to this account has been temporarily disabled due to many failed login attempts. Please try again later or reset your password.';
            case 'auth/popup-closed-by-user':
                return 'Sign-in popup was closed before completion.';
            case 'auth/popup-blocked':
                return 'Sign-in popup was blocked by your browser. Please allow popups for this site.';
            case 'auth/operation-not-allowed':
                return 'This sign-in method is not enabled in the Firebase Console.';
            case 'auth/account-exists-with-different-credential':
                return 'An account already exists with the same email address using a different sign-in method.';
            case 'auth/requires-recent-login':
                return 'This action requires recent authentication. Please log in again.';
            case 'auth/expired-action-code':
                return 'The action link or code has expired. Please request a new one.';
            case 'auth/invalid-action-code':
                return 'The action link or code is invalid or has already been used.';
            
            // Storage errors
            case 'storage/unauthorized':
                return 'You do not have permission to access or upload this file.';
            case 'storage/canceled':
                return 'File upload was cancelled.';
            case 'storage/unknown':
                return 'An unknown error occurred during file upload.';
            case 'storage/quota-exceeded':
                return 'Storage quota exceeded. Please free up space and try again.';
            case 'storage/object-not-found':
                return 'The requested file was not found.';

            // Firestore / General errors
            case 'permission-denied':
                return 'You do not have permission to perform this operation.';
            case 'unavailable':
                return 'The service is temporarily unavailable. Please try again in a moment.';
            default:
                break;
        }
    }

    // Clean up raw error strings if no known code matched
    const rawMessage = typeof error === 'string' ? error : (error?.message || '');
    if (rawMessage) {
        // Strip prefixes like "AppError: " or "Firebase: Error (auth/...): "
        const cleaned = rawMessage
            .replace(/^AppError\s*:?\s*/i, '')
            .replace(/^Firebase:\s*Error\s*\([^)]*\)\s*:?\s*/i, '')
            .trim();
        if (cleaned) return cleaned;
    }

    return 'An unexpected error occurred. Please try again.';
};
