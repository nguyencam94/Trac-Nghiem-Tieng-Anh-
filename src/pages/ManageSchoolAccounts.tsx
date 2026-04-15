import React, { useEffect, useState } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { SchoolAccount, OperationType } from '../types';
import { handleFirestoreError } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { School, Plus, Trash2, X, Shield, Key, User, Search, AlertCircle } from 'lucide-react';

const ManageSchoolAccounts: React.FC = () => {
  const [accounts, setAccounts] = useState<SchoolAccount[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    username: '',
    password: '123456',
    schoolName: '',
  });

  useEffect(() => {
    const q = query(collection(db, 'school_accounts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolAccount)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'school_accounts');
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.password || !formData.schoolName) return;

    try {
      await addDoc(collection(db, 'school_accounts'), {
        ...formData,
        createdAt: new Date().toISOString(),
      });
      setIsModalOpen(false);
      setFormData({ username: '', password: '123456', schoolName: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'school_accounts');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tài khoản này?')) return;
    try {
      await deleteDoc(doc(db, 'school_accounts', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `school_accounts/${id}`);
    }
  };

  const filteredAccounts = accounts.filter(a => 
    a.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.schoolName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-600 rounded-2xl text-white shadow-lg shadow-emerald-100">
            <School className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-neutral-900">Tài khoản trường học</h1>
            <p className="text-neutral-500 font-medium text-sm">Cấp tài khoản cho học sinh đăng nhập</p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
        >
          <Plus className="w-5 h-5" />
          Tạo tài khoản mới
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
        <input 
          type="text"
          placeholder="Tìm theo tên trường hoặc tài khoản..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAccounts.map((account) => (
          <motion.div
            layout
            key={account.id}
            className="bg-white p-6 rounded-[2rem] border border-neutral-200 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-neutral-50 rounded-2xl text-emerald-600 group-hover:bg-emerald-50 transition-colors">
                <School className="w-6 h-6" />
              </div>
              <button
                onClick={() => handleDelete(account.id)}
                className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black text-neutral-900">{account.schoolName}</h3>
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mt-1">Tên trường</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-neutral-500">
                    <User className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Tài khoản</span>
                  </div>
                  <p className="text-sm font-black text-neutral-900">{account.username}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-neutral-500">
                    <Key className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Mật khẩu</span>
                  </div>
                  <p className="text-sm font-black text-neutral-900">{account.password}</p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
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
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                      <Plus className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-black text-neutral-900">Tạo tài khoản</h2>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors">
                    <X className="w-6 h-6 text-neutral-400" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-700 ml-1">Tên trường học</label>
                    <input
                      required
                      type="text"
                      placeholder="Ví dụ: THPT Phan Đình Phùng"
                      value={formData.schoolName}
                      onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                      className="w-full px-5 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-700 ml-1">Tên đăng nhập</label>
                    <input
                      required
                      type="text"
                      placeholder="Ví dụ: phandinhphung"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-5 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-700 ml-1">Mật khẩu</label>
                    <input
                      required
                      type="text"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-5 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all"
                    />
                  </div>

                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Tài khoản này sẽ được dùng chung cho học sinh của trường. Sau khi đăng nhập, học sinh sẽ được yêu cầu nhập tên và lớp để lưu kết quả.
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 mt-4"
                  >
                    Tạo tài khoản ngay
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ManageSchoolAccounts;
