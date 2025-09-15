import { manipulateAsync, SaveFormat, FlipType } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
// Note: expo-sharing would be imported in a real implementation
// import * as Sharing from 'expo-sharing';
import { Activity, Photo, TrackPoint } from '../../types';
import { ActivityStatistics } from './ActivityStatisticsService';

export interface ShareableImageOptions {
  includeMap: boolean;
  includeStats: boolean;
  includePhotos: boolean;
  stripExif: boolean;
  quality: number; // 0-1
  format: 'jpeg' | 'png';
  watermark?: string;
}

export interface PhotoCollageOptions {
  maxPhotos: number;
  layout: 'grid' | 'timeline' | 'highlight';
  includeMap: boolean;
  stripExif: boolean;
  quality: number;
}

export interface ShareableImageResult {
  uri: string;
  width: number;
  height: number;
  fileSize: number;
  processingTime: number;
}

export interface PhotoCollageResult extends ShareableImageResult {
  photosIncluded: number;
  layout: string;
}

export interface ExportOptions {
  includeOriginalPhotos: boolean;
  includeProcessedImages: boolean;
  includeGpxData: boolean;
  stripExifFromPhotos: boolean;
  compressionLevel: number; // 0-1
}

export interface ExportResult {
  exportUri: string;
  totalFiles: number;
  totalSize: number;
  processingTime: number;
}

/**
 * Service for generating shareable content from activities
 * Creates shareable images with maps and statistics, photo collages, and export packages
 */
export class ShareableContentService {
  private readonly defaultImageOptions: ShareableImageOptions = {
    includeMap: true,
    includeStats: true,
    includePhotos: true,
    stripExif: true,
    quality: 0.8,
    format: 'jpeg',
  };

  private readonly defaultCollageOptions: PhotoCollageOptions = {
    maxPhotos: 9,
    layout: 'grid',
    includeMap: false,
    stripExif: true,
    quality: 0.8,
  };

  private readonly defaultExportOptions: ExportOptions = {
    includeOriginalPhotos: true,
    includeProcessedImages: false,
    includeGpxData: true,
    stripExifFromPhotos: true,
    compressionLevel: 0.8,
  };

  /**
   * Create a shareable image with activity summary
   */
  public async createShareableImage(
    activity: Activity,
    statistics: ActivityStatistics,
    photos: Photo[],
    trackPoints: TrackPoint[],
    options: Partial<ShareableImageOptions> = {}
  ): Promise<ShareableImageResult> {
    const startTime = Date.now();
    const opts = { ...this.defaultImageOptions, ...options };

    try {
      // Create base canvas
      const canvas = await this.createBaseCanvas();
      
      // Add map if requested
      if (opts.includeMap && trackPoints.length > 0) {
        await this.addMapToCanvas(canvas, trackPoints, activity);
      }

      // Add statistics if requested
      if (opts.includeStats) {
        await this.addStatsToCanvas(canvas, statistics, activity);
      }

      // Add photos if requested
      if (opts.includePhotos && photos.length > 0) {
        await this.addPhotosToCanvas(canvas, photos.slice(0, 3), opts.stripExif);
      }

      // Add watermark if provided
      if (opts.watermark) {
        await this.addWatermarkToCanvas(canvas, opts.watermark);
      }

      // Render final image
      const result = await this.renderCanvas(canvas, opts);
      
      const processingTime = Date.now() - startTime;
      const fileStats = await FileSystem.getInfoAsync(result.uri);

      return {
        uri: result.uri,
        width: result.width,
        height: result.height,
        fileSize: fileStats.exists ? fileStats.size || 0 : 0,
        processingTime,
      };
    } catch (error) {
      console.error('Error creating shareable image:', error);
      throw error;
    }
  }

  /**
   * Create a photo collage from activity photos
   */
  public async createPhotoCollage(
    photos: Photo[],
    activity: Activity,
    trackPoints: TrackPoint[],
    options: Partial<PhotoCollageOptions> = {}
  ): Promise<PhotoCollageResult> {
    const startTime = Date.now();
    const opts = { ...this.defaultCollageOptions, ...options };

    if (photos.length === 0) {
      throw new Error('No photos available for collage');
    }

    try {
      // Select photos for collage
      const selectedPhotos = await this.selectPhotosForCollage(photos, opts);

      // Create collage based on layout
      let collageResult: ShareableImageResult;
      
      switch (opts.layout) {
        case 'grid':
          collageResult = await this.createGridCollage(selectedPhotos, opts);
          break;
        case 'timeline':
          collageResult = await this.createTimelineCollage(selectedPhotos, activity, opts);
          break;
        case 'highlight':
          collageResult = await this.createHighlightCollage(selectedPhotos, trackPoints, opts);
          break;
        default:
          throw new Error(`Unsupported collage layout: ${opts.layout}`);
      }

      // Add map overlay if requested
      if (opts.includeMap && trackPoints.length > 0) {
        collageResult = await this.addMapOverlayToCollage(collageResult, trackPoints);
      }

      const processingTime = Date.now() - startTime;

      return {
        ...collageResult,
        photosIncluded: selectedPhotos.length,
        layout: opts.layout,
        processingTime,
      };
    } catch (error) {
      console.error('Error creating photo collage:', error);
      throw error;
    }
  }

  /**
   * Export activity data and media as a package
   */
  public async exportActivityPackage(
    activity: Activity,
    statistics: ActivityStatistics,
    photos: Photo[],
    trackPoints: TrackPoint[],
    options: Partial<ExportOptions> = {}
  ): Promise<ExportResult> {
    const startTime = Date.now();
    const opts = { ...this.defaultExportOptions, ...options };

    try {
      // Create temporary directory for export
      const exportDir = new Directory(Paths.document, 'exports', activity.activityId);
      await exportDir.create();

      let totalFiles = 0;
      let totalSize = 0;

      // Export activity metadata
      const metadataFile = await this.exportActivityMetadata(activity, statistics, exportDir);
      totalFiles++;
      totalSize += metadataFile.size;

      // Export GPX data if requested
      if (opts.includeGpxData && trackPoints.length > 0) {
        const gpxFile = await this.exportGpxData(activity, trackPoints, exportDir);
        totalFiles++;
        totalSize += gpxFile.size;
      }

      // Export photos if requested
      if (opts.includeOriginalPhotos && photos.length > 0) {
        const photoResults = await this.exportPhotos(photos, exportDir, opts);
        totalFiles += photoResults.count;
        totalSize += photoResults.size;
      }

      // Export processed images if requested
      if (opts.includeProcessedImages) {
        const processedResults = await this.exportProcessedImages(
          activity, statistics, photos, trackPoints, exportDir, opts
        );
        totalFiles += processedResults.count;
        totalSize += processedResults.size;
      }

      // Create ZIP archive
      const zipUri = await this.createZipArchive(exportDir, activity.activityId);
      
      // Clean up temporary directory
      await exportDir.delete();

      const processingTime = Date.now() - startTime;

      return {
        exportUri: zipUri,
        totalFiles,
        totalSize,
        processingTime,
      };
    } catch (error) {
      console.error('Error exporting activity package:', error);
      throw error;
    }
  }

  /**
   * Share content using native share sheet
   * Note: In a real implementation, this would use expo-sharing
   */
  public async shareContent(
    uri: string,
    title: string = 'Trail Run Activity',
    message?: string
  ): Promise<void> {
    try {
      // In a real implementation, this would use expo-sharing:
      // const isAvailable = await Sharing.isAvailableAsync();
      // if (!isAvailable) {
      //   throw new Error('Sharing is not available on this device');
      // }
      // 
      // await Sharing.shareAsync(uri, {
      //   mimeType: this.getMimeType(uri),
      //   dialogTitle: title,
      //   UTI: this.getUTI(uri),
      // });

      // For now, just log the sharing attempt
      console.log(`Sharing content: ${uri} with title: ${title}`);
      
      // Simulate sharing success
      return Promise.resolve();
    } catch (error) {
      console.error('Error sharing content:', error);
      throw error;
    }
  }

  /**
   * Strip EXIF data from photo
   */
  public async stripExifData(photoUri: string): Promise<string> {
    try {
      const result = await manipulateAsync(
        photoUri,
        [], // No manipulations, just re-save without EXIF
        {
          compress: 1.0, // No compression to maintain quality
          format: SaveFormat.JPEG,
        }
      );

      return result.uri;
    } catch (error) {
      console.error('Error stripping EXIF data:', error);
      throw error;
    }
  }

  // MARK: - Private Methods

  private async createBaseCanvas(): Promise<any> {
    // In a real implementation, this would create a canvas or image manipulation context
    // For now, return a mock canvas object
    return {
      width: 1080,
      height: 1080,
      elements: [],
    };
  }

  private async addMapToCanvas(canvas: any, trackPoints: TrackPoint[], activity: Activity): Promise<void> {
    // In a real implementation, this would:
    // 1. Generate a static map image from the track points
    // 2. Add it to the canvas
    canvas.elements.push({
      type: 'map',
      trackPoints: trackPoints.length,
      bounds: activity.bounds,
    });
  }

  private async addStatsToCanvas(canvas: any, statistics: ActivityStatistics, activity: Activity): Promise<void> {
    // In a real implementation, this would add text overlays with statistics
    canvas.elements.push({
      type: 'stats',
      distance: statistics.distanceM,
      duration: statistics.durationSec,
      pace: statistics.avgPaceSecPerKm,
      elevation: statistics.elevGainM,
    });
  }

  private async addPhotosToCanvas(canvas: any, photos: Photo[], stripExif: boolean): Promise<void> {
    // In a real implementation, this would add photo thumbnails to the canvas
    const processedPhotos = [];
    
    for (const photo of photos) {
      let photoUri = photo.localUri;
      
      if (stripExif) {
        photoUri = await this.stripExifData(photoUri);
      }
      
      processedPhotos.push({
        uri: photoUri,
        latitude: photo.latitude,
        longitude: photo.longitude,
      });
    }

    canvas.elements.push({
      type: 'photos',
      photos: processedPhotos,
    });
  }

  private async addWatermarkToCanvas(canvas: any, watermark: string): Promise<void> {
    canvas.elements.push({
      type: 'watermark',
      text: watermark,
    });
  }

  private async renderCanvas(canvas: any, options: ShareableImageOptions): Promise<ShareableImageResult> {
    // In a real implementation, this would render the canvas to an image file
    // For now, create a mock result
    const mockImageFile = new File(Paths.document, `shareable_${Date.now()}.${options.format}`);
    
    // Create a simple mock image file
    await mockImageFile.write('mock_image_data');

    return {
      uri: mockImageFile.uri,
      width: canvas.width,
      height: canvas.height,
      fileSize: 1024, // Mock size
      processingTime: 0,
    };
  }

  private async selectPhotosForCollage(photos: Photo[], options: PhotoCollageOptions): Promise<Photo[]> {
    // Sort photos by timestamp and select up to maxPhotos
    const sortedPhotos = [...photos].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return sortedPhotos.slice(0, options.maxPhotos);
  }

  private async createGridCollage(photos: Photo[], options: PhotoCollageOptions): Promise<ShareableImageResult> {
    // In a real implementation, this would create a grid layout of photos
    const mockFile = new File(Paths.document, `collage_grid_${Date.now()}.jpg`);
    
    await mockFile.write('mock_collage_data');

    return {
      uri: mockFile.uri,
      width: 1080,
      height: 1080,
      fileSize: 2048,
      processingTime: 0,
    };
  }

  private async createTimelineCollage(
    photos: Photo[], 
    activity: Activity, 
    options: PhotoCollageOptions
  ): Promise<ShareableImageResult> {
    // In a real implementation, this would create a timeline layout
    const mockFile = new File(Paths.document, `collage_timeline_${Date.now()}.jpg`);
    
    await mockFile.write('mock_timeline_data');

    return {
      uri: mockFile.uri,
      width: 1080,
      height: 1350,
      fileSize: 2560,
      processingTime: 0,
    };
  }

  private async createHighlightCollage(
    photos: Photo[], 
    trackPoints: TrackPoint[], 
    options: PhotoCollageOptions
  ): Promise<ShareableImageResult> {
    // In a real implementation, this would create a highlight reel layout
    const mockFile = new File(Paths.document, `collage_highlight_${Date.now()}.jpg`);
    
    await mockFile.write('mock_highlight_data');

    return {
      uri: mockFile.uri,
      width: 1080,
      height: 1920,
      fileSize: 3072,
      processingTime: 0,
    };
  }

  private async addMapOverlayToCollage(
    collageResult: ShareableImageResult, 
    trackPoints: TrackPoint[]
  ): Promise<ShareableImageResult> {
    // In a real implementation, this would add a map overlay to the collage
    return collageResult;
  }

  private async exportActivityMetadata(
    activity: Activity, 
    statistics: ActivityStatistics, 
    exportDir: Directory
  ): Promise<{ size: number }> {
    const metadata = {
      activity,
      statistics,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };

    const metadataFile = new File(exportDir, 'activity.json');
    await metadataFile.write(JSON.stringify(metadata, null, 2));
    
    const fileInfo = metadataFile.info();
    return { size: fileInfo.size || 0 };
  }

  private async exportGpxData(
    activity: Activity, 
    trackPoints: TrackPoint[], 
    exportDir: Directory
  ): Promise<{ size: number }> {
    const gpxContent = this.generateGpxContent(activity, trackPoints);
    const gpxFile = new File(exportDir, 'activity.gpx');
    
    await gpxFile.write(gpxContent);
    
    const fileInfo = gpxFile.info();
    return { size: fileInfo.size || 0 };
  }

  private async exportPhotos(
    photos: Photo[], 
    exportDir: Directory, 
    options: ExportOptions
  ): Promise<{ count: number; size: number }> {
    let totalSize = 0;
    const photosDir = new Directory(exportDir, 'photos');
    await photosDir.create();

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      let sourceUri = photo.localUri;

      // Strip EXIF if requested
      if (options.stripExifFromPhotos) {
        sourceUri = await this.stripExifData(sourceUri);
      }

      // Copy photo to export directory
      const photoFile = new File(photosDir, `photo_${i + 1}.jpg`);
      const sourceFile = new File(sourceUri);
      await sourceFile.copy(photoFile);

      const fileInfo = photoFile.info();
      totalSize += fileInfo.size || 0;
    }

    return { count: photos.length, size: totalSize };
  }

  private async exportProcessedImages(
    activity: Activity,
    statistics: ActivityStatistics,
    photos: Photo[],
    trackPoints: TrackPoint[],
    exportDir: Directory,
    options: ExportOptions
  ): Promise<{ count: number; size: number }> {
    let count = 0;
    let totalSize = 0;
    const processedDir = new Directory(exportDir, 'processed');
    await processedDir.create();

    // Create shareable image
    try {
      const shareableResult = await this.createShareableImage(
        activity, statistics, photos, trackPoints,
        { stripExif: options.stripExifFromPhotos, quality: options.compressionLevel }
      );
      
      const shareableFile = new File(processedDir, 'shareable_summary.jpg');
      const sourceFile = new File(shareableResult.uri);
      await sourceFile.copy(shareableFile);
      
      count++;
      totalSize += shareableResult.fileSize;
    } catch (error) {
      console.warn('Failed to create shareable image for export:', error);
    }

    // Create photo collage if photos available
    if (photos.length > 0) {
      try {
        const collageResult = await this.createPhotoCollage(
          photos, activity, trackPoints,
          { stripExif: options.stripExifFromPhotos, quality: options.compressionLevel }
        );
        
        const collageFile = new File(processedDir, 'photo_collage.jpg');
        const sourceFile = new File(collageResult.uri);
        await sourceFile.copy(collageFile);
        
        count++;
        totalSize += collageResult.fileSize;
      } catch (error) {
        console.warn('Failed to create photo collage for export:', error);
      }
    }

    return { count, size: totalSize };
  }

  private async createZipArchive(sourceDir: Directory, activityId: string): Promise<string> {
    // In a real implementation, this would create a ZIP archive
    // For now, just return the directory path as a mock
    const zipFile = new File(Paths.document, `${activityId}_export.zip`);
    
    // Create a mock zip file
    await zipFile.write('mock_zip_data');
    
    return zipFile.uri;
  }

  private generateGpxContent(activity: Activity, trackPoints: TrackPoint[]): string {
    const gpxHeader = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailRun" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Trail Run Activity - ${activity.activityId}</name>
    <time>${activity.startedAt.toISOString()}</time>
  </metadata>
  <trk>
    <name>Trail Run Track</name>
    <trkseg>`;

    const trackPointsXml = trackPoints.map(point => {
      let trkpt = `      <trkpt lat="${point.latitude}" lon="${point.longitude}">`;
      
      if (point.altitude !== undefined) {
        trkpt += `\n        <ele>${point.altitude}</ele>`;
      }
      
      trkpt += `\n        <time>${point.timestamp.toISOString()}</time>`;
      
      if (point.speed !== undefined) {
        trkpt += `\n        <extensions><speed>${point.speed}</speed></extensions>`;
      }
      
      trkpt += '\n      </trkpt>';
      return trkpt;
    }).join('\n');

    const gpxFooter = `
    </trkseg>
  </trk>
</gpx>`;

    return gpxHeader + '\n' + trackPointsXml + gpxFooter;
  }

  private getMimeType(uri: string): string {
    const extension = uri.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'zip':
        return 'application/zip';
      case 'gpx':
        return 'application/gpx+xml';
      default:
        return 'application/octet-stream';
    }
  }

  private getUTI(uri: string): string {
    const extension = uri.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'public.jpeg';
      case 'png':
        return 'public.png';
      case 'zip':
        return 'public.zip-archive';
      case 'gpx':
        return 'public.xml';
      default:
        return 'public.data';
    }
  }
}

// Export singleton instance
export const shareableContentService = new ShareableContentService();