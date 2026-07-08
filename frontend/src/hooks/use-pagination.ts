import { useState, useMemo, useCallback } from 'react'

export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage   = Math.min(page, totalPages)

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, safePage, pageSize])

  const resetPage = useCallback(() => setPage(1), [])

  return { page: safePage, setPage, totalPages, pageItems, total: items.length, resetPage }
}
