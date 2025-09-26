// Security utilities for OWASP compliance

import { toast } from 'sonner';

// Security headers and configuration
export const SECURITY_CONFIG = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  MAX_UPLOAD_ATTEMPTS: 3,
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
  IDLE_TIMEOUT: 2 * 60 * 60 * 1000, // 2 hours
} as const;

// Secure error handling - don't expose system details
export const handleSecureError = (error: unknown, userMessage?: string): void => {
  const message = userMessage || 'An unexpected error occurred. Please try again.';
  
  // In development, you might want to show more details
  if (process.env.NODE_ENV === 'development') {
    console.error('Development Error:', error);
  }
  
  // Always show user-friendly message
  toast.error(message, {
    className: 'bg-error text-error-foreground border-error'
  });
};

// Validate file uploads
export const validateFileUpload = (file: File): boolean => {
  if (file.size > SECURITY_CONFIG.MAX_FILE_SIZE) {
    toast.error('File too large', {
      description: 'Please upload a file smaller than 5MB'
    });
    return false;
  }
  
  if (!SECURITY_CONFIG.ALLOWED_FILE_TYPES.includes(file.type as any)) {
    toast.error('Invalid file type', {
      description: 'Only JPEG, PNG, and WebP images are allowed'
    });
    return false;
  }
  
  return true;
};

// Secure localStorage operations
export const secureStorage = {
  set: (key: string, value: any): void => {
    try {
      const timestamp = Date.now();
      const data = { value, timestamp };
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      handleSecureError(error, 'Failed to save data locally');
    }
  },
  
  get: (key: string, maxAge: number = SECURITY_CONFIG.SESSION_TIMEOUT): any => {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;
      
      const data = JSON.parse(item);
      const now = Date.now();
      
      if (now - data.timestamp > maxAge) {
        localStorage.removeItem(key);
        return null;
      }
      
      return data.value;
    } catch (error) {
      localStorage.removeItem(key);
      return null;
    }
  },
  
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      // Silent fail for security
    }
  },
  
  clear: (): void => {
    try {
      localStorage.clear();
    } catch (error) {
      // Silent fail for security
    }
  }
};

// Input sanitization for display purposes
export const sanitizeForDisplay = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Validate UUID format
export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Generate secure random IDs for client-side use
export const generateSecureId = (): string => {
  return crypto.randomUUID();
};

// Validate and sanitize URLs
export const validateUrl = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    // Only allow HTTP/HTTPS protocols
    return ['http:', 'https:'].includes(parsedUrl.protocol);
  } catch {
    return false;
  }
};

// Content Security Policy helpers
export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'script-src': ["'self'", "'unsafe-inline'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'font-src': ["'self'"],
  'connect-src': ["'self'", 'https:'],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"]
};

// Session management
export const sessionManager = {
  isActive: (): boolean => {
    const worker = secureStorage.get('worker');
    return !!worker;
  },
  
  extend: (): void => {
    const worker = secureStorage.get('worker');
    if (worker) {
      secureStorage.set('worker', worker);
    }
  },
  
  destroy: (): void => {
    secureStorage.clear();
  },
  
  checkIdle: (): boolean => {
    const lastActivity = secureStorage.get('lastActivity');
    if (!lastActivity) return false;
    
    const now = Date.now();
    return (now - lastActivity) > SECURITY_CONFIG.IDLE_TIMEOUT;
  },
  
  updateActivity: (): void => {
    secureStorage.set('lastActivity', Date.now());
  }
};

// Geolocation security
export const secureGeolocation = {
  getCurrentPosition: (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      
      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      };
      
      navigator.geolocation.getCurrentPosition(
        resolve,
        (error) => {
          let message = 'Location access failed';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'Location access denied. Please enable location services.';
              break;
            case error.POSITION_UNAVAILABLE:
              message = 'Location information unavailable.';
              break;
            case error.TIMEOUT:
              message = 'Location request timed out.';
              break;
          }
          reject(new Error(message));
        },
        options
      );
    });
  }
};