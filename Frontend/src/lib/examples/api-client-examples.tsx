import { useApiClient } from '@/lib/hooks/use-api-client';
import { useEffect, useState } from 'react';
import React from 'react';

/**
 * Example component showing how to use the useApiClient hook
 * for making authenticated API requests
 */

// Example 1: Simple GET request
export const ExampleGetRequest = () => {
  const { apiCall } = useApiClient();
  const [data, setData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    const response = await apiCall('/metrics', { method: 'GET' });

    if (response.ok) {
      setData(JSON.stringify(response.data, null, 2));
      setError(null);
    } else {
      setError(response.error || 'Failed to fetch metrics');
    }
    setLoading(false);
  };

  return (
    <div>
      <button onClick={fetchMetrics} disabled={loading}>
        {loading ? 'Loading...' : 'Fetch Metrics'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {data && <pre>{data}</pre>}
    </div>
  );
};

// Example 2: POST request with data
interface BenchmarkRequest {
  model_name: string;
  batch_size: number;
  num_iterations: number;
}

interface BenchmarkResponse {
  id: string;
  status: string;
  results?: {
    avg_latency: number;
    throughput: number;
  };
}

export const ExamplePostRequest = () => {
  const { apiCall } = useApiClient();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BenchmarkResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runBenchmark = async () => {
    setLoading(true);
    setError(null);

    const benchmarkData: BenchmarkRequest = {
      model_name: 'llama-2-7b',
      batch_size: 1,
      num_iterations: 10,
    };

    const response = await apiCall<BenchmarkResponse>('/benchmark', {
      method: 'POST',
      data: benchmarkData,
    });

    if (response.ok) {
      setResult(response.data || null);
    } else {
      setError(response.error || 'Benchmark failed');
    }
    setLoading(false);
  };

  return (
    <div>
      <button onClick={runBenchmark} disabled={loading}>
        {loading ? 'Running...' : 'Run Benchmark'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {result && (
        <div>
          <p>Status: {result.status}</p>
          {result.results && (
            <pre>{JSON.stringify(result.results, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  );
};

// Example 3: PUT request to update data
interface UpdateProfileRequest {
  email: string;
  notification_preferences: Record<string, boolean>;
}

export const ExamplePutRequest = () => {
  const { apiCall } = useApiClient();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateProfile = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    const updateData: UpdateProfileRequest = {
      email: 'user@example.com',
      notification_preferences: {
        email_alerts: true,
        performance_reports: true,
      },
    };

    const response = await apiCall('/profile', {
      method: 'PUT',
      data: updateData,
    });

    if (response.ok) {
      setSuccess(true);
    } else {
      setError(response.error || 'Update failed');
    }
    setLoading(false);
  };

  return (
    <div>
      <button onClick={updateProfile} disabled={loading}>
        {loading ? 'Updating...' : 'Update Profile'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>Profile updated successfully</p>}
    </div>
  );
};

// Example 4: DELETE request
export const ExampleDeleteRequest = () => {
  const { apiCall } = useApiClient();
  const [loading, setLoading] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteBenchmark = async (benchmarkId: string) => {
    setLoading(true);
    setError(null);

    const response = await apiCall(`/benchmark/${benchmarkId}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      setDeleted(true);
    } else {
      setError(response.error || 'Delete failed');
    }
    setLoading(false);
  };

  return (
    <div>
      <button onClick={() => deleteBenchmark('123')} disabled={loading}>
        {loading ? 'Deleting...' : 'Delete Benchmark'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {deleted && <p style={{ color: 'green' }}>Benchmark deleted</p>}
    </div>
  );
};

// Example 5: useEffect with API call
interface MetricsData {
  cpu_usage: number;
  memory_usage: number;
  gpu_utilization: number;
}

export const ExampleUseEffectFetch = () => {
  const { apiCall } = useApiClient();
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      const response = await apiCall<MetricsData>('/metrics/current', {
        method: 'GET',
      });

      if (response.ok) {
        setMetrics(response.data || null);
      } else {
        setError(response.error || 'Failed to fetch metrics');
      }
      setLoading(false);
    };

    fetchMetrics();

    // Optional: Set up polling
    const interval = setInterval(fetchMetrics, 5000); // Refresh every 5s

    return () => clearInterval(interval);
  }, [apiCall]);

  if (loading) return <div>Loading metrics...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div>
      <p>CPU: {metrics?.cpu_usage}%</p>
      <p>Memory: {metrics?.memory_usage}%</p>
      <p>GPU: {metrics?.gpu_utilization}%</p>
    </div>
  );
};

// Example 6: Error handling with auto-logout
export const ExampleErrorHandling = () => {
  const { apiCall } = useApiClient();
  const [error, setError] = useState<string | null>(null);

  const makeRequest = async () => {
    setError(null);

    const response = await apiCall('/protected-endpoint', {
      method: 'GET',
    });

    if (!response.ok) {
      // apiCall automatically calls logout() on 401 errors
      if (response.status === 401) {
        setError(
          'Session expired. Please log in again.',
        );
      } else if (response.status === 403) {
        setError('You do not have permission to access this resource.');
      } else if (response.status === 404) {
        setError('Resource not found.');
      } else {
        setError(response.error || 'An error occurred');
      }
    }
  };

  return (
    <div>
      <button onClick={makeRequest}>Make Request</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

/**
 * QUICK REFERENCE
 * ================
 *
 * Basic usage:
 * const { apiCall } = useApiClient();
 *
 * GET request:
 * const response = await apiCall('/endpoint', { method: 'GET' });
 *
 * POST request:
 * const response = await apiCall<MyType>('/endpoint', {
 *   method: 'POST',
 *   data: { key: 'value' },
 * });
 *
 * PUT request:
 * const response = await apiCall('/endpoint/123', {
 *   method: 'PUT',
 *   data: { key: 'updated' },
 * });
 *
 * DELETE request:
 * const response = await apiCall('/endpoint/123', { method: 'DELETE' });
 *
 * Features:
 * - ✅ Automatically adds Bearer token to Authorization header
 * - ✅ Automatically calls logout() on 401 errors
 * - ✅ Handles JSON responses
 * - ✅ Type-safe with generics
 * - ✅ Comprehensive error handling
 * - ✅ Works with all HTTP methods
 *
 * Response structure:
 * {
 *   ok: boolean,          // Success status
 *   status: number,       // HTTP status code
 *   data?: T,             // Response data (typed)
 *   error?: string,       // Error message
 * }
 */
