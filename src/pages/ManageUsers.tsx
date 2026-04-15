import React, { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, OperationType } from '../types';
import { handleFirestoreError } from '../lib/utils';
import { motion } from 'motion/react';
import { Users, Shield, User as UserIcon, Check, X, Search, Mail } from 'lucide-react';

const ManageUsers: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, 'users'), orderBy('email'));
        const snapshot = await getDocs(q);
        const fetchedUsers = snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile));
        setUsers(fetchedUsers);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const updateUserRole = async (uid: string, newRole: 'admin' | 'editor' | 'user') => {
    setUpdatingId(uid);
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    } finally {
      setUpdatingId(null);
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
                        <UserIcon className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-neutral-900">{u.email}</span>
                        <span className="text-[10px] text-neutral-400 font-mono">{u.uid}</span>
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
                            onClick={() => updateUserRole(u.uid, 'user')}
                            disabled={updatingId === u.uid || u.role === 'user'}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                              u.role === 'user' ? 'bg-neutral-100 text-neutral-400' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                            }`}
                          >
                            User
                          </button>
                          <button 
                            onClick={() => updateUserRole(u.uid, 'editor')}
                            disabled={updatingId === u.uid || u.role === 'editor'}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                              u.role === 'editor' ? 'bg-amber-100 text-amber-700' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                            }`}
                          >
                            Editor
                          </button>
                          <button 
                            onClick={() => updateUserRole(u.uid, 'admin')}
                            disabled={updatingId === u.uid || u.role === 'admin'}
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
