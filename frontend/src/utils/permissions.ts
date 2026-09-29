export const USER_ROLES = ['owner', 'admin', 'member'] as const

export type UserRole = (typeof USER_ROLES)[number]

export const PERMISSIONS = [
  'organization:update',
  'customer:delete',
  'product:delete',
  'order:delete',
  'quote:delete',
  'fiscal:manage',
  'production:delete',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const permissionsByRole: Record<UserRole, ReadonlySet<Permission>> = {
  owner: new Set(PERMISSIONS),
  admin: new Set(PERMISSIONS),
  member: new Set(),
}

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole)
}

export function hasPermission(role: UserRole | null | undefined, permission: Permission): boolean {
  return role ? permissionsByRole[role].has(permission) : false
}
