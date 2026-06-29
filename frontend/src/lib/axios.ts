import axios from 'axios'

const baseURL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001'

export const apiClient = axios.create({
  baseURL,
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor — reserved for auth headers when authentication is added
apiClient.interceptors.request.use(
  (config) => config,
  (error: unknown) => Promise.reject(error),
)

// Response interceptor — normalises errors into { message, status } shape
apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const message =
        (error.response?.data as { error?: string } | undefined)?.error ??
        error.message ??
        'An unexpected error occurred'
      const status = error.response?.status ?? 0
      return Promise.reject({ message, status })
    }
    return Promise.reject({ message: 'Network error', status: 0 })
  },
)

export default apiClient
