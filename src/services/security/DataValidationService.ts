import { ActivityApiFormat, PhotoApiFormat, TrackPointApiFormat } from '../../types';

export interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'boolean' | 'email' | 'uuid' | 'coordinate' | 'timestamp' | 'url';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  customValidator?: (value: any) => boolean;
}

export interface SanitizationOptions {
  stripHtml?: boolean;
  trimWhitespace?: boolean;
  normalizeUnicode?: boolean;
  maxLength?: number;
  allowedCharacters?: RegExp;
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string, public value?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class DataValidationService {
  private static instance: DataValidationService | null = null;

  // Common validation patterns
  private static readonly PATTERNS = {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    COORDINATE: /^-?([1-8]?\d(\.\d+)?|90(\.0+)?)$/,
    URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
    SAFE_STRING: /^[a-zA-Z0-9\s\-_.,!?()]+$/,
  };

  static getInstance(): DataValidationService {
    if (!DataValidationService.instance) {
      DataValidationService.instance = new DataValidationService();
    }
    return DataValidationService.instance;
  }

  /**
   * Validate and sanitize activity data
   */
  validateActivity(activity: Partial<ActivityApiFormat>): ActivityApiFormat {
    const rules: ValidationRule[] = [
      { field: 'activityId', type: 'uuid', required: true },
      { field: 'userId', type: 'uuid', required: true },
      { field: 'startedAt', type: 'timestamp', required: true },
      { field: 'endedAt', type: 'timestamp', required: false },
      { field: 'status', type: 'string', required: true, pattern: /^(active|paused|completed)$/ },
      { field: 'durationSec', type: 'number', required: false, min: 0, max: 86400 * 7 }, // Max 7 days
      { field: 'distanceM', type: 'number', required: false, min: 0, max: 1000000 }, // Max 1000km
      { field: 'avgPaceSecPerKm', type: 'number', required: false, min: 60, max: 3600 }, // 1min to 1hour per km
      { field: 'elevGainM', type: 'number', required: false, min: 0, max: 10000 }, // Max 10km elevation
      { field: 'elevLossM', type: 'number', required: false, min: 0, max: 10000 },
    ];

    const validated = this.validateObject(activity, rules);

    // Additional activity-specific validations
    if (validated.endedAt && validated.startedAt && validated.endedAt <= validated.startedAt) {
      throw new ValidationError('End time must be after start time', 'endedAt');
    }

    if (validated.status === 'completed' && !validated.endedAt) {
      throw new ValidationError('Completed activities must have an end time', 'endedAt');
    }

    // Sanitize string fields
    if (validated.polyline) {
      validated.polyline = this.sanitizeString(validated.polyline, { maxLength: 100000 });
    }

    return validated as ActivityApiFormat;
  }

  /**
   * Validate and sanitize photo data
   */
  validatePhoto(photo: Partial<PhotoApiFormat>): PhotoApiFormat {
    const rules: ValidationRule[] = [
      { field: 'photoId', type: 'uuid', required: true },
      { field: 'activityId', type: 'uuid', required: true },
      { field: 'timestamp', type: 'timestamp', required: true },
      { field: 'latitude', type: 'coordinate', required: true },
      { field: 'longitude', type: 'coordinate', required: true },
      { field: 'localUri', type: 'string', required: true, maxLength: 500 },
      { field: 'cloudUri', type: 'url', required: false },
      { field: 'thumbnailUri', type: 'string', required: false, maxLength: 500 },
    ];

    const validated = this.validateObject(photo, rules);

    // Validate coordinate ranges
    if (validated.latitude < -90 || validated.latitude > 90) {
      throw new ValidationError('Latitude must be between -90 and 90', 'latitude');
    }

    if (validated.longitude < -180 || validated.longitude > 180) {
      throw new ValidationError('Longitude must be between -180 and 180', 'longitude');
    }

    // Sanitize caption if present
    if (validated.caption) {
      validated.caption = this.sanitizeString(validated.caption, {
        stripHtml: true,
        trimWhitespace: true,
        maxLength: 500,
        allowedCharacters: DataValidationService.PATTERNS.SAFE_STRING,
      });
    }

    return validated as PhotoApiFormat;
  }

  /**
   * Validate and sanitize track point data
   */
  validateTrackPoint(trackPoint: Partial<TrackPointApiFormat>): TrackPointApiFormat {
    const rules: ValidationRule[] = [
      { field: 'timestamp', type: 'timestamp', required: true },
      { field: 'latitude', type: 'coordinate', required: true },
      { field: 'longitude', type: 'coordinate', required: true },
      { field: 'elevation', type: 'number', required: false, min: -500, max: 9000 }, // Dead Sea to Everest
      { field: 'accuracy', type: 'number', required: true, min: 0, max: 1000 },
      { field: 'speed', type: 'number', required: false, min: 0, max: 50 }, // Max 50 m/s (180 km/h)
      { field: 'heading', type: 'number', required: false, min: 0, max: 360 },
      { field: 'source', type: 'string', required: true, pattern: /^(gps|network|passive)$/ },
    ];

    const validated = this.validateObject(trackPoint, rules);

    // Validate coordinate ranges
    if (validated.latitude < -90 || validated.latitude > 90) {
      throw new ValidationError('Latitude must be between -90 and 90', 'latitude');
    }

    if (validated.longitude < -180 || validated.longitude > 180) {
      throw new ValidationError('Longitude must be between -180 and 180', 'longitude');
    }

    // Validate timestamp is not in the future
    if (validated.timestamp > Date.now() + 60000) { // Allow 1 minute clock skew
      throw new ValidationError('Timestamp cannot be in the future', 'timestamp');
    }

    return validated as TrackPointApiFormat;
  }

  /**
   * Validate user input for authentication
   */
  validateAuthInput(input: { email?: string; password?: string; [key: string]: any }): any {
    const validated: any = {};

    if (input.email !== undefined) {
      validated.email = this.validateEmail(input.email);
    }

    if (input.password !== undefined) {
      validated.password = this.validatePassword(input.password);
    }

    // Sanitize other string fields
    Object.keys(input).forEach(key => {
      if (key !== 'email' && key !== 'password' && typeof input[key] === 'string') {
        validated[key] = this.sanitizeString(input[key], {
          stripHtml: true,
          trimWhitespace: true,
          maxLength: 100,
          allowedCharacters: DataValidationService.PATTERNS.SAFE_STRING,
        });
      }
    });

    return validated;
  }

  /**
   * Validate email address
   */
  validateEmail(email: string): string {
    if (!email || typeof email !== 'string') {
      throw new ValidationError('Email is required', 'email');
    }

    const sanitized = email.trim().toLowerCase();

    if (!DataValidationService.PATTERNS.EMAIL.test(sanitized)) {
      throw new ValidationError('Invalid email format', 'email');
    }

    if (sanitized.length > 254) {
      throw new ValidationError('Email is too long', 'email');
    }

    return sanitized;
  }

  /**
   * Validate password strength
   */
  validatePassword(password: string): string {
    if (!password || typeof password !== 'string') {
      throw new ValidationError('Password is required', 'password');
    }

    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long', 'password');
    }

    if (password.length > 128) {
      throw new ValidationError('Password is too long', 'password');
    }

    // Check for at least one uppercase, lowercase, number, and special character
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      throw new ValidationError(
        'Password must contain at least one uppercase letter, lowercase letter, number, and special character',
        'password'
      );
    }

    return password;
  }

  /**
   * Sanitize string input
   */
  sanitizeString(input: string, options: SanitizationOptions = {}): string {
    if (typeof input !== 'string') {
      return '';
    }

    let sanitized = input;

    // Trim whitespace
    if (options.trimWhitespace !== false) {
      sanitized = sanitized.trim();
    }

    // Strip HTML tags
    if (options.stripHtml) {
      sanitized = sanitized.replace(/<[^>]*>/g, '');
    }

    // Normalize Unicode
    if (options.normalizeUnicode) {
      sanitized = sanitized.normalize('NFC');
    }

    // Apply character whitelist
    if (options.allowedCharacters) {
      sanitized = sanitized.replace(new RegExp(`[^${options.allowedCharacters.source}]`, 'g'), '');
    }

    // Truncate to max length
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    return sanitized;
  }

  /**
   * Validate object against rules
   */
  private validateObject(obj: any, rules: ValidationRule[]): any {
    const validated: any = {};

    for (const rule of rules) {
      const value = obj[rule.field];

      // Check required fields
      if (rule.required && (value === undefined || value === null)) {
        throw new ValidationError(`${rule.field} is required`, rule.field);
      }

      // Skip validation for optional undefined fields
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      switch (rule.type) {
        case 'string':
          validated[rule.field] = this.validateStringField(value, rule);
          break;
        case 'number':
          validated[rule.field] = this.validateNumberField(value, rule);
          break;
        case 'boolean':
          validated[rule.field] = this.validateBooleanField(value, rule);
          break;
        case 'email':
          validated[rule.field] = this.validateEmail(value);
          break;
        case 'uuid':
          validated[rule.field] = this.validateUuidField(value, rule);
          break;
        case 'coordinate':
          validated[rule.field] = this.validateCoordinateField(value, rule);
          break;
        case 'timestamp':
          validated[rule.field] = this.validateTimestampField(value, rule);
          break;
        case 'url':
          validated[rule.field] = this.validateUrlField(value, rule);
          break;
        default:
          validated[rule.field] = value;
      }

      // Custom validation
      if (rule.customValidator && !rule.customValidator(validated[rule.field])) {
        throw new ValidationError(`${rule.field} failed custom validation`, rule.field);
      }
    }

    return validated;
  }

  private validateStringField(value: any, rule: ValidationRule): string {
    if (typeof value !== 'string') {
      throw new ValidationError(`${rule.field} must be a string`, rule.field);
    }

    if (rule.minLength && value.length < rule.minLength) {
      throw new ValidationError(`${rule.field} must be at least ${rule.minLength} characters`, rule.field);
    }

    if (rule.maxLength && value.length > rule.maxLength) {
      throw new ValidationError(`${rule.field} must be no more than ${rule.maxLength} characters`, rule.field);
    }

    if (rule.pattern && !rule.pattern.test(value)) {
      throw new ValidationError(`${rule.field} format is invalid`, rule.field);
    }

    return value;
  }

  private validateNumberField(value: any, rule: ValidationRule): number {
    const num = typeof value === 'string' ? parseFloat(value) : value;

    if (typeof num !== 'number' || isNaN(num)) {
      throw new ValidationError(`${rule.field} must be a number`, rule.field);
    }

    if (rule.min !== undefined && num < rule.min) {
      throw new ValidationError(`${rule.field} must be at least ${rule.min}`, rule.field);
    }

    if (rule.max !== undefined && num > rule.max) {
      throw new ValidationError(`${rule.field} must be no more than ${rule.max}`, rule.field);
    }

    return num;
  }

  private validateBooleanField(value: any, rule: ValidationRule): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    throw new ValidationError(`${rule.field} must be a boolean`, rule.field);
  }

  private validateUuidField(value: any, rule: ValidationRule): string {
    if (typeof value !== 'string') {
      throw new ValidationError(`${rule.field} must be a string`, rule.field);
    }

    if (!DataValidationService.PATTERNS.UUID.test(value)) {
      throw new ValidationError(`${rule.field} must be a valid UUID`, rule.field);
    }

    return value.toLowerCase();
  }

  private validateCoordinateField(value: any, rule: ValidationRule): number {
    const num = this.validateNumberField(value, rule);

    if (num < -180 || num > 180) {
      throw new ValidationError(`${rule.field} must be a valid coordinate`, rule.field);
    }

    return num;
  }

  private validateTimestampField(value: any, rule: ValidationRule): number {
    const num = this.validateNumberField(value, rule);

    // Validate reasonable timestamp range (year 1970 to 2100)
    if (num < 0 || num > 4102444800000) {
      throw new ValidationError(`${rule.field} must be a valid timestamp`, rule.field);
    }

    return num;
  }

  private validateUrlField(value: any, rule: ValidationRule): string {
    if (typeof value !== 'string') {
      throw new ValidationError(`${rule.field} must be a string`, rule.field);
    }

    if (!DataValidationService.PATTERNS.URL.test(value)) {
      throw new ValidationError(`${rule.field} must be a valid URL`, rule.field);
    }

    return value;
  }
}

// Singleton instance
export const dataValidationService = DataValidationService.getInstance();