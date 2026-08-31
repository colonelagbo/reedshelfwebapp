import { Navigate, useLocation } from 'react-router-dom';
import { getCurrentUser } from '../lib/appStore';
export function ProtectedRoute({ children }) { const location=useLocation(); return getCurrentUser() ? children : <Navigate to="/sign-in" replace state={{from:location.pathname}}/>; }
