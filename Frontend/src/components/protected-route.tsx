import React from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useNavigate } from '@tanstack/react-router';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute wrapper component
 * 
 * Redirects unauthenticated users to the login page.
 * Use this to wrap routes that require authentication.
 * 
 * Example:
 * ```tsx
 * <ProtectedRoute>
 *   <MyProtectedComponent />
 * </ProtectedRoute>
 * ```
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate({ to: '/login' });
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[#3a3a3a] border-t-white"></div>
          <p className="text-sm text-[#8a8a8a]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
