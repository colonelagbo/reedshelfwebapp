import { Navigate } from 'react-router-dom';
import { getCurrentUser } from '../../lib/appStore';
import { authStorage } from '../../lib/api';

export function AdminProtectedRoute({ children }) {
  const user = getCurrentUser();
  const token = authStorage.getToken();

  if (!token || !user) {
    return <Navigate to="/sign-in?redirect=/admin" replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/app/home" replace />;
  }

  return children;
}

