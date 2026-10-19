import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { DashboardOverview } from './dashboardTypes';
import { getDashboardOverview } from './services/dashboardService';

const DEFAULT_ERROR =
  'Não foi possível carregar a visão executiva. Tente novamente.';

function getErrorMessage(error: unknown) {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  return DEFAULT_ERROR;
}

export function useExecutiveDashboard() {
  const [overview, setOverview] =
    useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  const requestInFlight = useRef<Promise<void> | null>(null);

  const loadDashboard = useCallback(
    (refresh = false): Promise<void> => {
      if (requestInFlight.current) {
        return requestInFlight.current;
      }

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const request = getDashboardOverview()
        .then((response) => {
          if (mounted.current) {
            setOverview(response);
          }
        })
        .catch((requestError: unknown) => {
          if (mounted.current) {
            setError(getErrorMessage(requestError));
          }
        })
        .finally(() => {
          if (requestInFlight.current === request) {
            requestInFlight.current = null;
          }

          if (mounted.current) {
            setLoading(false);
            setRefreshing(false);
          }
        });

      requestInFlight.current = request;

      return request;
    },
    []
  );

  useEffect(() => {
    mounted.current = true;

    if (!requestInFlight.current) {
      const request = getDashboardOverview()
        .then((response) => {
          if (mounted.current) {
            setOverview(response);
          }
        })
        .catch((requestError: unknown) => {
          if (mounted.current) {
            setError(getErrorMessage(requestError));
          }
        })
        .finally(() => {
          if (requestInFlight.current === request) {
            requestInFlight.current = null;
          }

          if (mounted.current) {
            setLoading(false);
          }
        });

      requestInFlight.current = request;
    }

    return () => {
      mounted.current = false;
    };
  }, []);

  const retry = useCallback(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const refresh = useCallback(() => {
    void loadDashboard(true);
  }, [loadDashboard]);

  return {
    overview,
    loading,
    refreshing,
    error,
    retry,
    refresh,
  };
}