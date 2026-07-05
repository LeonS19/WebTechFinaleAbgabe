import { ref, watch } from 'vue'
import { useQuery } from '@vue/apollo-composable'

export function useOfflineAwareQuery(gqlQuery, variablesFn, optionsFn, config) {
  const { cacheFn, dataKey } = config

  const data = ref([])
  const loading = ref(true)
  const isOffline = ref(false)
  const error = ref(null)

  async function loadFromCache() {
    isOffline.value = true
    try {
      data.value = await cacheFn()
      error.value = null
    } catch (cacheErr) {
      error.value = cacheErr
    } finally {
      loading.value = false
    }
  }

  const { result, loading: apolloLoading, onResult, onError, refetch } = useQuery(
    gqlQuery,
    variablesFn,
    optionsFn,
  )

  onResult((res) => {
    if (res.data) {
      data.value = res.data[dataKey]
      isOffline.value = false
      error.value = null
    }
    loading.value = false
  })

  onError(() => {
    loadFromCache()
  })

  watch(
    () => navigator.onLine,
    (online) => {
      if (!online) {
        loadFromCache()
      }
    },
    { immediate: true },
  )

  return { data, loading, isOffline, error, refetch }
}