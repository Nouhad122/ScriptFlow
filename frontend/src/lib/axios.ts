import axios from 'axios'

const baseURL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001'

export const apiClient = axios.create({
  baseURL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Long-running AI endpoints — override the global timeout per-request.
export const AI_TIMEOUT_MS = 300_000 // 5 minutes: covers two sequential AI calls

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
      return Promise.reject({ message, status, data: error.response?.data })
    }
    return Promise.reject({ message: 'Network error', status: 0, data: undefined })
  },
)

export default apiClient
