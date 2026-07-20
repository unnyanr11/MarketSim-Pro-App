/**
 * RoleGate — conditionally renders children based on the logged-in user's role.
 *
 * Usage:
 *   // Allow if user CAN do something (permission-based):
 *   <RoleGate permission="supervisorReassign">
 *     <ReassignButton />
 *   </RoleGate>
 *
 *   // Allow specific roles:
 *   <RoleGate roles={['MANAGER', 'ADMIN']}>
 *     <SwapLogPanel />
 *   </RoleGate>
 *
 *   // Show a fallback instead of nothing:
 *   <RoleGate permission="manageHelpRequests" fallback={<Text>No access</Text>}>
 *     <HelpRequestInbox />
 *   </RoleGate>
 */
import React from 'react';
import { usePermissions } from '../hooks/usePermissions';
import type { Permissions } from '../hooks/usePermissions';
import type { UserRole } from '../types';

interface RoleGateProps {
  /** Allow if the user has this permission set to true */
  permission?: keyof Permissions;
  /** Allow if the user's role is in this list */
  roles?: UserRole[];
  /** Rendered when access is denied (default: null) */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export default function RoleGate({
  permission,
  roles,
  fallback = null,
  children,
}: RoleGateProps) {
  const { can, role } = usePermissions();

  const allowed =
    (permission !== undefined && can[permission] === true) ||
    (roles !== undefined && roles.includes(role));

  return <>{allowed ? children : fallback}</>;
}
