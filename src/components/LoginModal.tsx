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
            className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-neutral-900">
                  {loginMode === 'options' ? 'Đăng nhập' : 
                   loginMode === 'school' ? 'Tài khoản trường' : 
                   'Thông tin học sinh'}
                </h2>
                <button onClick={handleClose} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors">
                  <X className="w-6 h-6 text-neutral-400" />
                </button>
              </div>

              {loginMode === 'options' && (
                <div className="space-y-4">
                  <button
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center gap-3 bg-white border-2 border-neutral-100 py-4 rounded-2xl font-bold text-neutral-700 hover:bg-neutral-50 hover:border-blue-200 transition-all group"
                  >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
                    Đăng nhập bằng Google
                  </button>

                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-neutral-100"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-4 text-neutral-400 font-bold tracking-widest">Hoặc</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setLoginMode('school')}
                    className="w-full flex items-center justify-center gap-3 bg-blue-600 py-4 rounded-2xl font-bold text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                  >
                    <School className="w-6 h-6" />
                    Tài khoản trường học
                  </button>
                  
                  <p className="text-center text-xs text-neutral-400 font-medium px-4 leading-relaxed">
                    Sử dụng tài khoản do nhà trường cấp nếu bạn không có tài khoản Google cá nhân.
                  </p>
                </div>
              )}

              {loginMode === 'school' && (
                <form onSubmit={handleSchoolLogin} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-700 ml-1">Tên đăng nhập</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                      <input
                        required
                        type="text"
                        placeholder="Nhập tài khoản trường..."
                        value={schoolForm.username}
                        onChange={(e) => setSchoolForm({ ...schoolForm, username: e.target.value })}
                        className="w-full pl-12 pr-5 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-700 ml-1">Mật khẩu</label>
                    <div className="relative">
                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                      <input
                        required
                        type="password"
                        placeholder="Nhập mật khẩu..."
                        value={schoolForm.password}
                        onChange={(e) => setSchoolForm({ ...schoolForm, password: e.target.value })}
                        className="w-full pl-12 pr-5 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-2xl border border-red-100">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <p className="text-xs font-bold">{error}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setLoginMode('options')}
                      className="flex-1 py-4 rounded-2xl font-bold text-neutral-500 hover:bg-neutral-100 transition-all"
                    >
                      Quay lại
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? 'Đang kiểm tra...' : 'Tiếp tục'}
                      {!loading && <ArrowRight className="w-5 h-5" />}
                    </button>
                  </div>
                </form>
              )}

              {loginMode === 'student' && (
                <form onSubmit={handleStudentSubmit} className="space-y-6">
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex gap-3 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-emerald-800">Đăng nhập thành công!</p>
                      <p className="text-[10px] text-emerald-600 mt-0.5">Vui lòng nhập thông tin cá nhân để lưu kết quả làm bài.</p>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-2xl border border-red-100">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <p className="text-xs font-bold">{error}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-700 ml-1">Họ và tên học sinh</label>
                    <input
                      required
                      type="text"
                      placeholder="Ví dụ: Nguyễn Văn A"
                      value={studentForm.name}
                      onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                      className="w-full px-5 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-700 ml-1">Lớp</label>
                    <input
                      required
                      type="text"
                      placeholder="Ví dụ: 10A1"
                      value={studentForm.class}
                      onChange={(e) => setStudentForm({ ...studentForm, class: e.target.value })}
                      className="w-full px-5 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                  >
                    Bắt đầu ôn tập ngay
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
