'use client'

/**
 * Re-exportación centralizada del hook y tipos de permisos desde PermissionsContext.
 * Esto asegura que toda la aplicación comparta una única instancia en memoria (Singleton),
 * con caché Stale-While-Revalidate y revalidación silenciosa en background sin parpadeos.
 */
export {
  usePermissions,
  PermissionsProvider,
} from '@/context/PermissionsContext'

export type {
  UserProfile,
  PermissionItem,
} from '@/context/PermissionsContext'
