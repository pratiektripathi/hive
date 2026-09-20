
import { Navigate } from 'react-router-dom';
import { Login } from '@/pages/login';
import { useAuth } from '@/contexts/AuthContext';

export function LoginRoute() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/templates" replace />;
  }

  // If not authenticated, show login page directly
  return <Login />;
}
