import { getGenericErrorMessage } from '../utils/validation';

// Use environment variable or default to development
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 
  (typeof __DEV__ !== 'undefined' && __DEV__ 
    ? 'http://localhost:3000/api' 
    : 'https://your-production-backend.com/api');

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Secure API service that routes all requests through backend proxy
 * Never exposes API keys to the client
 */
class ApiService {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${API_BASE_URL}${endpoint}`;
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          error: data.error || data.message || getGenericErrorMessage(data),
          message: data.message,
        };
      }

      return { data };
    } catch (error) {
      console.error('API request failed:', error);
      return {
        error: getGenericErrorMessage(error),
      };
    }
  }

  /**
   * Fetch exchange rates through secure backend proxy
   */
  async getExchangeRates() {
    return this.request<{
      rates: { [currency: string]: number };
      lastUpdated: string;
    }>('/exchange-rates');
  }

  /**
   * Authenticate user through secure backend
   */
  async login(email: string, password: string) {
    return this.request<{
      token: string;
      user: {
        id: string;
        email: string;
        name: string;
        isAdmin: boolean;
      };
      attemptsRemaining?: number;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  /**
   * Register new user through secure backend
   */
  async signup(email: string, password: string, name?: string) {
    return this.request<{
      token: string;
      user: {
        id: string;
        email: string;
        name: string;
        isAdmin: boolean;
      };
    }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  /**
   * Geocode address through Google Maps proxy
   */
  async geocode(address: string) {
    return this.request<{
      results: any[];
      status: string;
    }>(`/geocode?address=${encodeURIComponent(address)}`);
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string) {
    return this.request<{ valid: boolean; user: any }>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }
}

export const apiService = new ApiService();
export default apiService;