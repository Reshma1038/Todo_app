import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FullPageLoader } from "./Spinner";

/**
 * Blocks access to private pages for unauthenticated users.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}
