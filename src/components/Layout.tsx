import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, LogOut, User, ShieldCheck, BarChart3, GraduationCap } from 'lucide-react';
import LoginModal from './LoginModal';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, schoolAccount, studentInfo, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoginModalOpen, setIsLoginModalOpen] = React.useState(false);

  React.useEffect(() => {
    if (schoolAccount && !studentInfo) {
      setIsLoginModalOpen(true);
    }
  }, [schoolAccount, studentInfo]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 text-lg sm:text-xl font-bold tracking-tight text-blue-600 shrink-0">
            <img 
              src="https://i.postimg.cc/fRv07Dnb/logo-doan-thanh-nien-vector.jpg" 
              alt="Logo Đoàn" 
              className="w-10 h-10 object-contain"
              referrerPolicy="no-referrer"
            />
            <span className="hidden md:inline">EnglishQuiz10</span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-4 overflow-hidden">
            {(user || schoolAccount) && (
              <Link to="/statistics" className="flex items-center gap-1 text-xs sm:text-sm font-medium text-neutral-600 hover:text-blue-600 transition-colors shrink-0">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden md:inline">Thống kê</span>
              </Link>
            )}
            {(profile?.role === 'admin' || profile?.role === 'editor') && (
              <Link to="/admin" className="flex items-center gap-1 text-xs sm:text-sm font-medium text-neutral-600 hover:text-blue-600 transition-colors shrink-0">
                <ShieldCheck className="w-4 h-4" />
                <span className="hidden md:inline">Admin</span>
              </Link>
            )}
            {user || schoolAccount ? (
              <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                <div className="flex items-center gap-2 text-sm text-neutral-600 min-w-0">
                  {schoolAccount ? (
                    <div className="flex flex-col items-end min-w-0">
                      <div className="flex items-center gap-1.5 font-bold text-neutral-900 leading-tight">
                        <GraduationCap className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate max-w-[80px] sm:max-w-[150px]">
                          {studentInfo?.name || 'Học sinh'}
                        </span>
                      </div>
                      <span className="text-[9px] sm:text-[10px] text-neutral-400 font-medium uppercase tracking-wider truncate max-w-[100px] sm:max-w-[200px]">
                        Lớp {studentInfo?.class || '...'} • {schoolAccount.schoolName}
                      </span>
                    </div>
                  ) : (
                    <>
                      <User className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline truncate max-w-[100px]">{user?.displayName || user?.email}</span>
                    </>
                  )}
                </div>
                <button
                  onClick={() => { logout(); navigate('/'); }}
                  className="p-1.5 sm:p-2 text-neutral-500 hover:text-red-600 transition-colors shrink-0"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4 sm:w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="bg-blue-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors shrink-0"
              >
                Đăng nhập
              </button>
            )}
          </nav>
        </div>
      </header>

      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="bg-white border-t border-neutral-200 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-neutral-500 text-sm space-y-2">
          <p>&copy; {new Date().getFullYear()} English Quiz 10th Grade Prep. All rights reserved.</p>
          <p className="font-medium">by Đoàn TNCS Hồ Chí Minh xã Đông Tiền Hải</p>
          <p className="text-xs">For more information contact: <a href="tel:0984653497" className="text-blue-600 hover:underline">098 465.3497</a></p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
