import { memo } from 'react';
import { BrowserRouter, NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CitiesProvider } from './context/CitiesContext';
import { CompaniesProvider } from './context/CompaniesContext';
import { ErrorProvider } from './context/ErrorContext';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorToastContainer from './components/ErrorToast';
import SalaryAskPage from './pages/SalaryAskPage';
import SalaryComparisonPage from './pages/SalaryComparisonPage';
import OfferComparisonPage from './pages/OfferComparisonPage';
import CityExpensePage from './pages/CityExpensePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';

// Memoized so it only re-renders when auth state changes, not on every route change
const Nav = memo(function Nav() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <nav className="app-nav" aria-label="Main navigation">
      {isAuthenticated ? (
        <>
          <NavLink
            to="/"
            end
            className={({ isActive }) => `app-nav__link${isActive ? ' app-nav__link--active' : ''}`}
          >
            Salary Ask
          </NavLink>
          <NavLink
            to="/salary-comparison"
            className={({ isActive }) => `app-nav__link${isActive ? ' app-nav__link--active' : ''}`}
          >
            Quick Comparison
          </NavLink>
          <NavLink
            to="/offer-comparison"
            className={({ isActive }) => `app-nav__link${isActive ? ' app-nav__link--active' : ''}`}
          >
            AI Comparison
          </NavLink>
          <NavLink
            to="/city-expenses"
            className={({ isActive }) => `app-nav__link${isActive ? ' app-nav__link--active' : ''}`}
          >
            City Expenses
          </NavLink>
          <div className="app-nav__spacer" />
          <span className="app-nav__user">{user?.email}</span>
          <button className="app-nav__logout" onClick={logout} type="button">
            Sign out
          </button>
        </>
      ) : (
        <>
          <div className="app-nav__spacer" />
          <NavLink
            to="/login"
            className={({ isActive }) => `app-nav__link${isActive ? ' app-nav__link--active' : ''}`}
          >
            Sign in
          </NavLink>
          <NavLink
            to="/signup"
            className="app-nav__link app-nav__link--cta"
          >
            Create account
          </NavLink>
        </>
      )}
    </nav>
  );
});

// Single reusable guard — no anonymous wrapper per route
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public */}
      <Route path="/login"  element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/signup" element={isAuthenticated ? <Navigate to="/" replace /> : <SignupPage />} />

      {/* Protected */}
      <Route path="/"                   element={<PrivateRoute><SalaryAskPage /></PrivateRoute>} />
      <Route path="/salary-comparison"  element={<PrivateRoute><SalaryComparisonPage /></PrivateRoute>} />
      <Route path="/offer-comparison"   element={<PrivateRoute><OfferComparisonPage /></PrivateRoute>} />
      <Route path="/city-expenses"      element={<PrivateRoute><CityExpensePage /></PrivateRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorProvider>
      <AuthProvider>
        <BrowserRouter>
          <CitiesProvider>
            <CompaniesProvider>
              <Nav />
              {/* ErrorBoundary catches any render crash inside AppRoutes */}
              <ErrorBoundary>
                <AppRoutes />
              </ErrorBoundary>
            </CompaniesProvider>
          </CitiesProvider>
        </BrowserRouter>
      </AuthProvider>

      {/*
       * ErrorToastContainer lives OUTSIDE BrowserRouter so it:
       * - survives route changes
       * - persists during navigation-triggered unmounts
       */}
      <ErrorToastContainer />
    </ErrorProvider>
  );
}
