import { DataValidationService, ValidationError } from '../DataValidationService';

describe('DataValidationService', () => {
  let service: DataValidationService;

  beforeEach(() => {
    service = DataValidationService.getInstance();
  });

  describe('validateActivity', () => {
    const validActivity = {
      activityId: '123e4567-e89b-12d3-a456-426614174000',
      userId: '123e4567-e89b-12d3-a456-426614174001',
      startedAt: Date.now(),
      endedAt: Date.now() + 3600000,
      status: 'completed' as const,
      durationSec: 3600,
      distanceM: 5000,
      avgPaceSecPerKm: 300,
      elevGainM: 100,
      elevLossM: 50,
    };

    it('should validate valid activity data', () => {
      const result = service.validateActivity(validActivity);
      expect(result).toEqual(validActivity);
    });

    it('should throw error for missing required fields', () => {
      const invalidActivity = { ...validActivity };
      delete invalidActivity.activityId;

      expect(() => service.validateActivity(invalidActivity)).toThrow(ValidationError);
      expect(() => service.validateActivity(invalidActivity)).toThrow('activityId is required');
    });

    it('should throw error for invalid UUID format', () => {
      const invalidActivity = { ...validActivity, activityId: 'invalid-uuid' };

      expect(() => service.validateActivity(invalidActivity)).toThrow(ValidationError);
      expect(() => service.validateActivity(invalidActivity)).toThrow('must be a valid UUID');
    });

    it('should throw error for invalid status', () => {
      const invalidActivity = { ...validActivity, status: 'invalid' as any };

      expect(() => service.validateActivity(invalidActivity)).toThrow(ValidationError);
      expect(() => service.validateActivity(invalidActivity)).toThrow('format is invalid');
    });

    it('should throw error for invalid duration range', () => {
      const invalidActivity = { ...validActivity, durationSec: -1 };

      expect(() => service.validateActivity(invalidActivity)).toThrow(ValidationError);
      expect(() => service.validateActivity(invalidActivity)).toThrow('must be at least 0');
    });

    it('should throw error when end time is before start time', () => {
      const invalidActivity = { ...validActivity, endedAt: validActivity.startedAt - 1000 };

      expect(() => service.validateActivity(invalidActivity)).toThrow(ValidationError);
      expect(() => service.validateActivity(invalidActivity)).toThrow('End time must be after start time');
    });

    it('should throw error for completed activity without end time', () => {
      const invalidActivity = { ...validActivity, status: 'completed' as const };
      delete invalidActivity.endedAt;

      expect(() => service.validateActivity(invalidActivity)).toThrow(ValidationError);
      expect(() => service.validateActivity(invalidActivity)).toThrow('Completed activities must have an end time');
    });

    it('should sanitize polyline string', () => {
      const activityWithPolyline = { ...validActivity, polyline: '  encoded_polyline_data  ' };
      const result = service.validateActivity(activityWithPolyline);
      expect(result.polyline).toBe('encoded_polyline_data');
    });
  });

  describe('validatePhoto', () => {
    const validPhoto = {
      photoId: '123e4567-e89b-12d3-a456-426614174000',
      activityId: '123e4567-e89b-12d3-a456-426614174001',
      timestamp: Date.now(),
      latitude: 37.7749,
      longitude: -122.4194,
      localUri: '/path/to/photo.jpg',
      cloudUri: 'https://example.com/photo.jpg',
      thumbnailUri: '/path/to/thumbnail.jpg',
    };

    it('should validate valid photo data', () => {
      const result = service.validatePhoto(validPhoto);
      expect(result).toEqual(validPhoto);
    });

    it('should throw error for invalid latitude range', () => {
      const invalidPhoto = { ...validPhoto, latitude: 91 };

      expect(() => service.validatePhoto(invalidPhoto)).toThrow(ValidationError);
      expect(() => service.validatePhoto(invalidPhoto)).toThrow('Latitude must be between -90 and 90');
    });

    it('should throw error for invalid longitude range', () => {
      const invalidPhoto = { ...validPhoto, longitude: 181 };

      expect(() => service.validatePhoto(invalidPhoto)).toThrow(ValidationError);
      expect(() => service.validatePhoto(invalidPhoto)).toThrow('Longitude must be between -180 and 180');
    });

    it('should sanitize caption', () => {
      const photoWithCaption = { ...validPhoto, caption: '  <script>alert("xss")</script>Beautiful view!  ' };
      const result = service.validatePhoto(photoWithCaption);
      expect(result.caption).toBe('Beautiful view!');
    });

    it('should throw error for invalid cloud URI format', () => {
      const invalidPhoto = { ...validPhoto, cloudUri: 'not-a-valid-url' };

      expect(() => service.validatePhoto(invalidPhoto)).toThrow(ValidationError);
      expect(() => service.validatePhoto(invalidPhoto)).toThrow('must be a valid URL');
    });
  });

  describe('validateTrackPoint', () => {
    const validTrackPoint = {
      timestamp: Date.now(),
      latitude: 37.7749,
      longitude: -122.4194,
      elevation: 100,
      accuracy: 5,
      speed: 2.5,
      heading: 180,
      source: 'gps' as const,
    };

    it('should validate valid track point data', () => {
      const result = service.validateTrackPoint(validTrackPoint);
      expect(result).toEqual(validTrackPoint);
    });

    it('should throw error for future timestamp', () => {
      const invalidTrackPoint = { ...validTrackPoint, timestamp: Date.now() + 120000 }; // 2 minutes in future

      expect(() => service.validateTrackPoint(invalidTrackPoint)).toThrow(ValidationError);
      expect(() => service.validateTrackPoint(invalidTrackPoint)).toThrow('Timestamp cannot be in the future');
    });

    it('should throw error for invalid elevation range', () => {
      const invalidTrackPoint = { ...validTrackPoint, elevation: 10000 };

      expect(() => service.validateTrackPoint(invalidTrackPoint)).toThrow(ValidationError);
      expect(() => service.validateTrackPoint(invalidTrackPoint)).toThrow('must be no more than 9000');
    });

    it('should throw error for invalid speed', () => {
      const invalidTrackPoint = { ...validTrackPoint, speed: 100 }; // 100 m/s is too fast

      expect(() => service.validateTrackPoint(invalidTrackPoint)).toThrow(ValidationError);
      expect(() => service.validateTrackPoint(invalidTrackPoint)).toThrow('must be no more than 50');
    });

    it('should throw error for invalid source', () => {
      const invalidTrackPoint = { ...validTrackPoint, source: 'invalid' as any };

      expect(() => service.validateTrackPoint(invalidTrackPoint)).toThrow(ValidationError);
      expect(() => service.validateTrackPoint(invalidTrackPoint)).toThrow('format is invalid');
    });
  });

  describe('validateAuthInput', () => {
    it('should validate and sanitize auth input', () => {
      const input = {
        email: '  TEST@EXAMPLE.COM  ',
        password: 'ValidPassword123!',
        givenName: '  <script>John</script>  ',
        familyName: 'Doe',
      };

      const result = service.validateAuthInput(input);

      expect(result.email).toBe('test@example.com');
      expect(result.password).toBe('ValidPassword123!');
      expect(result.givenName).toBe('John');
      expect(result.familyName).toBe('Doe');
    });
  });

  describe('validateEmail', () => {
    it('should validate valid email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
      ];

      validEmails.forEach(email => {
        expect(service.validateEmail(email)).toBe(email.toLowerCase());
      });
    });

    it('should throw error for invalid email formats', () => {
      const invalidEmails = [
        '',
        'invalid-email',
        '@example.com',
        'test@',
        'test..test@example.com',
      ];

      invalidEmails.forEach(email => {
        expect(() => service.validateEmail(email)).toThrow(ValidationError);
      });
    });

    it('should throw error for email that is too long', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';

      expect(() => service.validateEmail(longEmail)).toThrow(ValidationError);
      expect(() => service.validateEmail(longEmail)).toThrow('Email is too long');
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      const validPasswords = [
        'ValidPassword123!',
        'AnotherGood1@',
        'Complex#Pass9',
      ];

      validPasswords.forEach(password => {
        expect(service.validatePassword(password)).toBe(password);
      });
    });

    it('should throw error for weak passwords', () => {
      const weakPasswords = [
        'short',
        'nouppercase123!',
        'NOLOWERCASE123!',
        'NoNumbers!',
        'NoSpecialChars123',
      ];

      weakPasswords.forEach(password => {
        expect(() => service.validatePassword(password)).toThrow(ValidationError);
      });
    });

    it('should throw error for password that is too long', () => {
      const longPassword = 'A'.repeat(130) + '1!';

      expect(() => service.validatePassword(longPassword)).toThrow(ValidationError);
      expect(() => service.validatePassword(longPassword)).toThrow('Password is too long');
    });
  });

  describe('sanitizeString', () => {
    it('should trim whitespace by default', () => {
      const result = service.sanitizeString('  test  ');
      expect(result).toBe('test');
    });

    it('should strip HTML tags when requested', () => {
      const result = service.sanitizeString('<script>alert("xss")</script>Hello', { stripHtml: true });
      expect(result).toBe('Hello');
    });

    it('should apply character whitelist', () => {
      const result = service.sanitizeString('Hello123!@#', { allowedCharacters: /[a-zA-Z0-9]/ });
      expect(result).toBe('Hello123');
    });

    it('should truncate to max length', () => {
      const result = service.sanitizeString('Hello World', { maxLength: 5 });
      expect(result).toBe('Hello');
    });

    it('should handle empty or invalid input', () => {
      expect(service.sanitizeString(null as any)).toBe('');
      expect(service.sanitizeString(undefined as any)).toBe('');
      expect(service.sanitizeString(123 as any)).toBe('');
    });
  });
});