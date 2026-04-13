import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, LogOut, User, ShieldCheck } from 'lucide-react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, login, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-blue-600">
            <BookOpen className="w-6 h-6" />
            <span>EnglishQuiz10</span>
          </Link>

          <nav className="flex items-center gap-4">
            {profile?.role === 'admin' && (
              <Link to="/admin" className="flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-blue-600 transition-colors">
                <ShieldCheck className="w-4 h-4" />
                Admin
              </Link>
            )}
            {user ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">{user.displayName || user.email}</span>
                </div>
                <button
                  onClick={() => { logout(); navigate('/'); }}
                  className="p-2 text-neutral-500 hover:text-red-600 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={login}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Login
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="bg-white border-t border-neutral-200 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-neutral-500 text-sm space-y-2">
          <p>&copy; {new Date().getFullYear()} English Quiz 10th Grade Prep. All rights reserved.</p>
          <p className="font-medium">by Cam Nguyen</p>
          <p className="text-xs">For more information contact: <a href="tel:0984653497" className="text-blue-600 hover:underline">098 465.3497</a></p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
