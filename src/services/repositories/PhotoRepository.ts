import { DatabaseService } from '../database/DatabaseService';
import { 
  Photo, 
  PhotoApiFormat, 
  photoToApiFormat, 
  photoFromApiFormat,
  validatePhoto 
} from '../../types';

export interface PhotoFilters {
  activityId?: string;
  syncStatus?: Photo['syncStatus'];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class PhotoRepository {
  constructor(private db: DatabaseService) {}

  async create(photo: Photo): Promise<Photo> {
    validatePhoto(photo);
    
    const apiFormat = photoToApiFormat(photo);
    
    await this.db.executeSql(`
      INSERT INTO photos (
        photo_id, activity_id, timestamp, latitude, longitude,
        local_uri, cloud_uri, thumbnail_uri, exif_data, caption, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      apiFormat.photo_id,
      apiFormat.activity_id,
      new Date(apiFormat.timestamp).getTime(),
      apiFormat.latitude,
      apiFormat.longitude,
      apiFormat.local_uri,
      apiFormat.cloud_uri,
      apiFormat.thumbnail_uri,
      apiFormat.exif_data,
      apiFormat.caption,
      apiFormat.sync_status
    ]);

    return photo;
  }

  async findById(photoId: string): Promise<Photo | null> {
    const results = await this.db.executeQuery<PhotoApiFormat>(`
      SELECT * FROM photos WHERE photo_id = ?
    `, [photoId]);

    if (results.length === 0) {
      return null;
    }

    return this.convertFromDb(results[0]);
  }

  async findByActivityId(activityId: string, filters: Omit<PhotoFilters, 'activityId'> = {}): Promise<Photo[]> {
    let query = 'SELECT * FROM photos WHERE activity_id = ?';
    const params: any[] = [activityId];

    // Apply filters
    if (filters.syncStatus) {
      query += ' AND sync_status = ?';
      params.push(filters.syncStatus);
    }

    if (filters.startDate) {
      query += ' AND timestamp >= ?';
      params.push(filters.startDate.getTime());
    }

    if (filters.endDate) {
      query += ' AND timestamp <= ?';
      params.push(filters.endDate.getTime());
    }

    // Order by timestamp
    query += ' ORDER BY timestamp ASC';

    // Apply pagination
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const results = await this.db.executeQuery<PhotoApiFormat>(query, params);
    return results.map(row => this.convertFromDb(row));
  }

  async findAll(filters: PhotoFilters = {}): Promise<Photo[]> {
    let query = 'SELECT * FROM photos WHERE 1=1';
    const params: any[] = [];

    // Apply filters
    if (filters.activityId) {
      query += ' AND activity_id = ?';
      params.push(filters.activityId);
    }

    if (filters.syncStatus) {
      query += ' AND sync_status = ?';
      params.push(filters.syncStatus);
    }

    if (filters.startDate) {
      query += ' AND timestamp >= ?';
      params.push(filters.startDate.getTime());
    }

    if (filters.endDate) {
      query += ' AND timestamp <= ?';
      params.push(filters.endDate.getTime());
    }

    // Order by timestamp
    query += ' ORDER BY timestamp DESC';

    // Apply pagination
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const results = await this.db.executeQuery<PhotoApiFormat>(query, params);
    return results.map(row => this.convertFromDb(row));
  }

  async update(photoId: string, updates: Partial<Photo>): Promise<Photo | null> {
    const existing = await this.findById(photoId);
    if (!existing) {
      return null;
    }

    const updated = { ...existing, ...updates };
    validatePhoto(updated);

    const apiFormat = photoToApiFormat(updated);

    await this.db.executeSql(`
      UPDATE photos SET
        activity_id = ?, timestamp = ?, latitude = ?, longitude = ?,
        local_uri = ?, cloud_uri = ?, thumbnail_uri = ?, exif_data = ?,
        caption = ?, sync_status = ?
      WHERE photo_id = ?
    `, [
      apiFormat.activity_id,
      new Date(apiFormat.timestamp).getTime(),
      apiFormat.latitude,
      apiFormat.longitude,
      apiFormat.local_uri,
      apiFormat.cloud_uri,
      apiFormat.thumbnail_uri,
      apiFormat.exif_data,
      apiFormat.caption,
      apiFormat.sync_status,
      photoId
    ]);

    return updated;
  }

  async delete(photoId: string): Promise<boolean> {
    const result = await this.db.executeUpdate(`
      DELETE FROM photos WHERE photo_id = ?
    `, [photoId]);

    return result > 0;
  }

  async count(filters: PhotoFilters = {}): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM photos WHERE 1=1';
    const params: any[] = [];

    // Apply filters (same as findAll but without ordering/pagination)
    if (filters.activityId) {
      query += ' AND activity_id = ?';
      params.push(filters.activityId);
    }

    if (filters.syncStatus) {
      query += ' AND sync_status = ?';
      params.push(filters.syncStatus);
    }

    if (filters.startDate) {
      query += ' AND timestamp >= ?';
      params.push(filters.startDate.getTime());
    }

    if (filters.endDate) {
      query += ' AND timestamp <= ?';
      params.push(filters.endDate.getTime());
    }

    const results = await this.db.executeQuery<{ count: number }>(query, params);
    return results[0]?.count || 0;
  }

  async findUnsyncedPhotos(limit: number = 50): Promise<Photo[]> {
    const results = await this.db.executeQuery<PhotoApiFormat>(`
      SELECT * FROM photos 
      WHERE sync_status IN ('local', 'uploading')
      ORDER BY timestamp ASC
      LIMIT ?
    `, [limit]);

    return results.map(row => this.convertFromDb(row));
  }

  async markAsSynced(photoId: string, cloudUri: string, thumbnailUri?: string): Promise<boolean> {
    const result = await this.db.executeUpdate(`
      UPDATE photos SET 
        sync_status = 'synced', 
        cloud_uri = ?,
        thumbnail_uri = COALESCE(?, thumbnail_uri)
      WHERE photo_id = ?
    `, [cloudUri, thumbnailUri, photoId]);

    return result > 0;
  }

  async markAsUploading(photoId: string): Promise<boolean> {
    const result = await this.db.executeUpdate(`
      UPDATE photos SET sync_status = 'uploading'
      WHERE photo_id = ?
    `, [photoId]);

    return result > 0;
  }

  async markAsLocal(photoId: string): Promise<boolean> {
    const result = await this.db.executeUpdate(`
      UPDATE photos SET sync_status = 'local', cloud_uri = NULL, thumbnail_uri = NULL
      WHERE photo_id = ?
    `, [photoId]);

    return result > 0;
  }

  async findByLocation(latitude: number, longitude: number, radiusKm: number = 1): Promise<Photo[]> {
    // Simple bounding box calculation (not perfect for spherical coordinates but good enough for small distances)
    const latDelta = radiusKm / 111; // Roughly 111 km per degree of latitude
    const lngDelta = radiusKm / (111 * Math.cos(latitude * Math.PI / 180));

    const results = await this.db.executeQuery<PhotoApiFormat>(`
      SELECT * FROM photos 
      WHERE latitude BETWEEN ? AND ?
        AND longitude BETWEEN ? AND ?
      ORDER BY timestamp DESC
    `, [
      latitude - latDelta,
      latitude + latDelta,
      longitude - lngDelta,
      longitude + lngDelta
    ]);

    return results.map(row => this.convertFromDb(row));
  }

  async bulkCreate(photos: Photo[]): Promise<Photo[]> {
    return this.db.transaction(async () => {
      const created: Photo[] = [];
      for (const photo of photos) {
        const result = await this.create(photo);
        created.push(result);
      }
      return created;
    });
  }

  async bulkUpdate(updates: Array<{ photoId: string; data: Partial<Photo> }>): Promise<Photo[]> {
    return this.db.transaction(async () => {
      const updated: Photo[] = [];
      for (const { photoId, data } of updates) {
        const result = await this.update(photoId, data);
        if (result) {
          updated.push(result);
        }
      }
      return updated;
    });
  }

  async deleteByActivityId(activityId: string): Promise<number> {
    const result = await this.db.executeUpdate(`
      DELETE FROM photos WHERE activity_id = ?
    `, [activityId]);

    return result;
  }

  async findRecentPhotos(limit: number = 20): Promise<Photo[]> {
    const results = await this.db.executeQuery<PhotoApiFormat>(`
      SELECT * FROM photos 
      ORDER BY timestamp DESC
      LIMIT ?
    `, [limit]);

    return results.map(row => this.convertFromDb(row));
  }

  async findPhotosWithoutThumbnails(): Promise<Photo[]> {
    const results = await this.db.executeQuery<PhotoApiFormat>(`
      SELECT * FROM photos 
      WHERE thumbnail_uri IS NULL OR thumbnail_uri = ''
      ORDER BY timestamp DESC
    `);

    return results.map(row => this.convertFromDb(row));
  }

  async updateThumbnail(photoId: string, thumbnailUri: string): Promise<boolean> {
    const result = await this.db.executeUpdate(`
      UPDATE photos SET thumbnail_uri = ?
      WHERE photo_id = ?
    `, [thumbnailUri, photoId]);

    return result > 0;
  }

  async findCoverPhotoCandidates(activityId: string, limit: number = 5): Promise<Photo[]> {
    const results = await this.db.executeQuery<PhotoApiFormat>(`
      SELECT * FROM photos 
      WHERE activity_id = ? AND thumbnail_uri IS NOT NULL
      ORDER BY timestamp ASC
      LIMIT ?
    `, [activityId, limit]);

    return results.map(row => this.convertFromDb(row));
  }

  private convertFromDb(row: PhotoApiFormat): Photo {
    // Convert timestamp back to Date object
    const converted: PhotoApiFormat = {
      ...row,
      timestamp: new Date(row.timestamp).toISOString()
    };

    return photoFromApiFormat(converted);
  }
}