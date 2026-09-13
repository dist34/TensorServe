import { useAuth } from '@/contexts/auth-context';
import { useCallback } from 'react';

interface FetchOptions extends RequestInit {
  data?: unknown;
}

interface FetchResponse<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

/**
 * Custom hook for making authenticated API requests
 *
 * Automatically includes Bearer token in Authorization header
 * and handles common error scenarios.
 *
 * Example usage:
 * ```tsx
 * const { apiCall } = useApiClient();
 *
 * const fetchData = async () => {
 *   const response = await apiCall<MyDataType>('/api/endpoint', {
 *     method: 'GET',
 *   });
 *
 *   if (response.ok) {
 *     console.log(response.data);
 *   } else {
 *     console.error(response.error);
 *   }
 * };
 * ```
 */
export const useApiClient = () => {
  const { token, logout } = useAuth();
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

  const apiCall = useCallback(
    async <T = unknown,>(
      endpoint: string,
      options: FetchOptions = {},
    ): Promise<FetchResponse<T>> => {
      try {
        const url = `${API_BASE_URL}${endpoint}`;

        // Prepare headers
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(options.headers as Record<string, string> || {}),
        };

        // Add authorization header if token exists
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        // Prepare body
        let body: string | undefined;
        if (options.data) {
          body = JSON.stringify(options.data);
        }

        // Make request
        const response = await fetch(url, {
          ...options,
          headers,
          body,
        });

        // Handle response
        let responseData: unknown;
        const contentType = response.headers.get('content-type');

        if (contentType?.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }

        // Check for authentication errors
        if (response.status === 401) {
          logout();
          return {
            ok: false,
            status: response.status,
            error: 'Your session has expired. Please log in again.',
          };
        }

        // Handle errors
        if (!response.ok) {
          const errorMessage =
            typeof responseData === 'object' &&
            responseData !== null &&
            'detail' in responseData
              ? (responseData as { detail: string }).detail
              : `HTTP ${response.status}: ${response.statusText}`;

          return {
            ok: false,
            status: response.status,
            error: errorMessage,
          };
        }

        return {
          ok: true,
          status: response.status,
          data: responseData as T,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'An unknown error occurred';

        return {
          ok: false,
          status: 0,
          error: errorMessage,
        };
      }
    },
    [token, logout, API_BASE_URL],
  );

  return { apiCall };
};

export default useApiClient;
