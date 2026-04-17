import React, { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc, query, orderBy, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, OperationType } from '../types';
import { handleFirestoreError } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Shield, User as UserIcon, Check, X, Search, Mail, Plus, AlertCircle, Loader2 } from 'lucide-react';

const ManageUsers: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  // New user state
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<'admin' | 'editor' | 'user'>('editor');
  const [isAdding, setIsAdding] = useState(false);
  const [addMessage, setAddMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, 'users'), orderBy('email'));
        const snapshot = await getDocs(q);
        const fetchedUsers = snapshot.docs.map(doc => ({ ...doc.data(), internalId: doc.id } as UserProfile & { internalId: string }));
        setUsers(fetchedUsers);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const updateUserRole = async (uid: string, newRole: 'admin' | 'editor' | 'user', internalId?: string) => {
    const idToUse = internalId || uid;
    setUpdatingId(idToUse);
    try {
      await updateDoc(doc(db, 'users', idToUse), { role: newRole });
      setUsers(prev => prev.map(u => (u.uid === uid || (u as any).internalId === internalId) ? { ...u, role: newRole } : u));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${idToUse}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setIsAdding(true);
    setAddMessage(null);

    try {
      const emailLower = newEmail.trim().toLowerCase();
      
      // Check if user already exists
      const existingUser = users.find(u => u.email.toLowerCase() === emailLower);
      
      if (existingUser) {
        await updateUserRole(existingUser.uid, newRole, (existingUser as any).internalId);
        setAddMessage({ type: 'success', text: `Đã cập nhật quyền cho ${emailLower}` });
      } else {
        // Create a temporary document for the email
        const tempId = `email_${emailLower.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const newProfile: UserProfile = {
          uid: 'pending',
          email: emailLower,
          role: newRole
        };
        await setDoc(doc(db, 'users', tempId), newProfile);
        
        // Refresh list or add to state
        setUsers(prev => [...prev, { ...newProfile, internalId: tempId }].sort((a, b) => a.email.localeCompare(b.email)));
        setAddMessage({ type: 'success', text: `Đã chỉ định quyền ${newRole} cho ${emailLower}. Khi họ đăng nhập lần đầu, quyền này sẽ được áp dụng.` });
        setNewEmail("");
      }
    } catch (error) {
      setAddMessage({ type: 'error', text: 'Có lỗi xảy ra khi chỉ định quyền.' });
      handleFirestoreError(error, OperationType.CREATE, 'users');
    } finally {
      setIsAdding(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-neutral-900">Quản lý người dùng</h1>
            <p className="text-neutral-500 font-medium text-sm">Phân quyền Admin, Biên tập viên</p>
          </div>
        </div>
      </div>

      {/* Add User Form */}
      <div className="bg-white p-6 rounded-[2rem] border border-neutral-200 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
          <Plus className="w-5 h-5 text-indigo-600" />
          Chỉ định quyền mới bằng Email
        </h2>
        <form onSubmit={handleAddUser} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input 
              type="email"
              required
              placeholder="Nhập email cần cấp quyền..."
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
            />
          </div>
          <select 
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as any)}
            className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all font-bold text-neutral-700"
          >
            <option value="user">Người dùng</option>
            <option value="editor">Biên tập viên</option>
            <option value="admin">Quản trị viên</option>
          </select>
          <button 
            type="submit"
            disabled={isAdding}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            Cấp quyền
          </button>
        </form>
        
        <AnimatePresence>
          {addMessage && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${
                addMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              }`}
            >
              {addMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {addMessage.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-neutral-100">
        <h2 className="text-xl font-black text-neutral-900">Danh sách người dùng</h2>
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input 
            type="text"
            placeholder="Tìm theo email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all text-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50">
                <th className="px-6 py-4 text-xs font-black text-neutral-500 uppercase tracking-widest">Người dùng</th>
                <th className="px-6 py-4 text-xs font-black text-neutral-500 uppercase tracking-widest">Vai trò hiện tại</th>
                <th className="px-6 py-4 text-xs font-black text-neutral-500 uppercase tracking-widest text-right">Thay đổi quyền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredUsers.map((u) => (
                <tr key={u.uid} className="hover:bg-neutral-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500">
                        {u.uid === 'pending' ? <Shield className="w-5 h-5 text-indigo-400" /> : <UserIcon className="w-5 h-5" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-neutral-900">{u.email}</span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {u.uid === 'pending' ? <span className="text-indigo-600 font-black tracking-widest uppercase">ĐANG CHỜ ĐĂNG NHẬP</span> : u.uid}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      u.role === 'admin' ? 'bg-rose-100 text-rose-700' :
                      u.role === 'editor' ? 'bg-amber-100 text-amber-700' :
                      'bg-neutral-100 text-neutral-600'
                    }`}>
                      {u.role === 'admin' ? 'Quản trị viên' :
                       u.role === 'editor' ? 'Biên tập viên' : 'Người dùng'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {u.email !== 'nguyencam94@gmail.com' && (
                        <>
                          <button 
                            onClick={() => updateUserRole(u.uid, 'user', (u as any).internalId)}
                            disabled={updatingId === (u.uid === 'pending' ? (u as any).internalId : u.uid) || u.role === 'user'}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                              u.role === 'user' ? 'bg-neutral-100 text-neutral-400' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                            }`}
                          >
                            User
                          </button>
                          <button 
                            onClick={() => updateUserRole(u.uid, 'editor', (u as any).internalId)}
                            disabled={updatingId === (u.uid === 'pending' ? (u as any).internalId : u.uid) || u.role === 'editor'}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                              u.role === 'editor' ? 'bg-amber-100 text-amber-700' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                            }`}
                          >
                            Editor
                          </button>
                          <button 
                            onClick={() => updateUserRole(u.uid, 'admin', (u as any).internalId)}
                            disabled={updatingId === (u.uid === 'pending' ? (u as any).internalId : u.uid) || u.role === 'admin'}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                              u.role === 'admin' ? 'bg-rose-100 text-rose-700' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                            }`}
                          >
                            Admin
                          </button>
                        </>
                      )}
                      {u.email === 'nguyencam94@gmail.com' && (
                        <span className="text-[10px] font-bold text-neutral-400 italic">Root Admin</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ManageUsers;
