import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';

import api, { prefetchCsrfToken, invalidateCsrfToken } from '@/lib/api';

export type AuthRole = 'docente' | 'secretario';

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  rol: AuthRole;
};

type LoginInput = {
  username: string;
  password: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  rol: AuthRole | null;
  isLoading: boolean;
  login: (credentials: LoginInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const authMeQueryKey = ['auth', 'me'] as const;

async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const { data } = await api.get<AuthUser>(`/auth/me?t=${Date.now()}`, {
      headers: { 'X-Skip-Toast': '1' },
    });

    // Si hay sesión activa, precargamos el CSRF token para que la cookie
    // esté lista antes de cualquier POST/PUT/PATCH/DELETE.
    await prefetchCsrfToken();

    return data;
  } catch (error) {
    const axiosError = error as AxiosError;

    if (axiosError.response?.status === 401) {
      return null;
    }

    throw error;
  }
}

async function loginRequest(credentials: LoginInput): Promise<AuthUser> {
  const { data } = await api.post<AuthUser>('/auth/login', credentials, {
    headers: {
      'X-Skip-Toast': '1',
    },
  });

  return data;
}

async function logoutRequest(): Promise<void> {
  await api.post('/auth/logout');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: authMeQueryKey,
    queryFn: fetchCurrentUser,
  });

  const loginMutation = useMutation({
    mutationFn: loginRequest,
    onSuccess: async () => {
      // Precargamos el CSRF token ANTES de invalidar queries,
      // así la cookie estará lista para cualquier POST que se dispare después.
      await prefetchCsrfToken();
      await queryClient.invalidateQueries({ queryKey: authMeQueryKey });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logoutRequest,
    onSuccess: async () => {
      invalidateCsrfToken();
      await queryClient.invalidateQueries({ queryKey: authMeQueryKey });
    },
  });

  const value = useMemo<AuthContextValue>(() => {
    const user = meQuery.data ?? null;

    return {
      user,
      rol: user?.rol ?? null,
      isLoading: meQuery.isPending || meQuery.isFetching,
      login: loginMutation.mutateAsync,
      logout: logoutMutation.mutateAsync,
    };
  }, [loginMutation.mutateAsync, logoutMutation.mutateAsync, meQuery.data, meQuery.isFetching, meQuery.isPending]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuthContext() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }

  return context;
}