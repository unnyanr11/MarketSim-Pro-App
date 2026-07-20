/**
 * usePermissions — single source of truth for what each role can do.
 * Import this everywhere instead of scattering `if (role === 'ADMIN')` checks.
 *
 * Usage:
 *   const { can } = usePermissions();
 *   if (can.reassignTasks) { ... }
 */
import { useAuth } from './useAuth';
import type { UserRole } from '../types';

export interface Permissions {
  // ── Task actions ─────────────────────────────────────────────────────
  viewOwnTasks: boolean;
  viewAllTasks: boolean;
  viewFloorTasks: boolean;
  updateTaskStatus: boolean;
  reassignTasks: boolean;
  createTasks: boolean;
  approveTasks: boolean;

  // ── Reporting ─────────────────────────────────────────────────────────
  reportMaintenance: boolean;
  viewMaintenanceReports: boolean;
  resolveMaintenance: boolean;

  // ── Floor / Staff visibility ──────────────────────────────────────────────
  viewFloorStaff: boolean;
  viewAllStaff: boolean;
  accessSupervisorDashboard: boolean;
  accessManagerDashboard: boolean;
  accessAdminPanel: boolean;

  // ── DND / access ─────────────────────────────────────────────────────────
  flagDND: boolean;
  overrideDND: boolean;

  // ── Profile & performance ─────────────────────────────────────────────────
  viewOwnPerformance: boolean;
  viewTeamPerformance: boolean;

  // ── Reassignment flows ───────────────────────────────────────────────────
  /** Can initiate supervisor reassignment of any task */
  supervisorReassign: boolean;
  /** Can send a help request (raise hand) */
  requestHelp: boolean;
  /** Can view + respond to help requests from staff */
  manageHelpRequests: boolean;
  /** Can propose a task swap with a peer */
  proposeSwap: boolean;
  /** Can view the swap audit log */
  viewSwapLog: boolean;

  // ── Navigation tabs shown ─────────────────────────────────────────────────
  showShiftTab: boolean;
  showSupervisorTab: boolean;
  showManagerTab: boolean;
}

const ROLE_PERMISSIONS: Record<UserRole, Permissions> = {
  HOUSEKEEPING: {
    viewOwnTasks:              true,
    viewAllTasks:              false,
    viewFloorTasks:            false,
    updateTaskStatus:          true,
    reassignTasks:             false,
    createTasks:               false,
    approveTasks:              false,
    reportMaintenance:         true,
    viewMaintenanceReports:    false,
    resolveMaintenance:        false,
    viewFloorStaff:            false,
    viewAllStaff:              false,
    accessSupervisorDashboard: false,
    accessManagerDashboard:    false,
    accessAdminPanel:          false,
    flagDND:                   true,
    overrideDND:               false,
    viewOwnPerformance:        true,
    viewTeamPerformance:       false,
    supervisorReassign:        false,
    requestHelp:               true,
    manageHelpRequests:        false,
    proposeSwap:               true,
    viewSwapLog:               false,
    showShiftTab:              true,
    showSupervisorTab:         false,
    showManagerTab:            false,
  },

  SUPERVISOR: {
    viewOwnTasks:              true,
    viewAllTasks:              false,
    viewFloorTasks:            true,
    updateTaskStatus:          true,
    reassignTasks:             true,
    createTasks:               false,
    approveTasks:              true,
    reportMaintenance:         true,
    viewMaintenanceReports:    true,
    resolveMaintenance:        false,
    viewFloorStaff:            true,
    viewAllStaff:              false,
    accessSupervisorDashboard: true,
    accessManagerDashboard:    false,
    accessAdminPanel:          false,
    flagDND:                   true,
    overrideDND:               true,
    viewOwnPerformance:        true,
    viewTeamPerformance:       true,
    supervisorReassign:        true,
    requestHelp:               false,
    manageHelpRequests:        true,
    proposeSwap:               false,
    viewSwapLog:               true,
    showShiftTab:              true,
    showSupervisorTab:         true,
    showManagerTab:            false,
  },

  MANAGER: {
    viewOwnTasks:              false,
    viewAllTasks:              true,
    viewFloorTasks:            true,
    updateTaskStatus:          true,
    reassignTasks:             true,
    createTasks:               true,
    approveTasks:              true,
    reportMaintenance:         true,
    viewMaintenanceReports:    true,
    resolveMaintenance:        true,
    viewFloorStaff:            true,
    viewAllStaff:              true,
    accessSupervisorDashboard: true,
    accessManagerDashboard:    true,
    accessAdminPanel:          false,
    flagDND:                   true,
    overrideDND:               true,
    viewOwnPerformance:        true,
    viewTeamPerformance:       true,
    supervisorReassign:        true,
    requestHelp:               false,
    manageHelpRequests:        true,
    proposeSwap:               false,
    viewSwapLog:               true,
    showShiftTab:              false,
    showSupervisorTab:         true,
    showManagerTab:            true,
  },

  ADMIN: {
    viewOwnTasks:              true,
    viewAllTasks:              true,
    viewFloorTasks:            true,
    updateTaskStatus:          true,
    reassignTasks:             true,
    createTasks:               true,
    approveTasks:              true,
    reportMaintenance:         true,
    viewMaintenanceReports:    true,
    resolveMaintenance:        true,
    viewFloorStaff:            true,
    viewAllStaff:              true,
    accessSupervisorDashboard: true,
    accessManagerDashboard:    true,
    accessAdminPanel:          true,
    flagDND:                   true,
    overrideDND:               true,
    viewOwnPerformance:        true,
    viewTeamPerformance:       true,
    supervisorReassign:        true,
    requestHelp:               false,
    manageHelpRequests:        true,
    proposeSwap:               false,
    viewSwapLog:               true,
    showShiftTab:              false,
    showSupervisorTab:         true,
    showManagerTab:            true,
  },

  RECEPTIONIST: {
    viewOwnTasks:              false,
    viewAllTasks:              false,
    viewFloorTasks:            false,
    updateTaskStatus:          false,
    reassignTasks:             false,
    createTasks:               false,
    approveTasks:              false,
    reportMaintenance:         true,
    viewMaintenanceReports:    false,
    resolveMaintenance:        false,
    viewFloorStaff:            false,
    viewAllStaff:              false,
    accessSupervisorDashboard: false,
    accessManagerDashboard:    false,
    accessAdminPanel:          false,
    flagDND:                   false,
    overrideDND:               false,
    viewOwnPerformance:        false,
    viewTeamPerformance:       false,
    supervisorReassign:        false,
    requestHelp:               false,
    manageHelpRequests:        false,
    proposeSwap:               false,
    viewSwapLog:               false,
    showShiftTab:              false,
    showSupervisorTab:         false,
    showManagerTab:            false,
  },
};

/** Returns the permissions object for the currently logged-in user. */
export function usePermissions() {
  const { user } = useAuth();
  const role: UserRole = (user?.role as UserRole) ?? 'HOUSEKEEPING';
  return {
    role,
    can: ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.HOUSEKEEPING,
    /** Convenience: is the user one of the given roles? */
    isOneOf: (...roles: UserRole[]) => roles.includes(role),
  };
}
