import axios, { type AxiosError, type AxiosRequestConfig } from "axios";


const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/v1/api",
  withCredentials: true, // Essential for HttpOnly refresh cookies
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (reason?: unknown) => void }> = [];

const authApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/v1/api",
  withCredentials: true,
});

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

// Memory storage for the access token
let accessToken: string | null = null;

// Export this to update the token from your Context
export const setAccessToken = (token: unknown) => {
  if (typeof token === "string") {
    accessToken = token;
  } else {
    console.error("Invalid access token:", token);
    accessToken = null;
  }
};
const getCookieValue = (name: string) => {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
};
// Request Interceptor
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers["Authorization"] = `Bearer ${accessToken}`;
  }
  const csrfToken = getCookieValue("csrfToken");

  if (csrfToken && config.method && ["post", "put", "patch", "delete"].includes(config.method.toLowerCase())) {
    config.headers = config.headers || {};
    (config.headers as Record<string, string>)["x-csrf-token"] = csrfToken;
  }
  return config;
});

// Response Interceptor for 401 and 403 handling
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await authApi.post("/refresh");
        setAccessToken(response.data.accessToken.toString());
        isRefreshing = false;
        processQueue(null);
        return api(originalRequest);
      } catch (err) {
        isRefreshing = false;
        processQueue(err, null);
        setAccessToken(null);
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);
// type ApiOptions = Omit<AxiosRequestConfig, "data"> & { body?: unknown };

// export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
//   const { body, ...rest } = options;
//   const response = await api.request<T>({
//     url: path,
//     ...rest,
//     data: body,
//   });
//   return response.data as T;
// }

export default api;