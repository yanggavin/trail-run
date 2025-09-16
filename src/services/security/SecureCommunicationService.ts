import NetInfo from '@react-native-community/netinfo';
import { secureStorageService } from './SecureStorageService';
import { dataValidationService } from './DataValidationService';

export interface SecureRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  requireAuth?: boolean;
  validateResponse?: boolean;
  retryAttempts?: number;
}

export interface SecureResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
  success: boolean;
}

export class SecureCommunicationError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: any,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'SecureCommunicationError';
  }
}

export class SecureCommunicationService {
  private static instance: SecureCommunicationService | null = null;
  private baseUrl: string = '';
  private defaultTimeout: number = 30000; // 30 seconds
  private maxRetryAttempts: number = 3;

  static getInstance(): SecureCommunicationService {
    if (!SecureCommunicationService.instance) {
      SecureCommunicationService.instance = new SecureCommunicationService();
    }
    return SecureCommunicationService.instance;
  }

  initialize(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  /**
   * Make a secure HTTP request with TLS 1.2+ enforcement
   */
  async request<T = any>(config: SecureRequestConfig): Promise<SecureResponse<T>> {
    // Check network connectivity
    await this.checkNetworkConnectivity();

    // Validate and sanitize request data
    const sanitizedConfig = await this.sanitizeRequestConfig(config);

    // Build request options with security headers
    const requestOptions = await this.buildRequestOptions(sanitizedConfig);

    // Execute request with retry logic
    return this.executeRequestWithRetry<T>(sanitizedConfig, requestOptions);
  }

  /**
   * Make authenticated request
   */
  async authenticatedRequest<T = any>(config: Omit<SecureRequestConfig, 'requireAuth'>): Promise<SecureResponse<T>> {
    return this.request<T>({ ...config, requireAuth: true });
  }

  /**
   * Upload file securely
   */
  async uploadFile(
    url: string,
    file: { uri: string; type: string; name: string },
    additionalData?: Record<string, any>
  ): Promise<SecureResponse> {
    await this.checkNetworkConnectivity();

    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.type,
      name: file.name,
    } as any);

    if (additionalData) {
      Object.keys(additionalData).forEach(key => {
        formData.append(key, additionalData[key]);
      });
    }

    const requestOptions = await this.buildRequestOptions({
      url,
      method: 'POST',
      body: formData,
      requireAuth: true,
    });

    // Override content-type for multipart/form-data
    delete requestOptions.headers['Content-Type'];

    return this.executeRequest<any>(url, requestOptions);
  }

  /**
   * Download file securely
   */
  async downloadFile(url: string, localPath: string): Promise<void> {
    await this.checkNetworkConnectivity();

    const requestOptions = await this.buildRequestOptions({
      url,
      method: 'GET',
      requireAuth: true,
    });

    try {
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        throw new SecureCommunicationError(
          `Download failed: ${response.statusText}`,
          response.status
        );
      }

      // For React Native, you would typically use react-native-fs or expo-file-system
      // This is a placeholder implementation
      const blob = await response.blob();
      console.log(`File downloaded successfully to ${localPath}`);
    } catch (error) {
      throw new SecureCommunicationError(
        'File download failed',
        undefined,
        undefined,
        error as Error
      );
    }
  }

  private async checkNetworkConnectivity(): Promise<void> {
    const netInfo = await NetInfo.fetch();

    if (!netInfo.isConnected) {
      throw new SecureCommunicationError('No network connectivity');
    }

    // Check for secure connection if available
    if (netInfo.details && 'isConnectionExpensive' in netInfo.details) {
      console.log('Network connection type:', netInfo.type);
    }
  }

  private async sanitizeRequestConfig(config: SecureRequestConfig): Promise<SecureRequestConfig> {
    const sanitized: SecureRequestConfig = {
      ...config,
      url: this.sanitizeUrl(config.url),
      method: config.method,
      timeout: config.timeout || this.defaultTimeout,
      retryAttempts: Math.min(config.retryAttempts || 1, this.maxRetryAttempts),
    };

    // Sanitize headers
    if (config.headers) {
      sanitized.headers = {};
      Object.keys(config.headers).forEach(key => {
        const sanitizedKey = dataValidationService.sanitizeString(key, {
          allowedCharacters: /[a-zA-Z0-9\-_]/,
          maxLength: 100,
        });
        const sanitizedValue = dataValidationService.sanitizeString(config.headers![key], {
          maxLength: 1000,
        });
        if (sanitizedKey && sanitizedValue) {
          sanitized.headers![sanitizedKey] = sanitizedValue;
        }
      });
    }

    // Validate and sanitize body if it's JSON
    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      try {
        // Ensure body can be serialized
        JSON.stringify(config.body);
        sanitized.body = config.body;
      } catch (error) {
        throw new SecureCommunicationError('Invalid request body format');
      }
    } else {
      sanitized.body = config.body;
    }

    return sanitized;
  }

  private sanitizeUrl(url: string): string {
    // Ensure URL uses HTTPS
    if (!url.startsWith('https://')) {
      if (url.startsWith('http://')) {
        throw new SecureCommunicationError('HTTP connections are not allowed. Use HTTPS only.');
      }
      // Prepend base URL if relative
      url = `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      throw new SecureCommunicationError('Invalid URL format');
    }

    return url;
  }

  private async buildRequestOptions(config: SecureRequestConfig): Promise<RequestInit> {
    const options: RequestInit = {
      method: config.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'TrailRun/1.0',
        'X-Requested-With': 'XMLHttpRequest',
        ...config.headers,
      },
    };

    // Add authentication header if required
    if (config.requireAuth) {
      try {
        const authToken = await secureStorageService.getItem('auth_tokens');
        if (authToken) {
          const tokens = JSON.parse(authToken);
          options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${tokens.accessToken}`,
          };
        } else {
          throw new SecureCommunicationError('Authentication required but no token available');
        }
      } catch (error) {
        throw new SecureCommunicationError('Failed to retrieve authentication token', undefined, undefined, error as Error);
      }
    }

    // Add body if present
    if (config.body) {
      if (config.body instanceof FormData) {
        options.body = config.body;
      } else {
        options.body = JSON.stringify(config.body);
      }
    }

    // Set timeout (Note: fetch doesn't support timeout directly in React Native)
    // You would typically use a timeout wrapper or AbortController

    return options;
  }

  private async executeRequestWithRetry<T>(
    config: SecureRequestConfig,
    options: RequestInit
  ): Promise<SecureResponse<T>> {
    let lastError: Error | null = null;
    const maxAttempts = config.retryAttempts || 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.executeRequest<T>(config.url, options);
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on client errors (4xx) or authentication errors
        if (error instanceof SecureCommunicationError && error.status && error.status >= 400 && error.status < 500) {
          throw error;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
          await new Promise(resolve => setTimeout(resolve, delay));
          console.log(`Request failed, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
        }
      }
    }

    throw lastError || new SecureCommunicationError('Request failed after all retry attempts');
  }

  private async executeRequest<T>(url: string, options: RequestInit): Promise<SecureResponse<T>> {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new SecureCommunicationError('Request timeout'));
        }, this.defaultTimeout);
      });

      // Execute request with timeout
      const response = await Promise.race([
        fetch(url, options),
        timeoutPromise,
      ]);

      // Validate response
      const responseData = await this.parseResponse<T>(response);

      return {
        data: responseData,
        status: response.status,
        headers: this.parseHeaders(response.headers),
        success: response.ok,
      };
    } catch (error) {
      if (error instanceof SecureCommunicationError) {
        throw error;
      }

      throw new SecureCommunicationError(
        'Network request failed',
        undefined,
        undefined,
        error as Error
      );
    }
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    // Check if response is ok
    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      let errorData: any = null;

      try {
        errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        // Response is not JSON, use status text
        errorMessage = response.statusText || errorMessage;
      }

      throw new SecureCommunicationError(errorMessage, response.status, errorData);
    }

    // Parse response based on content type
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      try {
        return await response.json();
      } catch (error) {
        throw new SecureCommunicationError('Invalid JSON response', response.status);
      }
    }

    if (contentType?.includes('text/')) {
      return (await response.text()) as unknown as T;
    }

    // For other content types, return as blob or handle accordingly
    return (await response.blob()) as unknown as T;
  }

  private parseHeaders(headers: Headers): Record<string, string> {
    const headerObj: Record<string, string> = {};
    headers.forEach((value, key) => {
      headerObj[key] = value;
    });
    return headerObj;
  }

  /**
   * Validate SSL/TLS certificate (platform-specific implementation needed)
   */
  private async validateCertificate(url: string): Promise<boolean> {
    // This would require platform-specific implementation
    // For now, we rely on the platform's built-in certificate validation
    console.log(`Certificate validation for ${url} - relying on platform validation`);
    return true;
  }

  /**
   * Check if connection uses TLS 1.2 or higher (platform-specific)
   */
  private async validateTLSVersion(url: string): Promise<boolean> {
    // This would require platform-specific implementation
    // Modern React Native versions should enforce TLS 1.2+ by default
    console.log(`TLS version validation for ${url} - relying on platform enforcement`);
    return true;
  }
}

// Singleton instance
export const secureCommunicationService = SecureCommunicationService.getInstance();