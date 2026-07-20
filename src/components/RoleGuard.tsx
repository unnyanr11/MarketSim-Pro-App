/**
 * <RoleGuard roles={['ADMIN','MANAGER']}>
 *   <SensitiveComponent />
 * </RoleGuard>
 *
 * Renders children only when the logged-in user's role is in the allowed list.
 * Renders `fallback` (default: null) otherwise.
 */
import React from 'react';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../types';

interface Props {
  roles: UserRole[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function RoleGuard({ roles, fallback = null, children }: Props) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * <PermissionGate permission="reassignTasks">
 *   <ReassignButton />
 * </PermissionGate>
 *
 * Renders children only when usePermissions().can[permission] is true.
 * Uses the permissions table in usePermissions — no hardcoded role checks.
 */
import { usePermissions } from '../hooks/usePermissions';
import type { Permissions } from '../hooks/usePermissions';

interface GateProps {
  permission: keyof Permissions;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({ permission, fallback = null, children }: GateProps) {
  const { can } = usePermissions();
  if (!can[permission]) return <>{fallback}</>;
  return <>{children}</>;
}
