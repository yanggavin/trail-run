import { MapboxConfigService } from '../MapboxConfigService';

// Mock Mapbox
jest.mock('@rnmapbox/maps', () => ({
  setAccessToken: jest.fn(),
  setTelemetryEnabled: jest.fn(),
  setConnected: jest.fn(),
  StyleURL: {
    Outdoors: 'mapbox://styles/mapbox/outdoors-v12',
    Satellite: 'mapbox://styles/mapbox/satellite-v9',
  },
  offlineManager: {
    setMaximumAmbientCacheSize: jest.fn().mockResolvedValue(undefined),
    resetDatabase: jest.fn(),
  },
}));

describe('MapboxConfigService', () => {
  let mapboxConfig: MapboxConfigService;

  beforeEach(() => {
    mapboxConfig = MapboxConfigService.getInstance();
    // Reset initialization state
    (mapboxConfig as any).isInitialized = false;
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = MapboxConfigService.getInstance();
      const instance2 = MapboxConfigService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should initialize Mapbox with access token', async () => {
      const Mapbox = require('@rnmapbox/maps');
      
      await mapboxConfig.initialize();

      expect(Mapbox.setAccessToken).toHaveBeenCalledWith(expect.any(String));
      expect(Mapbox.setTelemetryEnabled).toHaveBeenCalledWith(false);
      expect(Mapbox.setConnected).toHaveBeenCalledWith(true);
      expect(mapboxConfig.isMapboxInitialized()).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      const Mapbox = require('@rnmapbox/maps');
      
      await mapboxConfig.initialize();
      await mapboxConfig.initialize();

      expect(Mapbox.setAccessToken).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', async () => {
      const Mapbox = require('@rnmapbox/maps');
      Mapbox.setAccessToken.mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      await expect(mapboxConfig.initialize()).rejects.toThrow('Invalid token');
    });
  });

  describe('getDefaultStyleURL', () => {
    it('should return outdoors style URL', () => {
      const styleURL = mapboxConfig.getDefaultStyleURL();
      expect(styleURL).toBe('mapbox://styles/mapbox/outdoors-v12');
    });
  });

  describe('getSatelliteStyleURL', () => {
    it('should return satellite style URL', () => {
      const styleURL = mapboxConfig.getSatelliteStyleURL();
      expect(styleURL).toBe('mapbox://styles/mapbox/satellite-v9');
    });
  });

  describe('configureOfflineSettings', () => {
    it('should configure offline map settings', async () => {
      const Mapbox = require('@rnmapbox/maps');
      
      await mapboxConfig.configureOfflineSettings();

      expect(Mapbox.offlineManager.setMaximumAmbientCacheSize).toHaveBeenCalledWith(100 * 1024 * 1024);
      expect(Mapbox.offlineManager.resetDatabase).toHaveBeenCalled();
    });

    it('should handle offline configuration errors', async () => {
      const Mapbox = require('@rnmapbox/maps');
      Mapbox.offlineManager.setMaximumAmbientCacheSize.mockRejectedValueOnce(new Error('Offline error'));

      // Should not throw, just log error
      await expect(mapboxConfig.configureOfflineSettings()).resolves.toBeUndefined();
    });
  });

  describe('requestMapPermissions', () => {
    it('should return true for map permissions', async () => {
      const hasPermissions = await mapboxConfig.requestMapPermissions();
      expect(hasPermissions).toBe(true);
    });
  });
});