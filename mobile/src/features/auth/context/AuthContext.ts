import { createContext } from 'react';

import type {
  LoginCredentials,
  Session,
} from '@/features/auth/authTypes';

export type AuthStatus =
  | 'loading'
  | 'authenticated'
  | 'unauthenticated';

export type AuthContextValue = {
  session: Session | null;
  status: AuthStatus;
  error: string;
  signIn: (credentials: LoginCredentials) => Promise<void>;
  signOut: () => Promise<void>;
  restoreSession: () => Promise<void>;
  clearError: () => void;
};

export const AuthContext = createContext<
  AuthContextValue | undefined
>(undefined);