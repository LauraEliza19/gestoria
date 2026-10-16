export const USER_ROLES = ['owner', 'admin', 'member'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type LoginResponse = {
  access_expires_at: string;
  expires_at: string;
};

export type Session = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  organization: Record<string, string | null>;
};

export type LoginCredentials = {
  email: string;
  password: string;
  remember?: boolean;
};