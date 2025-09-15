import { DatabaseService } from '../database/DatabaseService';
import { 
  TrackPoint, 
  TrackPointApiFormat, 
  trackPointToApiFormat, 
  trackPointFromApiFormat,
  validateTrackPoint,
  BoundingBox 
} from '../../types';

export interface TrackPointFilters {
  activityId?: string;
  source?: TrackPoint['source'];
  startTime?: Date;
  endTime?: Date;
  minAccuracy?: number;
  maxAccuracy?: number;
  limit?: number;
  offset?: number;
}

export interface TrackPointBatch {
  activityId: string;
  trackPoints: TrackPoint[];
}

export class TrackPointRepository {
  constructor(private db: DatabaseService) {}

  async create(trackPoint: TrackPoint, activityId: string): Promise<TrackPoint> {
    validateTrackPoint(trackPoint);
    
    const apiFormat = trackPointToApiFormat(trackPoint, activityId);
    
    const insertId = await this.db.executeInsert(`
      INSERT INTO track_points (
        activity_id, timestamp, latitude, longitude, elevation,
        accuracy, speed, heading, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      apiFormat.activity_id,
      new Date(apiFormat.timestamp).getTime(),
      apiFormat.latitude,
      apiFormat.longitude,
      apiFormat.elevation,
      apiFormat.accuracy,
      apiFormat.speed,
      apiFormat.heading,
      apiFormat.source
    ]);

    return trackPoint;
  }

  async findById(id: number): Promise<TrackPoint | null> {
    const results = await this.db.executeQuery<TrackPointApiFormat>(`
      SELECT * FROM track_points WHERE id = ?
    `, [id]);

    if (results.length === 0) {
      return null;
    }

    return this.convertFromDb(results[0]);
  }

  async findByActivityId(activityId: string, filters: Omit<TrackPointFilters, 'activityId'> = {}): Promise<TrackPoint[]> {
    let query = 'SELECT * FROM track_points WHERE activity_id = ?';
    const params: any[] = [activityId];

    // Apply filters
    if (filters.source) {
      query += ' AND source = ?';
      params.push(filters.source);
    }

    if (filters.startTime) {
      query += ' AND timestamp >= ?';
      params.push(filters.startTime.getTime());
    }

    if (filters.endTime) {
      query += ' AND timestamp <= ?';
      params.push(filters.endTime.getTime());
    }

    if (filters.minAccuracy !== undefined) {
      query += ' AND accuracy >= ?';
      params.push(filters.minAccuracy);
    }

    if (filters.maxAccuracy !== undefined) {
      query += ' AND accuracy <= ?';
      params.push(filters.maxAccuracy);
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

    const results = await this.db.executeQuery<TrackPointApiFormat>(query, params);
    return results.map(row => this.convertFromDb(row));
  }

  async findAll(filters: TrackPointFilters = {}): Promise<TrackPoint[]> {
    let query = 'SELECT * FROM track_points WHERE 1=1';
    const params: any[] = [];

    // Apply filters
    if (filters.activityId) {
      query += ' AND activity_id = ?';
      params.push(filters.activityId);
    }

    if (filters.source) {
      query += ' AND source = ?';
      params.push(filters.source);
    }

    if (filters.startTime) {
      query += ' AND timestamp >= ?';
      params.push(filters.startTime.getTime());
    }

    if (filters.endTime) {
      query += ' AND timestamp <= ?';
      params.push(filters.endTime.getTime());
    }

    if (filters.minAccuracy !== undefined) {
      query += ' AND accuracy >= ?';
      params.push(filters.minAccuracy);
    }

    if (filters.maxAccuracy !== undefined) {
      query += ' AND accuracy <= ?';
      params.push(filters.maxAccuracy);
    }

    // Order by activity and timestamp
    query += ' ORDER BY activity_id, timestamp ASC';

    // Apply pagination
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const results = await this.db.executeQuery<TrackPointApiFormat>(query, params);
    return results.map(row => this.convertFromDb(row));
  }

  async update(id: number, updates: Partial<TrackPoint>): Promise<TrackPoint | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const updated = { ...existing, ...updates };
    validateTrackPoint(updated);

    // Note: We need activityId for the API format conversion, but we don't store it in the TrackPoint model
    // We'll get it from the database
    const existingRow = await this.db.executeQuery<TrackPointApiFormat>(`
      SELECT activity_id FROM track_points WHERE id = ?
    `, [id]);

    if (existingRow.length === 0) {
      return null;
    }

    const apiFormat = trackPointToApiFormat(updated, existingRow[0].activity_id);

    await this.db.executeSql(`
      UPDATE track_points SET
        timestamp = ?, latitude = ?, longitude = ?, elevation = ?,
        accuracy = ?, speed = ?, heading = ?, source = ?
      WHERE id = ?
    `, [
      new Date(apiFormat.timestamp).getTime(),
      apiFormat.latitude,
      apiFormat.longitude,
      apiFormat.elevation,
      apiFormat.accuracy,
      apiFormat.speed,
      apiFormat.heading,
      apiFormat.source,
      id
    ]);

    return updated;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db.executeUpdate(`
      DELETE FROM track_points WHERE id = ?
    `, [id]);

    return result > 0;
  }

  async count(filters: TrackPointFilters = {}): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM track_points WHERE 1=1';
    const params: any[] = [];

    // Apply filters (same as findAll but without ordering/pagination)
    if (filters.activityId) {
      query += ' AND activity_id = ?';
      params.push(filters.activityId);
    }

    if (filters.source) {
      query += ' AND source = ?';
      params.push(filters.source);
    }

    if (filters.startTime) {
      query += ' AND timestamp >= ?';
      params.push(filters.startTime.getTime());
    }

    if (filters.endTime) {
      query += ' AND timestamp <= ?';
      params.push(filters.endTime.getTime());
    }

    if (filters.minAccuracy !== undefined) {
      query += ' AND accuracy >= ?';
      params.push(filters.minAccuracy);
    }

    if (filters.maxAccuracy !== undefined) {
      query += ' AND accuracy <= ?';
      params.push(filters.maxAccuracy);
    }

    const results = await this.db.executeQuery<{ count: number }>(query, params);
    return results[0]?.count || 0;
  }

  async bulkCreate(batch: TrackPointBatch): Promise<TrackPoint[]> {
    return this.db.transaction(async () => {
      const created: TrackPoint[] = [];
      for (const trackPoint of batch.trackPoints) {
        const result = await this.create(trackPoint, batch.activityId);
        created.push(result);
      }
      return created;
    });
  }

  async bulkCreateOptimized(batch: TrackPointBatch): Promise<number> {
    // More efficient bulk insert for large batches
    if (batch.trackPoints.length === 0) {
      return 0;
    }

    return this.db.transaction(async () => {
      // Validate all track points first
      for (const trackPoint of batch.trackPoints) {
        validateTrackPoint(trackPoint);
      }

      // Build bulk insert query
      const placeholders = batch.trackPoints.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const query = `
        INSERT INTO track_points (
          activity_id, timestamp, latitude, longitude, elevation,
          accuracy, speed, heading, source
        ) VALUES ${placeholders}
      `;

      // Flatten parameters
      const params: any[] = [];
      for (const trackPoint of batch.trackPoints) {
        const apiFormat = trackPointToApiFormat(trackPoint, batch.activityId);
        params.push(
          apiFormat.activity_id,
          new Date(apiFormat.timestamp).getTime(),
          apiFormat.latitude,
          apiFormat.longitude,
          apiFormat.elevation,
          apiFormat.accuracy,
          apiFormat.speed,
          apiFormat.heading,
          apiFormat.source
        );
      }

      await this.db.executeSql(query, params);
      return batch.trackPoints.length;
    });
  }

  async deleteByActivityId(activityId: string): Promise<number> {
    const result = await this.db.executeUpdate(`
      DELETE FROM track_points WHERE activity_id = ?
    `, [activityId]);

    return result;
  }

  async findLatestByActivityId(activityId: string, limit: number = 1): Promise<TrackPoint[]> {
    const results = await this.db.executeQuery<TrackPointApiFormat>(`
      SELECT * FROM track_points 
      WHERE activity_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `, [activityId, limit]);

    return results.map(row => this.convertFromDb(row));
  }

  async findByTimeRange(activityId: string, startTime: Date, endTime: Date): Promise<TrackPoint[]> {
    const results = await this.db.executeQuery<TrackPointApiFormat>(`
      SELECT * FROM track_points 
      WHERE activity_id = ? AND timestamp BETWEEN ? AND ?
      ORDER BY timestamp ASC
    `, [activityId, startTime.getTime(), endTime.getTime()]);

    return results.map(row => this.convertFromDb(row));
  }

  async findByAccuracyThreshold(activityId: string, maxAccuracy: number): Promise<TrackPoint[]> {
    const results = await this.db.executeQuery<TrackPointApiFormat>(`
      SELECT * FROM track_points 
      WHERE activity_id = ? AND accuracy <= ?
      ORDER BY timestamp ASC
    `, [activityId, maxAccuracy]);

    return results.map(row => this.convertFromDb(row));
  }

  async calculateBounds(activityId: string): Promise<BoundingBox | null> {
    const results = await this.db.executeQuery<{
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
      count: number;
    }>(`
      SELECT 
        MIN(latitude) as minLat,
        MAX(latitude) as maxLat,
        MIN(longitude) as minLng,
        MAX(longitude) as maxLng,
        COUNT(*) as count
      FROM track_points 
      WHERE activity_id = ?
    `, [activityId]);

    const row = results[0];
    if (!row || row.count === 0) {
      return null;
    }

    return {
      north: row.maxLat,
      south: row.minLat,
      east: row.maxLng,
      west: row.minLng
    };
  }

  async calculateDistance(activityId: string): Promise<number> {
    const trackPoints = await this.findByActivityId(activityId);
    
    if (trackPoints.length < 2) {
      return 0;
    }

    let totalDistance = 0;
    for (let i = 1; i < trackPoints.length; i++) {
      const prev = trackPoints[i - 1];
      const curr = trackPoints[i];
      totalDistance += this.haversineDistance(
        prev.latitude, prev.longitude,
        curr.latitude, curr.longitude
      );
    }

    return totalDistance;
  }

  async findOutliers(activityId: string, accuracyThreshold: number = 50): Promise<TrackPoint[]> {
    const results = await this.db.executeQuery<TrackPointApiFormat>(`
      SELECT * FROM track_points 
      WHERE activity_id = ? AND accuracy > ?
      ORDER BY accuracy DESC
    `, [activityId, accuracyThreshold]);

    return results.map(row => this.convertFromDb(row));
  }

  async getActivitySummary(activityId: string): Promise<{
    totalPoints: number;
    timeSpan: number;
    avgAccuracy: number;
    bounds: BoundingBox | null;
    distance: number;
  }> {
    const [countResult, statsResult, bounds] = await Promise.all([
      this.count({ activityId }),
      this.db.executeQuery<{
        minTime: number;
        maxTime: number;
        avgAccuracy: number;
      }>(`
        SELECT 
          MIN(timestamp) as minTime,
          MAX(timestamp) as maxTime,
          AVG(accuracy) as avgAccuracy
        FROM track_points 
        WHERE activity_id = ?
      `, [activityId]),
      this.calculateBounds(activityId)
    ]);

    const stats = statsResult[0];
    const timeSpan = stats ? stats.maxTime - stats.minTime : 0;
    const distance = await this.calculateDistance(activityId);

    return {
      totalPoints: countResult,
      timeSpan,
      avgAccuracy: stats?.avgAccuracy || 0,
      bounds,
      distance
    };
  }

  async cleanupByAccuracy(activityId: string, maxAccuracy: number): Promise<number> {
    const result = await this.db.executeUpdate(`
      DELETE FROM track_points 
      WHERE activity_id = ? AND accuracy > ?
    `, [activityId, maxAccuracy]);

    return result;
  }

  async thinTrackPoints(activityId: string, keepEveryNth: number = 2): Promise<number> {
    // Keep every Nth point to reduce data size while maintaining track shape
    return this.db.transaction(async () => {
      const allPoints = await this.findByActivityId(activityId);
      const toDelete: number[] = [];

      for (let i = 1; i < allPoints.length - 1; i++) {
        if (i % keepEveryNth !== 0) {
          // We need to get the database ID for deletion
          const pointWithId = await this.db.executeQuery<{ id: number }>(`
            SELECT id FROM track_points 
            WHERE activity_id = ? AND timestamp = ? AND latitude = ? AND longitude = ?
            LIMIT 1
          `, [
            activityId, 
            allPoints[i].timestamp.getTime(), 
            allPoints[i].latitude, 
            allPoints[i].longitude
          ]);
          
          if (pointWithId.length > 0) {
            toDelete.push(pointWithId[0].id);
          }
        }
      }

      if (toDelete.length === 0) {
        return 0;
      }

      const placeholders = toDelete.map(() => '?').join(',');
      const result = await this.db.executeUpdate(`
        DELETE FROM track_points WHERE id IN (${placeholders})
      `, toDelete);

      return result;
    });
  }

  private convertFromDb(row: TrackPointApiFormat): TrackPoint {
    // Convert timestamp back to Date object
    const converted: TrackPointApiFormat = {
      ...row,
      timestamp: new Date(row.timestamp).toISOString()
    };

    return trackPointFromApiFormat(converted);
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}