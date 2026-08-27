import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { BetaDashboard } from './pages/beta/BetaDashboard';
import { BetaBookDetail } from './pages/beta/BetaBookDetail';
import { BetaReaderView } from './pages/beta/BetaReaderView';

export const AppContent: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/');

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Redirect root based on auth status and role
  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        if (currentPath !== '/login') {
          navigate('/login');
        }
      } else if (currentPath === '/' || currentPath === '/login') {
        if (user?.role === 'ADMIN') {
          navigate('/admin');
        } else {
          navigate('/beta');
        }
      }
    }
  }, [isLoading, isAuthenticated, user?.role, currentPath]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
        <div className="w-8 h-8 rounded-full border-2 border-lily-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  // 1. Login Page
  if (currentPath === '/login') {
    return (
      <LoginPage
        onLoginSuccess={(role) => {
          if (role === 'ADMIN') {
            navigate('/admin');
          } else {
            navigate('/beta');
          }
        }}
      />
    );
  }

  // 2. Admin Routes (/admin)
  if (currentPath.startsWith('/admin')) {
    return (
      <ProtectedRoute
        requiredRole="ADMIN"
        onRedirectToLogin={() => navigate('/login')}
        onNavigateHome={() => navigate('/beta')}
      >
        <AdminDashboard />
      </ProtectedRoute>
    );
  }

  // 3. Reader View: /beta/books/:bookId/read/:chapterIndex
  const readMatch = currentPath.match(/^\/beta\/books\/([^/]+)\/read\/(\d+)$/);
  if (readMatch) {
    const bookId = readMatch[1];
    const chapterIndex = parseInt(readMatch[2], 10) || 1;
    return (
      <ProtectedRoute
        onRedirectToLogin={() => navigate('/login')}
        onNavigateHome={() => navigate('/beta')}
      >
        <BetaReaderView
          bookId={bookId}
          initialChapterIndex={chapterIndex}
          onBackToBook={() => navigate(`/beta/books/${bookId}`)}
        />
      </ProtectedRoute>
    );
  }

  // 4. Book Detail: /beta/books/:bookId
  const bookDetailMatch = currentPath.match(/^\/beta\/books\/([^/]+)$/);
  if (bookDetailMatch) {
    const bookId = bookDetailMatch[1];
    return (
      <ProtectedRoute
        onRedirectToLogin={() => navigate('/login')}
        onNavigateHome={() => navigate('/beta')}
      >
        <BetaBookDetail
          bookId={bookId}
          onBack={() => navigate('/beta')}
          onOpenChapter={(chapterIndex) => navigate(`/beta/books/${bookId}/read/${chapterIndex}`)}
        />
      </ProtectedRoute>
    );
  }

  // 5. Beta Dashboard: /beta
  return (
    <ProtectedRoute
      onRedirectToLogin={() => navigate('/login')}
      onNavigateHome={() => navigate(user?.role === 'ADMIN' ? '/admin' : '/beta')}
    >
      <BetaDashboard onSelectBook={(bookId) => navigate(`/beta/books/${bookId}`)} />
    </ProtectedRoute>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};
