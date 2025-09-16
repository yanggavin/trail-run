import { SecureCommunicationService, SecureCommunicationError, secureCommunicationService, SecureRequestConfig } from '../SecureCommunicationService';
import NetInfo from '@react-native-community/netinfo';
import { secureStorageService } from '../SecureStorageService';
import { dataValidationService } from '../DataValidationService';

// Mock dependencies
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
}));

jest.mock('../SecureStorageService', () => ({
  secureStorageService: {
    getItem: jest.fn(),
  },
}));

jest.mock('../DataValidationService', () => ({
  dataValidationService: {
    sanitizeString: jest.fn((str) => str), // Default passthrough
  },
}));

// Mock global fetch
global.fetch = jest.fn();

describe('SecureCommunicationService', () => {
  let service: SecureCommunicationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = SecureCommunicationService.getInstance();
    service.initialize('https://api.trailrun.com');

    // Default network connectivity mock
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      type: 'wifi',
      details: { isConnectionExpensive: false },
    });

    // Default auth token mock
    (secureStorageService.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ accessToken: 'test-token' })
    );

    // Default fetch mock
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'application/json']]),
      json: jest.fn().mockResolvedValue({ success: true }),
      text: jest.fn().mockResolvedValue('success'),
      blob: jest.fn().mockResolvedValue(new Blob()),
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SecureCommunicationService.getInstance();
      const instance2 = SecureCommunicationService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should export singleton instance', () => {
      expect(secureCommunicationService).toBeInstanceOf(SecureCommunicationService);
      expect(secureCommunicationService).toBe(SecureCommunicationService.getInstance());
    });
  });

  describe('initialization', () => {
    it('should initialize with base URL', () => {
      const baseUrl = 'https://api.example.com';
      service.initialize(baseUrl);
      
      expect((service as any).baseUrl).toBe(baseUrl);
    });
  });

  describe('network connectivity checks', () => {
    it('should check network connectivity before requests', async () => {
      const config: SecureRequestConfig = {
        url: '/test',
        method: 'GET',
      };

      await service.request(config);

      expect(NetInfo.fetch).toHaveBeenCalled();
    });

    it('should throw error when no network connectivity', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
      });

      const config: SecureRequestConfig = {
        url: '/test',
        method: 'GET',
      };

      await expect(service.request(config)).rejects.toThrow(SecureCommunicationError);
      await expect(service.request(config)).rejects.toThrow('No network connectivity');
    });
  });

  describe('URL sanitization', () => {
    it('should prepend base URL to relative URLs', async () => {
      const config: SecureRequestConfig = {
        url: '/api/test',
        method: 'GET',
      };

      await service.request(config);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.trailrun.com/api/test',
        expect.any(Object)
      );
    });

    it('should accept absolute HTTPS URLs', async () => {
      const config: SecureRequestConfig = {
        url: 'https://external-api.com/test',
        method: 'GET',
      };

      await service.request(config);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://external-api.com/test',
        expect.any(Object)
      );
    });

    it('should reject HTTP URLs', async () => {
      const config: SecureRequestConfig = {
        url: 'http://insecure-api.com/test',
        method: 'GET',
      };

      await expect(service.request(config)).rejects.toThrow(SecureCommunicationError);
      await expect(service.request(config)).rejects.toThrow('HTTP connections are not allowed');
    });

    it('should reject invalid URLs', async () => {
      const config: SecureRequestConfig = {
        url: 'invalid-url',
        method: 'GET',
      };

      await expect(service.request(config)).rejects.toThrow(SecureCommunicationError);
      await expect(service.request(config)).rejects.toThrow('Invalid URL format');
    });
  });

  describe('request sanitization', () => {
    it('should sanitize headers', async () => {
      const config: SecureRequestConfig = {
        url: '/test',
        method: 'GET',
        headers: {
          'Custom-Header': 'value',
          'Another-Header': 'another-value',
        },
      };

      await service.request(config);

      expect(dataValidationService.sanitizeString).toHaveBeenCalledWith('Custom-Header', expect.any(Object));
      expect(dataValidationService.sanitizeString).toHaveBeenCalledWith('value', expect.any(Object));
    });

    it('should validate JSON body', async () => {
      const config: SecureRequestConfig = {
        url: '/test',
        method: 'POST',
        body: { test: 'data' },
      };

      await service.request(config);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ test: 'data' }),
        })
      );
    });

    it('should reject invalid JSON body', async () => {
      const circularObj: any = {};
      circularObj.self = circularObj;

      const config: SecureRequestConfig = {
        url: '/test',
        method: 'POST',
        body: circularObj,
      };

      await expect(service.request(config)).rejects.toThrow(SecureCommunicationError);
      await expect(service.request(config)).rejects.toThrow('Invalid request body format');
    });

    it('should handle FormData body', async () => {
      const formData = new FormData();
      formData.append('test', 'value');

      const config: SecureRequestConfig = {
        url: '/test',
        method: 'POST',
        body: formData,
      };

      await service.request(config);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: formData,
        })
      );
    });
  });

  describe('authentication', () => {
    it('should add authorization header for authenticated requests', async () => {
      const config: SecureRequestConfig = {
        url: '/test',
        method: 'GET',
        requireAuth: true,
      };

      await service.request(config);

      expect(secureStorageService.getItem).toHaveBeenCalledWith('auth_tokens');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    it('should use authenticatedRequest method', async () => {
      const config = {
        url: '/test',
        method: 'GET' as const,
      };

      await service.authenticatedRequest(config);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    it('should throw error when auth required but no token available', async () => {
      (secureStorageService.getItem as jest.Mock).mockResolvedValue(null);

      const config: SecureRequestConfig = {
        url: '/test',
        method: 'GET',
        requireAuth: true,
      };

      await expect(service.request(config)).rejects.toThrow(SecureCommunicationError);
      await expect(service.request(config)).rejects.toThrow('Authentication required but no token available');
    });

    it('should handle token retrieval errors', async () => {
      (secureStorageService.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const config: SecureRequestConfig = {
        url: '/test',
        method: 'GET',
        requireAuth: true,
      };

      await expect(service.request(config)).rejects.toThrow(SecureCommunicationError);
      await expect(service.request(config)).rejects.toThrow('Failed to retrieve authentication token');
    });
  });

  describe('request execution', () => {
    it('should make successful GET request', async () => {
      const config: SecureRequestConfig = {
        url: '/test',
        method: 'GET',
      };

      const response = await service.request(config);

      expect(response).toEqual({
        data: { success: true },
        status: 200,
        headers: { 'content-type': 'application/json' },
        success: true,
      });
    });

    it('should make successful POST request with body', async () => {
      const config: SecureRequestConfig = {
        url: '/test',
        method: 'POST',
        body: { test: 'data' },
      };

      const response = await service.request(config);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ test: 'data' }),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(response.success).toBe(true);
    });

    it('should handle non-JSON responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/plain']]),
        text: jest.fn().mockResolvedValue('plain text response'),
      });

      const config: SecureRequestConfig = {
        url: '/test',
        method: 'GET',
      };

      const response = await service.request(config);

      expect(response.data).toBe('plain text response');
    });

    it('should handle blob responses', async () => {
      const mockBlob = new Blob(['binary data']);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/octet-stream']]),
        blob: jest.fn().mockResolvedValue(mockBlob),
      });

      const config: SecureRequestConfig = {
        url: '/test',
        method: 'GET',
      };

      const response = await service.request(config);

      expect(response.data).toBe(mockBlob);
    });
  });

  describe('error handling', () => {
    it('should handle HTTP error responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Map(),
        json: jest.fn().mockResolvedValue({ error: 'Resource not found' }),
      });

      const config: SecureRequestConfig = {
        url: '/test',
        method: 'GET',
      };

      await expect(service.request(config)).rejects.toThrow(SecureCommunicationError);
      
      try {
        await service.request(config);
      } catch (error) {
        expect(error).toBeInstanceOf(SecureCommunicationError);
        expect((error as SecureCommunicationError).status).toBe(404);
        expect((error as SecureCommunicationError).response).toEqual({ error: 'Resource not found' });
      }
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const config: SecureRequestConfig = {
        url: '/test',
        method: 'GET',
      };

      await expect(service.request(config)).rejects.toThrow(SecureCommunicationError);
      await expect(service.request(config)).rejects.toThrow('Network request failed');
    });

    it('should handle invalid JSON responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      });

      const config: SecureRequestConfig = {
        url: '/test',
        method: 'GET',
      };

      await expect(service.request(config)).rejects.toThrow(SecureCommunicationError);
      await expect(service.request(config)).rejects.toThrow('Invalid JSON response');
    });
  });

  describe('retry logic', () => {
    it('should retry on server errors', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Map(),
          json: jest.fn().mockResolvedValue({ error: 'Server error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: jest.fn().mockResolvedValue({ success: true }),
        });

      const config: SecureRequestConfig = {
        url: '/test',
        method: 'GET',
        retryAttempts: 2,
      };

      const response = await service.request(config);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(response.success).toBe(true);
    });

    it('should not retry on client errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Map(),
        json: jest.fn().mockResolvedValue({ error: 'Bad request' }),
      });

      const config: SecureRequestConfig = {
        url: '/test',
        method: 'GET',
        retryAttempts: 3,
      };

      await expect(service.request(config)).rejects.toThrow(SecureCommunicationError);
      expect(global.fetch).toHaveBeenCalledTimes(1); // No retry
    });

    it('should respect maximum retry attempts', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Map(),
        json: jest.fn().mockResolvedValue({ error: 'Server error' }),
      });

      const config: SecureRequestConfig = {
        url: '/test',
        method: 'GET',
        retryAttempts: 2,
      };

      await expect(service.request(config)).rejects.toThrow(SecureCommunicationError);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('file operations', () => {
    it('should upload file with form data', async () => {
      const file = {
        uri: '/path/to/file.jpg',
        type: 'image/jpeg',
        name: 'photo.jpg',
      };

      const additionalData = {
        description: 'Test photo',
        category: 'nature',
      };

      await service.uploadFile('/upload', file, additionalData);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.trailrun.com/upload',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );

      // Verify Content-Type header is removed for FormData
      const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
      expect(callArgs.headers['Content-Type']).toBeUndefined();
    });

    it('should download file', async () => {
      const mockBlob = new Blob(['file content']);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map(),
        blob: jest.fn().mockResolvedValue(mockBlob),
      });

      await service.downloadFile('https://api.trailrun.com/download/file.jpg', '/local/path/file.jpg');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.trailrun.com/download/file.jpg',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    it('should handle download errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(service.downloadFile('https://api.trailrun.com/download/missing.jpg', '/local/path')).rejects.toThrow(SecureCommunicationError);
      await expect(service.downloadFile('https://api.trailrun.com/download/missing.jpg', '/local/path')).rejects.toThrow('Download failed');
    });
  });

  describe('security headers', () => {
    it('should include security headers in requests', async () => {
      const config: SecureRequestConfig = {
        url: '/test',
        method: 'GET',
      };

      await service.request(config);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'TrailRun/1.0',
            'X-Requested-With': 'XMLHttpRequest',
          }),
        })
      );
    });

    it('should allow custom headers to override defaults', async () => {
      const config: SecureRequestConfig = {
        url: '/test',
        method: 'GET',
        headers: {
          'Content-Type': 'application/xml',
          'Custom-Header': 'custom-value',
        },
      };

      await service.request(config);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/xml',
            'Custom-Header': 'custom-value',
          }),
        })
      );
    });
  });

  describe('timeout handling', () => {
    it('should handle request timeout', async () => {
      // Mock a slow response
      (global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 35000)) // 35 seconds
      );

      const config: SecureRequestConfig = {
        url: '/test',
        method: 'GET',
        timeout: 1000, // 1 second timeout
      };

      await expect(service.request(config)).rejects.toThrow(SecureCommunicationError);
      await expect(service.request(config)).rejects.toThrow('Request timeout');
    });
  });

  describe('error types', () => {
    it('should create SecureCommunicationError with all parameters', () => {
      const originalError = new Error('Original error');
      const response = { error: 'API error' };
      const error = new SecureCommunicationError('Communication error', 500, response, originalError);

      expect(error.message).toBe('Communication error');
      expect(error.status).toBe(500);
      expect(error.response).toBe(response);
      expect(error.originalError).toBe(originalError);
      expect(error.name).toBe('SecureCommunicationError');
    });

    it('should create SecureCommunicationError with minimal parameters', () => {
      const error = new SecureCommunicationError('Simple error');

      expect(error.message).toBe('Simple error');
      expect(error.status).toBeUndefined();
      expect(error.response).toBeUndefined();
      expect(error.originalError).toBeUndefined();
      expect(error.name).toBe('SecureCommunicationError');
    });
  });
});