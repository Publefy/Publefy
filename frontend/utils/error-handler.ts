/**
 * Utility functions for handling API errors
 */

export interface ApiError {
  message: string;
  isDuplicateKey: boolean;
  isNetworkError: boolean;
  isAuthError: boolean;
  statusCode?: number;
}

/**
 * Checks if an error is a MongoDB duplicate key error
 */
export function isDuplicateKeyError(error: any): boolean {
  const errorMessage = 
    error?.response?.data?.error || 
    error?.response?.data?.message || 
    error?.message || 
    '';
  
  return (
    errorMessage.includes('E11000') ||
    errorMessage.includes('duplicate key') ||
    errorMessage.includes('already exists') ||
    errorMessage.includes('duplicate entry')
  );
}

/**
 * Checks if an error is a network error
 */
export function isNetworkError(error: any): boolean {
  return !error?.response && error?.message?.includes('Network');
}

/**
 * Checks if an error is an authentication error
 */
export function isAuthError(error: any): boolean {
  return error?.response?.status === 401 || error?.response?.status === 403;
}

/**
 * Extracts a user-friendly error message from an API error
 */
export function getErrorMessage(error: any): string {
  if (isDuplicateKeyError(error)) {
    // Check if it's a profile duplicate
    const errorMessage = error?.response?.data?.error || error?.message || '';
    if (errorMessage.includes('profile') || errorMessage.includes('ig_id') || errorMessage.includes('fb_id')) {
      return 'This account is already connected to your profile. You can use it right away!';
    }
    return 'This item already exists. No action needed.';
  }
  
  if (isAuthError(error)) {
    return 'Your session has expired. Please log in again.';
  }
  
  if (isNetworkError(error)) {
    return 'Network error. Please check your internet connection and try again.';
  }
  
  // Try to extract a meaningful error message
  const errorMessage = 
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    'An unexpected error occurred. Please try again.';
  
  return errorMessage;
}

/**
 * Parses an API error into a structured format
 */
export function parseApiError(error: any): ApiError {
  return {
    message: getErrorMessage(error),
    isDuplicateKey: isDuplicateKeyError(error),
    isNetworkError: isNetworkError(error),
    isAuthError: isAuthError(error),
    statusCode: error?.response?.status,
  };
}

