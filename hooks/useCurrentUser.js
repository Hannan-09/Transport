import { useAuth } from "../contexts/AuthContext_Simple";

// Custom hook to get current user ID
export const useCurrentUser = () => {
  const { user } = useAuth();

  return {
    userId: user?.id,
    user: user,
    isAuthenticated: !!user,
  };
};
