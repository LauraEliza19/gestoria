import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type {
  FinanceData,
  FinanceEntryFilters,
  FinanceEntryStatus,
  FinanceEntryType,
} from './financeTypes';
import { getFinanceData } from './services/financeService';

const DEFAULT_ERROR =
  'Não foi possível carregar o financeiro. Tente novamente.';

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return DEFAULT_ERROR;
}

export function useFinance() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [filters, setFilters] =
    useState<FinanceEntryFilters>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  const requestSequence = useRef(0);

  const requestData = useCallback(
    async (
      selectedFilters: FinanceEntryFilters,
      refresh = false
    ) => {
      const sequence = ++requestSequence.current;

      if (refresh) {
        setRefreshing(true);
      }

      setError(null);

      try {
        const response = await getFinanceData(selectedFilters);

        if (
          mounted.current &&
          sequence === requestSequence.current
        ) {
          setData(response);
        }
      } catch (requestError) {
        if (
          mounted.current &&
          sequence === requestSequence.current
        ) {
          setError(getErrorMessage(requestError));
        }
      } finally {
        if (
          mounted.current &&
          sequence === requestSequence.current
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    mounted.current = true;
    const sequence = ++requestSequence.current;

    getFinanceData(filters)
      .then((response) => {
        if (
          mounted.current &&
          sequence === requestSequence.current
        ) {
          setData(response);
        }
      })
      .catch((requestError: unknown) => {
        if (
          mounted.current &&
          sequence === requestSequence.current
        ) {
          setError(getErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (
          mounted.current &&
          sequence === requestSequence.current
        ) {
          setLoading(false);
        }
      });

    return () => {
      mounted.current = false;
    };
  }, [filters]);

  const updateFilters = useCallback(
    (nextFilters: FinanceEntryFilters) => {
      setLoading(true);
      setError(null);
      setFilters(nextFilters);
    },
    []
  );

  const selectType = useCallback(
    (entryType?: FinanceEntryType) => {
      updateFilters({ ...filters, entry_type: entryType });
    },
    [filters, updateFilters]
  );

  const selectStatus = useCallback(
    (status?: FinanceEntryStatus) => {
      updateFilters({ ...filters, status });
    },
    [filters, updateFilters]
  );

  const retry = useCallback(() => {
    setLoading(true);
    void requestData(filters);
  }, [filters, requestData]);

  const refresh = useCallback(() => {
    void requestData(filters, true);
  }, [filters, requestData]);

  return {
    data,
    filters,
    loading,
    refreshing,
    error,
    selectType,
    selectStatus,
    retry,
    refresh,
  };
}
