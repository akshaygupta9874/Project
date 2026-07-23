import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig } from "axios";

const apiBaseUrl = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/+$/u, "");
const apiBasePath = `${apiBaseUrl}/v1`;
const authBasePath = `${apiBasePath}/auth`;

export const appApi = axios.create({
  baseURL: apiBasePath,
  withCredentials: true,
});

const api = axios.create({
  baseURL: authBasePath,
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (reason?: unknown) => void }> = [];

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

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const clearAccessToken = () => {
  accessToken = null;
};

export const getAccessToken = () => accessToken;

const getCookieValue = (name: string) => {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
};

const attachAuthInterceptors = (instance: AxiosInstance) => {
  instance.interceptors.request.use((config) => {
    config.headers = config.headers || {};

    if (accessToken) {
      (config.headers as Record<string, string>)["Authorization"] = `Bearer ${accessToken}`;
    }

    const csrfToken = getCookieValue("csrfToken");
    if (csrfToken && config.method && ["post", "put", "patch", "delete"].includes(config.method.toLowerCase())) {
      (config.headers as Record<string, string>)["x-csrf-token"] = csrfToken;
    }

    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

      if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then(() => instance(originalRequest))
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const response = await api.post("/refresh");
          const newAccessToken = response.data?.accessToken;
          setAccessToken(typeof newAccessToken === "string" ? newAccessToken : null);
          isRefreshing = false;
          processQueue(null);
          return instance(originalRequest);
        } catch (err) {
          isRefreshing = false;
          processQueue(err, null);
          clearAccessToken();
          return Promise.reject(err);
        }
      }

      return Promise.reject(error);
    },
  );
};

attachAuthInterceptors(api);
attachAuthInterceptors(appApi);
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