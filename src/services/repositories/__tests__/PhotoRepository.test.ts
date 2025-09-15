import { PhotoRepository } from '../PhotoRepository';
import { DatabaseService } from '../../database/DatabaseService';
import { createPhoto, generatePhotoId } from '../../../types';

// Mock DatabaseService
const mockExecuteSql = jest.fn();
const mockExecuteQuery = jest.fn();
const mockExecuteUpdate = jest.fn();
const mockTransaction = jest.fn();

const mockDb = {
  executeSql: mockExecuteSql,
  executeQuery: mockExecuteQuery,
  executeUpdate: mockExecuteUpdate,
  transaction: mockTransaction
} as unknown as DatabaseService;

describe('PhotoRepository', () => {
  let repository: PhotoRepository;
  let testPhoto: any;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PhotoRepository(mockDb);
    
    testPhoto = createPhoto({
      photoId: generatePhotoId(),
      activityId: 'test-activity-1',
      latitude: 45.5231,
      longitude: -122.6765,
      localUri: 'file://test-photo.jpg'
    });
  });

  describe('create', () => {
    it('should create a new photo', async () => {
      mockExecuteSql.mockResolvedValue([{ insertId: 1, rowsAffected: 1 }]);

      const result = await repository.create(testPhoto);

      expect(mockExecuteSql).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO photos'),
        expect.arrayContaining([
          testPhoto.photoId,
          testPhoto.activityId,
          expect.any(Number), // timestamp
          testPhoto.latitude,
          testPhoto.longitude,
          testPhoto.localUri,
          undefined, // cloud_uri
          undefined, // thumbnail_uri
          undefined, // exif_data
          undefined, // caption
          'local' // sync_status
        ])
      );
      expect(result).toBe(testPhoto);
    });

    it('should throw validation error for invalid photo', async () => {
      const invalidPhoto = { ...testPhoto, latitude: 91 }; // Invalid latitude

      await expect(repository.create(invalidPhoto)).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should find photo by ID', async () => {
      const mockRow = {
        photo_id: testPhoto.photoId,
        activity_id: testPhoto.activityId,
        timestamp: testPhoto.timestamp.getTime(),
        latitude: testPhoto.latitude,
        longitude: testPhoto.longitude,
        local_uri: testPhoto.localUri,
        cloud_uri: null,
        thumbnail_uri: null,
        exif_data: null,
        caption: null,
        sync_status: 'local'
      };

      mockExecuteQuery.mockResolvedValue([mockRow]);

      const result = await repository.findById(testPhoto.photoId);

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM photos WHERE photo_id = ?'),
        [testPhoto.photoId]
      );
      expect(result).toBeTruthy();
      expect(result?.photoId).toBe(testPhoto.photoId);
    });

    it('should return null if photo not found', async () => {
      mockExecuteQuery.mockResolvedValue([]);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByActivityId', () => {
    it('should find photos by activity ID', async () => {
      const mockRows = [
        {
          photo_id: 'photo-1',
          activity_id: 'test-activity-1',
          timestamp: Date.now(),
          latitude: 45.5231,
          longitude: -122.6765,
          local_uri: 'file://photo1.jpg',
          cloud_uri: null,
          thumbnail_uri: null,
          exif_data: null,
          caption: null,
          sync_status: 'local'
        }
      ];

      mockExecuteQuery.mockResolvedValue(mockRows);

      const result = await repository.findByActivityId('test-activity-1');

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM photos WHERE activity_id = ?'),
        ['test-activity-1']
      );
      expect(result).toHaveLength(1);
      expect(result[0].photoId).toBe('photo-1');
    });

    it('should apply filters correctly', async () => {
      mockExecuteQuery.mockResolvedValue([]);

      await repository.findByActivityId('test-activity-1', {
        syncStatus: 'synced',
        limit: 10
      });

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND sync_status = ?'),
        expect.arrayContaining(['test-activity-1', 'synced', 10])
      );
    });
  });

  describe('update', () => {
    it('should update existing photo', async () => {
      // Mock finding existing photo
      const mockRow = {
        photo_id: testPhoto.photoId,
        activity_id: testPhoto.activityId,
        timestamp: testPhoto.timestamp.getTime(),
        latitude: testPhoto.latitude,
        longitude: testPhoto.longitude,
        local_uri: testPhoto.localUri,
        cloud_uri: null,
        thumbnail_uri: null,
        exif_data: null,
        caption: null,
        sync_status: 'local'
      };

      mockExecuteQuery.mockResolvedValue([mockRow]);
      mockExecuteSql.mockResolvedValue([{ rowsAffected: 1 }]);

      const updates = { caption: 'Beautiful sunset', syncStatus: 'synced' as const };
      const result = await repository.update(testPhoto.photoId, updates);

      expect(mockExecuteSql).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE photos SET'),
        expect.arrayContaining([
          testPhoto.activityId,
          expect.any(Number), // timestamp
          testPhoto.latitude,
          testPhoto.longitude,
          testPhoto.localUri,
          undefined, // cloud_uri
          undefined, // thumbnail_uri
          undefined, // exif_data
          'Beautiful sunset', // updated caption
          'synced', // updated sync_status
          testPhoto.photoId
        ])
      );
      expect(result?.caption).toBe('Beautiful sunset');
      expect(result?.syncStatus).toBe('synced');
    });

    it('should return null if photo not found', async () => {
      mockExecuteQuery.mockResolvedValue([]);

      const result = await repository.update('non-existent', { caption: 'test' });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete photo and return true', async () => {
      mockExecuteUpdate.mockResolvedValue(1);

      const result = await repository.delete(testPhoto.photoId);

      expect(mockExecuteUpdate).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM photos WHERE photo_id = ?'),
        [testPhoto.photoId]
      );
      expect(result).toBe(true);
    });

    it('should return false if photo not found', async () => {
      mockExecuteUpdate.mockResolvedValue(0);

      const result = await repository.delete('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('count', () => {
    it('should count photos with filters', async () => {
      mockExecuteQuery.mockResolvedValue([{ count: 3 }]);

      const result = await repository.count({ activityId: 'test-activity-1', syncStatus: 'local' });

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as count FROM photos'),
        expect.arrayContaining(['test-activity-1', 'local'])
      );
      expect(result).toBe(3);
    });
  });

  describe('sync operations', () => {
    it('should find unsynced photos', async () => {
      mockExecuteQuery.mockResolvedValue([]);

      await repository.findUnsyncedPhotos(25);

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining("sync_status IN ('local', 'uploading')"),
        [25]
      );
    });

    it('should mark photo as synced', async () => {
      mockExecuteUpdate.mockResolvedValue(1);

      const result = await repository.markAsSynced(testPhoto.photoId, 'https://cloud.com/photo.jpg', 'https://cloud.com/thumb.jpg');

      expect(mockExecuteUpdate).toHaveBeenCalledWith(
        expect.stringContaining("sync_status = 'synced'"),
        ['https://cloud.com/photo.jpg', 'https://cloud.com/thumb.jpg', testPhoto.photoId]
      );
      expect(result).toBe(true);
    });

    it('should mark photo as uploading', async () => {
      mockExecuteUpdate.mockResolvedValue(1);

      const result = await repository.markAsUploading(testPhoto.photoId);

      expect(mockExecuteUpdate).toHaveBeenCalledWith(
        expect.stringContaining("sync_status = 'uploading'"),
        [testPhoto.photoId]
      );
      expect(result).toBe(true);
    });

    it('should mark photo as local', async () => {
      mockExecuteUpdate.mockResolvedValue(1);

      const result = await repository.markAsLocal(testPhoto.photoId);

      expect(mockExecuteUpdate).toHaveBeenCalledWith(
        expect.stringContaining("sync_status = 'local'"),
        [testPhoto.photoId]
      );
      expect(result).toBe(true);
    });
  });

  describe('findByLocation', () => {
    it('should find photos near a location', async () => {
      const mockRows = [
        {
          photo_id: 'nearby-photo',
          activity_id: 'test-activity-1',
          timestamp: Date.now(),
          latitude: 45.5235, // Close to test location
          longitude: -122.6760,
          local_uri: 'file://nearby.jpg',
          cloud_uri: null,
          thumbnail_uri: null,
          exif_data: null,
          caption: null,
          sync_status: 'local'
        }
      ];

      mockExecuteQuery.mockResolvedValue(mockRows);

      const result = await repository.findByLocation(45.5231, -122.6765, 0.5);

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('latitude BETWEEN ? AND ?'),
        expect.arrayContaining([
          expect.any(Number), // lat min
          expect.any(Number), // lat max
          expect.any(Number), // lng min
          expect.any(Number)  // lng max
        ])
      );
      expect(result).toHaveLength(1);
      expect(result[0].photoId).toBe('nearby-photo');
    });
  });

  describe('bulk operations', () => {
    it('should bulk create photos', async () => {
      const photos = [testPhoto];
      
      mockTransaction.mockImplementation(async (callback) => {
        return callback();
      });
      mockExecuteSql.mockResolvedValue([{ insertId: 1, rowsAffected: 1 }]);

      const result = await repository.bulkCreate(photos);

      expect(mockTransaction).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(testPhoto);
    });

    it('should bulk update photos', async () => {
      const updates = [
        { photoId: testPhoto.photoId, data: { caption: 'Updated caption' } }
      ];

      mockTransaction.mockImplementation(async (callback) => {
        return callback();
      });
      
      // Mock finding existing photo for update
      const mockRow = {
        photo_id: testPhoto.photoId,
        activity_id: testPhoto.activityId,
        timestamp: testPhoto.timestamp.getTime(),
        latitude: testPhoto.latitude,
        longitude: testPhoto.longitude,
        local_uri: testPhoto.localUri,
        cloud_uri: null,
        thumbnail_uri: null,
        exif_data: null,
        caption: null,
        sync_status: 'local'
      };

      mockExecuteQuery.mockResolvedValue([mockRow]);
      mockExecuteSql.mockResolvedValue([{ rowsAffected: 1 }]);

      const result = await repository.bulkUpdate(updates);

      expect(mockTransaction).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].caption).toBe('Updated caption');
    });
  });

  describe('deleteByActivityId', () => {
    it('should delete all photos for an activity', async () => {
      mockExecuteUpdate.mockResolvedValue(5);

      const result = await repository.deleteByActivityId('test-activity-1');

      expect(mockExecuteUpdate).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM photos WHERE activity_id = ?'),
        ['test-activity-1']
      );
      expect(result).toBe(5);
    });
  });

  describe('utility methods', () => {
    it('should find recent photos', async () => {
      mockExecuteQuery.mockResolvedValue([]);

      await repository.findRecentPhotos(10);

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY timestamp DESC'),
        [10]
      );
    });

    it('should find photos without thumbnails', async () => {
      mockExecuteQuery.mockResolvedValue([]);

      await repository.findPhotosWithoutThumbnails();

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('thumbnail_uri IS NULL OR thumbnail_uri = \'\'')
      );
    });

    it('should update thumbnail', async () => {
      mockExecuteUpdate.mockResolvedValue(1);

      const result = await repository.updateThumbnail(testPhoto.photoId, 'file://thumb.jpg');

      expect(mockExecuteUpdate).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE photos SET thumbnail_uri = ?'),
        ['file://thumb.jpg', testPhoto.photoId]
      );
      expect(result).toBe(true);
    });

    it('should find cover photo candidates', async () => {
      mockExecuteQuery.mockResolvedValue([]);

      await repository.findCoverPhotoCandidates('test-activity-1', 3);

      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('thumbnail_uri IS NOT NULL'),
        ['test-activity-1', 3]
      );
    });
  });
});