import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
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

export const AuthContextProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      const response = await api.post("/refresh");
      const { accessToken, user: refreshedUser } = response.data ?? {};

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
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post("/logout");
    } catch {
      // ignore logout failures
    } finally {
      clearAccessToken();
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, loading, checkAuthentication, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthContextProvider");
  }
  return context;
};