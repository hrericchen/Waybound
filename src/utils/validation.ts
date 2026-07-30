/**
 * Input validation and sanitization utilities
 * Prevents XSS, injection attacks, and ensures data integrity
 */

export const ValidationRules = {
  email: {
    pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    maxLength: 254,
    minLength: 5,
    message: 'Please enter a valid email address'
  },
  password: {
    minLength: 8,
    maxLength: 128,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    message: 'Password must be at least 8 characters with uppercase, lowercase, and number'
  },
  name: {
    maxLength: 100,
    minLength: 2,
    pattern: /^[a-zA-Z\s'-]+$/,
    message: 'Name can only contain letters, spaces, hyphens, and apostrophes'
  },
  address: {
    maxLength: 200,
    minLength: 5,
    message: 'Please enter a valid address'
  }
};

/**
 * Validates email format
 */
export const validateEmail = (email: string): { valid: boolean; error?: string } => {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }
  
  const trimmed = email.trim().toLowerCase();
  
  if (trimmed.length < ValidationRules.email.minLength) {
    return { valid: false, error: 'Email is too short' };
  }
  
  if (trimmed.length > ValidationRules.email.maxLength) {
    return { valid: false, error: 'Email is too long' };
  }
  
  if (!ValidationRules.email.pattern.test(trimmed)) {
    return { valid: false, error: ValidationRules.email.message };
  }
  
  return { valid: true };
};

/**
 * Validates password strength
 */
export const validatePassword = (password: string): { valid: boolean; error?: string; strength: 'weak' | 'medium' | 'strong' } => {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required', strength: 'weak' };
  }
  
  if (password.length < ValidationRules.password.minLength) {
    return { valid: false, error: `Password must be at least ${ValidationRules.password.minLength} characters`, strength: 'weak' };
  }
  
  if (password.length > ValidationRules.password.maxLength) {
    return { valid: false, error: 'Password is too long', strength: 'weak' };
  }
  
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const strength = (hasLower && hasUpper && hasNumber && hasSpecial) ? 'strong' :
                   (hasLower && hasUpper && hasNumber) ? 'medium' : 'weak';
  
  if (!hasLower || !hasUpper || !hasNumber) {
    return { valid: false, error: ValidationRules.password.message, strength };
  }
  
  return { valid: true, strength };
};

/**
 * Validates name format
 */
export const validateName = (name: string): { valid: boolean; error?: string } => {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Name is required' };
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length < ValidationRules.name.minLength) {
    return { valid: false, error: 'Name is too short' };
  }
  
  if (trimmed.length > ValidationRules.name.maxLength) {
    return { valid: false, error: 'Name is too long' };
  }
  
  if (!ValidationRules.name.pattern.test(trimmed)) {
    return { valid: false, error: ValidationRules.name.message };
  }
  
  return { valid: true };
};

/**
 * Validates address
 */
export const validateAddress = (address: string): { valid: boolean; error?: string } => {
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'Address is required' };
  }
  
  const trimmed = address.trim();
  
  if (trimmed.length < ValidationRules.address.minLength) {
    return { valid: false, error: 'Address is too short' };
  }
  
  if (trimmed.length > ValidationRules.address.maxLength) {
    return { valid: false, error: 'Address is too long' };
  }
  
  return { valid: true };
};

/**
 * Sanitizes string input to prevent XSS
 */
export const sanitizeString = (input: string): string => {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/\\/g, '&#x5C;');
};

/**
 * Validates form data
 */
export const validateForm = (data: Record<string, any>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (data.email) {
    const emailResult = validateEmail(data.email);
    if (!emailResult.valid) errors.push(emailResult.error!);
  }
  
  if (data.password) {
    const passwordResult = validatePassword(data.password);
    if (!passwordResult.valid) errors.push(passwordResult.error!);
  }
  
  if (data.name) {
    const nameResult = validateName(data.name);
    if (!nameResult.valid) errors.push(nameResult.error!);
  }
  
  if (data.address) {
    const addressResult = validateAddress(data.address);
    if (!addressResult.valid) errors.push(addressResult.error!);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Generic error message for security (prevents information leakage)
 */
export const getGenericErrorMessage = (error: any): string => {
  if (typeof error === 'string') {
    return 'An error occurred. Please try again.';
  }
  
  if (error?.message) {
    // Don't expose internal error messages
    if (error.message.includes('ECONNREFUSED') || 
        error.message.includes('ENOTFOUND') ||
        error.message.includes('timeout')) {
      return 'Service temporarily unavailable. Please try again later.';
    }
    return 'An error occurred. Please try again.';
  }
  
  return 'An error occurred. Please try again.';
};