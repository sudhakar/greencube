import { useState, useEffect, useCallback } from 'react'
import { executeQuery } from '@/lib/api'

interface WidgetDataState {
  data: Record<string, unknown>[]
  loading: boolean
  error: string | null
}

export function useWidgetData(query: object) {
  const [state, setState] = useState<WidgetDataState>({ data: [], loading: true, error: null })

  const fetchData = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const result = await executeQuery(query)
      setState({ data: result.data, loading: false, error: null })
    } catch (err) {
      setState({ data: [], loading: false, error: (err as Error).message })
    }
  }, [JSON.stringify(query)])

  useEffect(() => { fetchData() }, [fetchData])

  return { ...state, refetch: fetchData }
}
