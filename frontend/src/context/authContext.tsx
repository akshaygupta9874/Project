import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import api, { clearAccessToken, setAccessToken } from "../apiInterceptor";

type UserRole = "RIDER" | "DRIVER" | "ADMIN";

export interface User {
  _id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: UserRole[];
}

export interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  checkAuthentication: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthContextProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuthentication = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api.post("/refresh");

      const {
        accessToken,
        user: refreshedUser,
      } = response.data ?? {};

      if (typeof accessToken === "string" && refreshedUser) {
        setAccessToken(accessToken);
        setUser(refreshedUser);
        setIsAuthenticated(true);
      } else {
        clearAccessToken();
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch {
      clearAccessToken();
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkAuthentication();
  }, [checkAuthentication]);

  const logout = async () => {
    setLoading(true);

    try {
      await api.post("/logout");
    } catch {
      // Ignore logout failures
    } finally {
      clearAccessToken();
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        loading,
        checkAuthentication,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuthContext must be used within an AuthContextProvider"
    );
  }

  return context;
};