import { getGenericErrorMessage } from '../utils/validation';
import { API_BASE_URL } from '../config/api';

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

  /**
   * Grant / revoke a RevenueCat Pro or Mini entitlement for a user.
   * Admin-only: the caller must be the app's admin account (its Firebase ID
   * token is verified server-side; the RevenueCat secret key never leaves
   * the backend).
   */
  async adminEntitlement(
    token: string,
    params: { uid: string; entitlement: 'pro' | 'mini'; action: 'grant' | 'revoke'; duration?: string }
  ) {
    return this.request<{ ok: boolean; message: string }>('/admin/entitlements', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    });
  }

  /**
   * Look up a user's current RevenueCat entitlements. Admin-only.
   */
  async adminGetCustomer(token: string, uid: string) {
    return this.request<{
      found: boolean;
      uid: string;
      activeEntitlements?: string[];
      firstSeen?: string | null;
      lastSeen?: string | null;
    }>(`/admin/customers/${encodeURIComponent(uid)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  /**
   * Server-side moderation action. Admin-only: the caller's Firebase ID token
   * is verified server-side before the action is applied.
   */
  async adminModeration(
    token: string,
    action: 'warn' | 'suspend' | 'unsuspend' | 'delete',
    params: {
      uid: string;
      days?: number;
      reason?: string;
      note?: string;
    }
  ) {
    return this.request<{ ok: boolean; message?: string; warningCount?: number }>(
      `/admin/moderation/${action}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(params),
      }
    );
  }

  /**
   * Server-side account status check (suspended / deleted). The caller's
   * Firebase ID token is verified server-side.
   */
  async getAccountStatus(token: string) {
    return this.request<{
      uid: string;
      exists: boolean | null;
      suspended: boolean;
      suspendedUntil: number;
      deleted: boolean;
    }>('/auth/status', {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

export const apiService = new ApiService();
export default apiService;