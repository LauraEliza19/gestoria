import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { ApiError } from '@/services/api';
import {
  getSession,
  login as requestLogin,
  logout as requestLogout,
} from '@/features/auth/services/authService';
import type {
  LoginCredentials,
  Session,
} from '@/features/auth/authTypes';
import {
  AuthContext,
  type AuthStatus,
} from '@/features/auth/context/AuthContext';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Não foi possível concluir a autenticação.';
}

function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    void getSession()
      .then((currentSession) => {
        if (!active) {
          return;
        }

        setSession(currentSession);
        setStatus('authenticated');
      })
      .catch((requestError: unknown) => {
        if (!active) {
          return;
        }

        setSession(null);
        setStatus('unauthenticated');

        if (!isUnauthorized(requestError)) {
          setError(getErrorMessage(requestError));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(
    async (credentials: LoginCredentials) => {
      setStatus('loading');
      setError('');

      try {
        await requestLogin(credentials);

        const currentSession = await getSession();

        setSession(currentSession);
        setStatus('authenticated');
      } catch (requestError) {
        setSession(null);
        setStatus('unauthenticated');
        setError(getErrorMessage(requestError));

        throw requestError;
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    setStatus('loading');
    setError('');

    try {
      await requestLogout();

      setSession(null);
      setStatus('unauthenticated');
    } catch (requestError) {
      setStatus('authenticated');
      setError(getErrorMessage(requestError));

      throw requestError;
    }
  }, []);

  const restoreSession = useCallback(async () => {
    setStatus('loading');
    setError('');

    try {
      const currentSession = await getSession();

      setSession(currentSession);
      setStatus('authenticated');
    } catch (requestError) {
      setSession(null);
      setStatus('unauthenticated');

      if (!isUnauthorized(requestError)) {
        setError(getErrorMessage(requestError));
      }
    }
  }, []);

  const clearError = useCallback(() => {
    setError('');
  }, []);

  const value = useMemo(
    () => ({
      session,
      status,
      error,
      signIn,
      signOut,
      restoreSession,
      clearError,
    }),
    [
      session,
      status,
      error,
      signIn,
      signOut,
      restoreSession,
      clearError,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}