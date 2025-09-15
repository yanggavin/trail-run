import { CameraConfigService } from '../CameraConfigService';

// Mock the dependencies
jest.mock('expo-camera', () => require('./__mocks__/expo-camera'));

// No need for mockCamera since we're not testing Camera methods directly

describe('CameraConfigService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getOptimalConfig', () => {
    it('should return default camera configuration', () => {
      const config = CameraConfigService.getOptimalConfig();

      expect(config).toEqual({
        type: 'back',
        flashMode: 'auto',
        quality: 0.8,
        ratio: '4:3',
        autoFocus: true,
        whiteBalance: 'auto'
      });
    });

    it('should return a new object each time (not reference)', () => {
      const config1 = CameraConfigService.getOptimalConfig();
      const config2 = CameraConfigService.getOptimalConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different object references
    });
  });

  describe('getTrailOptimizedSettings', () => {
    it('should return settings optimized for outdoor trail conditions', () => {
      const settings = CameraConfigService.getTrailOptimizedSettings();

      expect(settings).toEqual({
        quality: 0.8,
        ratio: '4:3',
        flashMode: 'auto',
        autoFocus: true
      });
    });
  });

  describe('getRapidCaptureSettings', () => {
    it('should return settings optimized for rapid capture', () => {
      const settings = CameraConfigService.getRapidCaptureSettings();

      expect(settings).toEqual({
        quality: 0.7,
        ratio: '4:3',
        flashMode: 'off',
        autoFocus: true
      });
    });

    it('should have lower quality than trail optimized settings', () => {
      const trailSettings = CameraConfigService.getTrailOptimizedSettings();
      const rapidSettings = CameraConfigService.getRapidCaptureSettings();

      expect(rapidSettings.quality).toBeLessThan(trailSettings.quality);
    });

    it('should have flash disabled for faster capture', () => {
      const rapidSettings = CameraConfigService.getRapidCaptureSettings();

      expect(rapidSettings.flashMode).toBe('off');
    });
  });

  describe('getDefaultDeviceCapabilities', () => {
    it('should return default device capabilities', () => {
      const capabilities = CameraConfigService.getDefaultDeviceCapabilities();

      expect(capabilities).toEqual({
        supportedRatios: ['4:3', '16:9'],
        hasFlash: true,
        supportsAutoFocus: true
      });
    });
  });

  describe('getRecommendedSettings', () => {
    it('should return default settings when device has all capabilities', () => {
      const capabilities = {
        hasFlash: true,
        supportsAutoFocus: true,
        supportedRatios: ['4:3', '16:9']
      };

      const settings = CameraConfigService.getRecommendedSettings(capabilities);

      expect(settings).toEqual({
        type: 'back',
        flashMode: 'auto',
        quality: 0.8,
        ratio: '4:3',
        autoFocus: true,
        whiteBalance: 'auto'
      });
    });

    it('should disable flash when device has no flash', () => {
      const capabilities = {
        hasFlash: false,
        supportsAutoFocus: true,
        supportedRatios: ['4:3', '16:9']
      };

      const settings = CameraConfigService.getRecommendedSettings(capabilities);

      expect(settings.flashMode).toBe('off');
    });

    it('should disable autofocus when device does not support it', () => {
      const capabilities = {
        hasFlash: true,
        supportsAutoFocus: false,
        supportedRatios: ['4:3', '16:9']
      };

      const settings = CameraConfigService.getRecommendedSettings(capabilities);

      expect(settings.autoFocus).toBe(false);
    });

    it('should use 16:9 ratio when 4:3 is not supported', () => {
      const capabilities = {
        hasFlash: true,
        supportsAutoFocus: true,
        supportedRatios: ['16:9', '1:1']
      };

      const settings = CameraConfigService.getRecommendedSettings(capabilities);

      expect(settings.ratio).toBe('16:9');
    });

    it('should use first available ratio when neither 4:3 nor 16:9 is supported', () => {
      const capabilities = {
        hasFlash: true,
        supportsAutoFocus: true,
        supportedRatios: ['1:1', '3:2']
      };

      const settings = CameraConfigService.getRecommendedSettings(capabilities);

      expect(settings.ratio).toBe('1:1');
    });

    it('should keep default ratio when no ratios are supported', () => {
      const capabilities = {
        hasFlash: true,
        supportsAutoFocus: true,
        supportedRatios: []
      };

      const settings = CameraConfigService.getRecommendedSettings(capabilities);

      expect(settings.ratio).toBe('4:3'); // Default ratio
    });
  });

  describe('getPhotoCaptureOptions', () => {
    it('should return optimal photo capture options', () => {
      const options = CameraConfigService.getPhotoCaptureOptions();

      expect(options).toEqual({
        quality: 0.8,
        base64: false,
        exif: true,
        skipProcessing: false
      });
    });
  });

  describe('getRapidCaptureOptions', () => {
    it('should return rapid capture options', () => {
      const options = CameraConfigService.getRapidCaptureOptions();

      expect(options).toEqual({
        quality: 0.7,
        base64: false,
        exif: true,
        skipProcessing: true
      });
    });

    it('should have lower quality than regular capture options', () => {
      const regularOptions = CameraConfigService.getPhotoCaptureOptions();
      const rapidOptions = CameraConfigService.getRapidCaptureOptions();

      expect(rapidOptions.quality).toBeLessThan(regularOptions.quality);
    });

    it('should skip processing for faster capture', () => {
      const rapidOptions = CameraConfigService.getRapidCaptureOptions();

      expect(rapidOptions.skipProcessing).toBe(true);
    });
  });
});