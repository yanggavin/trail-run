import { DatabaseService } from '../database/DatabaseService';
import { 
  Activity, 
  ActivityApiFormat, 
  activityToApiFormat, 
  activityFromApiFormat,
  validateActivity 
} from '../../types';

export interface ActivityFilters {
  userId?: string;
  status?: Activity['status'];
  syncStatus?: Activity['syncStatus'];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ActivityStats {
  totalActivities: number;
  totalDistance: number;
  totalDuration: number;
  averagePace: number;
}

export class ActivityRepository {
  constructor(private db: DatabaseService) {}

  async create(activity: Activity): Promise<Activity> {
    validateActivity(activity);
    
    const apiFormat = activityToApiFormat(activity);
    
    await this.db.executeSql(`
      INSERT INTO activities (
        activity_id, user_id, started_at, ended_at, status,
        duration_sec, distance_m, avg_pace_sec_per_km, elev_gain_m, elev_loss_m,
        polyline, bounds, splits, cover_photo_id, device_meta,
        created_at, updated_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      apiFormat.activity_id,
      apiFormat.user_id,
      new Date(apiFormat.started_at).getTime(),
      apiFormat.ended_at ? new Date(apiFormat.ended_at).getTime() : null,
      apiFormat.status,
      apiFormat.duration_sec,
      apiFormat.distance_m,
      apiFormat.avg_pace_sec_per_km,
      apiFormat.elev_gain_m,
      apiFormat.elev_loss_m,
      apiFormat.polyline,
      apiFormat.bounds,
      apiFormat.splits,
      apiFormat.cover_photo_id,
      apiFormat.device_meta,
      new Date(apiFormat.created_at).getTime(),
      new Date(apiFormat.updated_at).getTime(),
      apiFormat.sync_status
    ]);

    return activity;
  }

  async findById(activityId: string): Promise<Activity | null> {
    const results = await this.db.executeQuery<ActivityApiFormat>(`
      SELECT * FROM activities WHERE activity_id = ?
    `, [activityId]);

    if (results.length === 0) {
      return null;
    }

    return this.convertFromDb(results[0]);
  }

  async findByUserId(userId: string, filters: Omit<ActivityFilters, 'userId'> = {}): Promise<Activity[]> {
    let query = 'SELECT * FROM activities WHERE user_id = ?';
    const params: any[] = [userId];

    // Apply filters
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.syncStatus) {
      query += ' AND sync_status = ?';
      params.push(filters.syncStatus);
    }

    if (filters.startDate) {
      query += ' AND started_at >= ?';
      params.push(filters.startDate.getTime());
    }

    if (filters.endDate) {
      query += ' AND started_at <= ?';
      params.push(filters.endDate.getTime());
    }

    // Order by most recent first
    query += ' ORDER BY started_at DESC';

    // Apply pagination
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const results = await this.db.executeQuery<ActivityApiFormat>(query, params);
    return results.map(row => this.convertFromDb(row));
  }

  async findAll(filters: ActivityFilters = {}): Promise<Activity[]> {
    let query = 'SELECT * FROM activities WHERE 1=1';
    const params: any[] = [];

    // Apply filters
    if (filters.userId) {
      query += ' AND user_id = ?';
      params.push(filters.userId);
    }

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.syncStatus) {
      query += ' AND sync_status = ?';
      params.push(filters.syncStatus);
    }

    if (filters.startDate) {
      query += ' AND started_at >= ?';
      params.push(filters.startDate.getTime());
    }

    if (filters.endDate) {
      query += ' AND started_at <= ?';
      params.push(filters.endDate.getTime());
    }

    // Order by most recent first
    query += ' ORDER BY started_at DESC';

    // Apply pagination
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const results = await this.db.executeQuery<ActivityApiFormat>(query, params);
    return results.map(row => this.convertFromDb(row));
  }

  async update(activityId: string, updates: Partial<Activity>): Promise<Activity | null> {
    const existing = await this.findById(activityId);
    if (!existing) {
      return null;
    }

    const updated = { ...existing, ...updates, updatedAt: new Date() };
    validateActivity(updated);

    const apiFormat = activityToApiFormat(updated);

    await this.db.executeSql(`
      UPDATE activities SET
        user_id = ?, started_at = ?, ended_at = ?, status = ?,
        duration_sec = ?, distance_m = ?, avg_pace_sec_per_km = ?,
        elev_gain_m = ?, elev_loss_m = ?, polyline = ?, bounds = ?,
        splits = ?, cover_photo_id = ?, device_meta = ?,
        updated_at = ?, sync_status = ?
      WHERE activity_id = ?
    `, [
      apiFormat.user_id,
      new Date(apiFormat.started_at).getTime(),
      apiFormat.ended_at ? new Date(apiFormat.ended_at).getTime() : null,
      apiFormat.status,
      apiFormat.duration_sec,
      apiFormat.distance_m,
      apiFormat.avg_pace_sec_per_km,
      apiFormat.elev_gain_m,
      apiFormat.elev_loss_m,
      apiFormat.polyline,
      apiFormat.bounds,
      apiFormat.splits,
      apiFormat.cover_photo_id,
      apiFormat.device_meta,
      new Date(apiFormat.updated_at).getTime(),
      apiFormat.sync_status,
      activityId
    ]);

    return updated;
  }

  async delete(activityId: string): Promise<boolean> {
    const result = await this.db.executeUpdate(`
      DELETE FROM activities WHERE activity_id = ?
    `, [activityId]);

    return result > 0;
  }

  async count(filters: ActivityFilters = {}): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM activities WHERE 1=1';
    const params: any[] = [];

    // Apply filters (same as findAll but without ordering/pagination)
    if (filters.userId) {
      query += ' AND user_id = ?';
      params.push(filters.userId);
    }

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.syncStatus) {
      query += ' AND sync_status = ?';
      params.push(filters.syncStatus);
    }

    if (filters.startDate) {
      query += ' AND started_at >= ?';
      params.push(filters.startDate.getTime());
    }

    if (filters.endDate) {
      query += ' AND started_at <= ?';
      params.push(filters.endDate.getTime());
    }

    const results = await this.db.executeQuery<{ count: number }>(query, params);
    return results[0]?.count || 0;
  }

  async getStats(userId: string, filters: Omit<ActivityFilters, 'userId'> = {}): Promise<ActivityStats> {
    let query = `
      SELECT 
        COUNT(*) as totalActivities,
        COALESCE(SUM(distance_m), 0) as totalDistance,
        COALESCE(SUM(duration_sec), 0) as totalDuration,
        COALESCE(AVG(avg_pace_sec_per_km), 0) as averagePace
      FROM activities 
      WHERE user_id = ? AND status = 'completed'
    `;
    const params: any[] = [userId];

    // Apply date filters
    if (filters.startDate) {
      query += ' AND started_at >= ?';
      params.push(filters.startDate.getTime());
    }

    if (filters.endDate) {
      query += ' AND started_at <= ?';
      params.push(filters.endDate.getTime());
    }

    const results = await this.db.executeQuery<{
      totalActivities: number;
      totalDistance: number;
      totalDuration: number;
      averagePace: number;
    }>(query, params);

    const row = results[0];
    return {
      totalActivities: row?.totalActivities || 0,
      totalDistance: row?.totalDistance || 0,
      totalDuration: row?.totalDuration || 0,
      averagePace: row?.averagePace || 0
    };
  }

  async findActiveActivity(userId: string): Promise<Activity | null> {
    const results = await this.db.executeQuery<ActivityApiFormat>(`
      SELECT * FROM activities 
      WHERE user_id = ? AND status IN ('active', 'paused')
      ORDER BY started_at DESC
      LIMIT 1
    `, [userId]);

    if (results.length === 0) {
      return null;
    }

    return this.convertFromDb(results[0]);
  }

  async findUnsyncedActivities(limit: number = 50): Promise<Activity[]> {
    const results = await this.db.executeQuery<ActivityApiFormat>(`
      SELECT * FROM activities 
      WHERE sync_status IN ('local', 'syncing')
      ORDER BY created_at ASC
      LIMIT ?
    `, [limit]);

    return results.map(row => this.convertFromDb(row));
  }

  async markAsSynced(activityId: string): Promise<boolean> {
    const result = await this.db.executeUpdate(`
      UPDATE activities SET sync_status = 'synced', updated_at = ?
      WHERE activity_id = ?
    `, [Date.now(), activityId]);

    return result > 0;
  }

  async markAsSyncing(activityId: string): Promise<boolean> {
    const result = await this.db.executeUpdate(`
      UPDATE activities SET sync_status = 'syncing', updated_at = ?
      WHERE activity_id = ?
    `, [Date.now(), activityId]);

    return result > 0;
  }

  async bulkCreate(activities: Activity[]): Promise<Activity[]> {
    return this.db.transaction(async () => {
      const created: Activity[] = [];
      for (const activity of activities) {
        const result = await this.create(activity);
        created.push(result);
      }
      return created;
    });
  }

  async bulkUpdate(updates: Array<{ activityId: string; data: Partial<Activity> }>): Promise<Activity[]> {
    return this.db.transaction(async () => {
      const updated: Activity[] = [];
      for (const { activityId, data } of updates) {
        const result = await this.update(activityId, data);
        if (result) {
          updated.push(result);
        }
      }
      return updated;
    });
  }

  async deleteByUserId(userId: string): Promise<number> {
    const result = await this.db.executeUpdate(`
      DELETE FROM activities WHERE user_id = ?
    `, [userId]);

    return result;
  }

  private convertFromDb(row: ActivityApiFormat): Activity {
    // Convert timestamps back to Date objects
    const converted: ActivityApiFormat = {
      ...row,
      started_at: new Date(row.started_at).toISOString(),
      ended_at: row.ended_at ? new Date(row.ended_at).toISOString() : undefined,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString()
    };

    return activityFromApiFormat(converted);
  }
}