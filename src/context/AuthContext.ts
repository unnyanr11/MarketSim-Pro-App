// Re-export from the canonical location so both import paths work:
//   import { useAuth } from '../hooks/useAuth'         ← existing screens
//   import { useAuth } from '../context/AuthContext'   ← ReportIssueScreen
export { AuthProvider, useAuth } from '../hooks/useAuth';
