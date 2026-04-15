
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box, Toolbar } from '@mui/material';

import { AuthProvider, useAuth } from './context/AuthContext';
import { BackendStatusProvider } from './context/BackendStatusContext';
import Navbar from './components/Navbar';
import OfflineBanner from './components/OfflineBanner';

import LoginPage     from './pages/LoginPage';
import RegisterPage  from './pages/RegisterPage';
import HomePage      from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import RetentionPage from './pages/RetentionPage';
import SimulationPage from './pages/SimulationPage';
import UserMgmtPage  from './pages/UserMgmtPage';

// ── Theme ─────────────────────────────────────────────────────────────────────
const theme = createTheme({
  palette: {
    primary:   { main: '#1a237e' },
    secondary: { main: '#f44336' },
    background:{ default: '#f4f6fa' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", sans-serif',
  },
  components: {
    MuiCard: {
      defaultProps: { elevation: 2 },
      styleOverrides: { root: { borderRadius: 12 } },
    },
    MuiButton: {
      styleOverrides: { root: { borderRadius: 8, textTransform: 'none', fontWeight: 600 } },
    },
  },
});

// ── Protected Route ───────────────────────────────────────────────────────────
function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// ── App Shell ─────────────────────────────────────────────────────────────────
function AppShell() {
  const { user } = useAuth();
  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      <Navbar />
      {user && <Toolbar />}  {/* spacer for fixed AppBar */}
      <OfflineBanner />
      <Box sx={{ pt: user ? 2 : 0 }}>
        <Routes>
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/dashboard"  element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/retention"  element={<ProtectedRoute><RetentionPage /></ProtectedRoute>} />
          <Route path="/simulation" element={<ProtectedRoute><SimulationPage /></ProtectedRoute>} />
          <Route path="/users"      element={<ProtectedRoute adminOnly><UserMgmtPage /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </Box>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BackendStatusProvider>
          <BrowserRouter>
            <AppShell />
          </BrowserRouter>
        </BackendStatusProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
