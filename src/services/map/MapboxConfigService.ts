import Mapbox from '@rnmapbox/maps';

export class MapboxConfigService {
  private static instance: MapboxConfigService;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): MapboxConfigService {
    if (!MapboxConfigService.instance) {
      MapboxConfigService.instance = new MapboxConfigService();
    }
    return MapboxConfigService.instance;
  }

  /**
   * Initialize Mapbox with access token and configuration
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Set access token - in production this should come from environment variables
      const accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || 'pk.your_mapbox_token_here';
      
      if (accessToken === 'pk.your_mapbox_token_here') {
        console.warn('Mapbox access token not configured. Using demo mode.');
      }

      Mapbox.setAccessToken(accessToken);

      // Configure telemetry (disable for privacy)
      Mapbox.setTelemetryEnabled(false);

      // Set connected state for offline maps
      Mapbox.setConnected(true);

      this.isInitialized = true;
      console.log('Mapbox initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Mapbox:', error);
      throw error;
    }
  }

  /**
   * Check if Mapbox is properly initialized
   */
  public isMapboxInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get default map style URL
   */
  public getDefaultStyleURL(): string {
    return Mapbox.StyleURL.Outdoors; // Good for trail running
  }

  /**
   * Get satellite style URL for detailed terrain view
   */
  public getSatelliteStyleURL(): string {
    return Mapbox.StyleURL.Satellite;
  }

  /**
   * Configure offline map settings
   */
  public async configureOfflineSettings(): Promise<void> {
    try {
      // Set maximum cache size (100MB)
      await Mapbox.offlineManager.setMaximumAmbientCacheSize(100 * 1024 * 1024);
      
      // Enable ambient cache for offline usage
      Mapbox.offlineManager.resetDatabase();
      
      console.log('Offline map settings configured');
    } catch (error) {
      console.error('Failed to configure offline settings:', error);
    }
  }

  /**
   * Handle map permission requests
   */
  public async requestMapPermissions(): Promise<boolean> {
    try {
      // Mapbox doesn't require additional permissions beyond location
      // Location permissions are handled by the LocationService
      return true;
    } catch (error) {
      console.error('Failed to request map permissions:', error);
      return false;
    }
  }
}

export default MapboxConfigService;