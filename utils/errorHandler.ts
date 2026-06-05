export const getFriendlyErrorMessage = (error: any): string => {
    if (!error) return 'An unknown error occurred.';

    // If it's a string, just return it
    if (typeof error === 'string') return error;

    // Handle Firebase Auth errors
    if (error.code) {
        switch (error.code) {
            case 'auth/invalid-credential':
                return 'Invalid email or password. Please try again.';
            case 'auth/user-disabled':
                return 'This account has been disabled. Please contact support.';
            case 'auth/too-many-requests':
                return 'Access to this account has been temporarily disabled due to many failed login attempts. Please try again later.';
            case 'auth/email-already-in-use':
                return 'This email address is already in use by another account.';
            case 'auth/weak-password':
                return 'Your password is too weak. Please use at least 6 characters.';
            case 'auth/invalid-email':
                return 'The email address provided is not valid.';
            case 'auth/user-not-found':
                return 'No account exists for that email address.';
            case 'auth/popup-closed-by-user':
                return 'Sign-in popup was closed before completion.';
            case 'auth/network-request-failed':
                return 'Network error. Please check your internet connection.';
            case 'storage/unauthorized':
                return 'You do not have permission to access this file.';
            case 'storage/canceled':
                return 'File upload was cancelled.';
            case 'storage/unknown':
                return 'An unknown error occurred during file upload.';
            default:
                return error.message || 'An unexpected error occurred. Please try again.';
        }
    }

    // Return the native error message if available
    if (error.message) return error.message;

    return 'An unexpected error occurred. Please try again.';
};
