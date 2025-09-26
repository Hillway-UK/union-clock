import { z } from 'zod';

// OWASP-compliant validation schemas

// Authentication validation
export const emailSchema = z.object({
  email: z.string()
    .trim()
    .email('Please enter a valid email address')
    .max(255, 'Email must be less than 255 characters')
    .toLowerCase()
});

export const passwordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  confirmPassword: z.string().optional()
}).refine((data) => !data.confirmPassword || data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

export const loginSchema = z.object({
  email: z.string()
    .trim()
    .email('Please enter a valid email address')
    .max(255, 'Email must be less than 255 characters')
    .toLowerCase(),
  password: z.string()
    .min(1, 'Password is required')
    .max(128, 'Password is too long')
});

// Worker data validation
export const workerProfileSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes'),
  email: z.string()
    .trim()
    .email('Please enter a valid email address')
    .max(255, 'Email must be less than 255 characters')
    .toLowerCase(),
  phone: z.string()
    .trim()
    .max(20, 'Phone number must be less than 20 characters')
    .regex(/^[\d\s\-\+\(\)]+$/, 'Invalid phone number format')
    .optional()
    .or(z.literal('')),
  hourly_rate: z.number()
    .min(0, 'Hourly rate must be non-negative')
    .max(9999.99, 'Hourly rate is too high')
    .optional()
});

// Expense validation
export const expenseSchema = z.object({
  description: z.string()
    .trim()
    .min(1, 'Description is required')
    .max(255, 'Description must be less than 255 characters')
    .regex(/^[a-zA-Z0-9\s\-\.,!?]+$/, 'Description contains invalid characters'),
  amount: z.number()
    .min(0.01, 'Amount must be greater than 0')
    .max(99999.99, 'Amount is too large')
});

// Amendment request validation
export const amendmentSchema = z.object({
  reason: z.string()
    .trim()
    .min(10, 'Please provide a detailed reason (at least 10 characters)')
    .max(500, 'Reason must be less than 500 characters'),
  requested_clock_in: z.string()
    .datetime('Invalid clock in time format')
    .optional(),
  requested_clock_out: z.string()
    .datetime('Invalid clock out time format')
    .optional()
});

// Manual entry validation
export const manualEntrySchema = z.object({
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  job_id: z.string()
    .uuid('Invalid job ID'),
  clock_in_time: z.string()
    .regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  clock_out_time: z.string()
    .regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  notes: z.string()
    .trim()
    .max(500, 'Notes must be less than 500 characters')
    .optional()
    .or(z.literal(''))
});

// Job site validation
export const jobSiteSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Job name is required')
    .max(100, 'Job name must be less than 100 characters'),
  code: z.string()
    .trim()
    .min(1, 'Job code is required')
    .max(20, 'Job code must be less than 20 characters')
    .regex(/^[A-Z0-9\-]+$/, 'Job code can only contain uppercase letters, numbers, and hyphens'),
  latitude: z.number()
    .min(-90, 'Invalid latitude')
    .max(90, 'Invalid latitude'),
  longitude: z.number()
    .min(-180, 'Invalid longitude')
    .max(180, 'Invalid longitude'),
  geofence_radius: z.number()
    .min(1, 'Geofence radius must be at least 1 meter')
    .max(10000, 'Geofence radius cannot exceed 10km')
});

// Generic sanitization helpers
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:/gi, '') // Remove data: protocol
    .slice(0, 1000); // Limit length to prevent DoS
};

export const sanitizeNumericInput = (input: number): number => {
  if (!Number.isFinite(input)) {
    throw new Error('Invalid numeric input');
  }
  return Math.max(0, Math.min(input, 999999)); // Reasonable bounds
};

// Rate limiting helpers (for client-side rate limiting)
export const createRateLimit = (windowMs: number, maxRequests: number) => {
  const requests: number[] = [];
  
  return (): boolean => {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Remove old requests outside the window
    while (requests.length > 0 && requests[0] < windowStart) {
      requests.shift();
    }
    
    // Check if we've exceeded the limit
    if (requests.length >= maxRequests) {
      return false;
    }
    
    // Add current request
    requests.push(now);
    return true;
  };
};

// Create rate limiters for different operations
export const loginRateLimit = createRateLimit(15 * 60 * 1000, 5); // 5 attempts per 15 minutes
export const passwordResetRateLimit = createRateLimit(60 * 60 * 1000, 3); // 3 attempts per hour