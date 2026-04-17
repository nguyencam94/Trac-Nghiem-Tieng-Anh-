import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { X, LogIn, School, User, Key, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login, loginWithSchool, setStudent, schoolAccount, studentInfo } = useAuth();
  const [loginMode, setLoginMode] = useState<'options' | 'school' | 'student'>('options');
  const [schoolForm, setSchoolForm] = useState({ username: '', password: '' });
  const [studentForm, setStudentForm] = useState({ name: '', class: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSchoolLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const success = await loginWithSchool(schoolForm.username, schoolForm.password);
    setLoading(false);
    if (success) {
      setLoginMode('student');
    } else {
      setError('Tài khoản hoặc mật khẩu không chính xác');
    }
  };

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.name.trim() || !studentForm.class.trim()) {
      setError('Vui lòng nhập đầy đủ họ tên và lớp');
      return;
    }
    setStudent(studentForm.name.trim(), studentForm.class.trim());
    onClose();
  };

  const handleGoogleLogin = async () => {
    await login();
    onClose();
  };

  // If already logged in to school but no student info, force student mode
  React.useEffect(() => {
    if (isOpen && schoolAccount && !studentInfo) {
      setLoginMode('student');
    } else if (isOpen && !schoolAccount) {
      setLoginMode('options');
    }
  }, [isOpen, schoolAccount, studentInfo]);

  const handleClose = () => {
    if (schoolAccount && !studentInfo) {
      setError('Vui lòng điền đầy đủ thông tin học sinh để tiếp tục');
      setLoginMode('student');
      return;
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden"
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-neutral-900">
                  {loginMode === 'options' ? 'Đăng nhập' : 
                   loginMode === 'school' ? 'Tài khoản trường' : 
                   'Thông tin học sinh'}
                </h2>
                <button onClick={handleClose} className="p-1.5 hover:bg-neutral-100 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-neutral-400" />
                </button>
              </div>

              {loginMode === 'options' && (
                <div className="space-y-3">
                  <button
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center gap-3 bg-white border-2 border-neutral-100 py-3 rounded-xl font-bold text-neutral-700 hover:bg-neutral-50 hover:border-blue-200 transition-all group"
                  >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                    Đăng nhập bằng Google
                  </button>

                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-neutral-100"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase">
                      <span className="bg-white px-3 text-neutral-400 font-bold tracking-widest">Hoặc</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setLoginMode('school')}
                    className="w-full flex items-center justify-center gap-3 bg-blue-600 py-3 rounded-xl font-bold text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                  >
                    <School className="w-5 h-5" />
                    Tài khoản trường học
                  </button>
                  
                  <p className="text-center text-[10px] text-neutral-400 font-medium px-4 leading-relaxed">
                    Sử dụng tài khoản do nhà trường cấp nếu bạn không có tài khoản Google cá nhân.
                  </p>
                </div>
              )}

              {loginMode === 'school' && (
                <form onSubmit={handleSchoolLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700 ml-1">Tên đăng nhập</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                      <input
                        required
                        type="text"
                        placeholder="Nhập tài khoản trường..."
                        value={schoolForm.username}
                        onChange={(e) => setSchoolForm({ ...schoolForm, username: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700 ml-1">Mật khẩu</label>
                    <div className="relative">
                      <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                      <input
                        required
                        type="password"
                        placeholder="Nhập mật khẩu..."
                        value={schoolForm.password}
                        onChange={(e) => setSchoolForm({ ...schoolForm, password: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all text-sm"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <p className="text-[10px] font-bold">{error}</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setLoginMode('options')}
                      className="flex-1 py-3 rounded-xl font-bold text-neutral-500 hover:bg-neutral-100 transition-all text-sm"
                    >
                      Quay lại
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-bold text-base hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? '...' : 'Tiếp tục'}
                      {!loading && <ArrowRight className="w-4 h-4" />}
                    </button>
                  </div>
                </form>
              )}

              {loginMode === 'student' && (
                <form onSubmit={handleStudentSubmit} className="space-y-4">
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex gap-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold text-emerald-800">Đăng nhập thành công!</p>
                      <p className="text-[9px] text-emerald-600">Nhập thông tin để lưu kết quả.</p>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <p className="text-[10px] font-bold">{error}</p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700 ml-1">Họ và tên học sinh</label>
                    <input
                      required
                      type="text"
                      placeholder="Ví dụ: Nguyễn Văn A"
                      value={studentForm.name}
                      onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700 ml-1">Lớp</label>
                    <input
                      required
                      type="text"
                      placeholder="Ví dụ: 10A1"
                      value={studentForm.class}
                      onChange={(e) => setStudentForm({ ...studentForm, class: e.target.value })}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-bold text-base hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 mt-2"
                  >
                    Bắt đầu luyện tập
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default LoginModal;
