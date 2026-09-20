import { Navigate } from 'react-router-dom';
import { Signup } from '@/pages/signup';
import { useAuth } from '@/contexts/AuthContext';

export function SignupRoute() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/templates" replace />;
  }

  return <Signup />;
}
