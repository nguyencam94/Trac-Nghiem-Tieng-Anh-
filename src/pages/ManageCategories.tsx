import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Category, OperationType } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Edit2, X, Check, ChevronLeft, ShieldAlert } from 'lucide-react';
import { handleFirestoreError } from '../lib/utils';

const ManageCategories: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'categories'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });
    return unsubscribe;
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await addDoc(collection(db, 'categories'), {
        name: newName,
        createdAt: new Date().toISOString(),
      });
      setNewName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'categories');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa chủ đề này?')) {
      try {
        await deleteDoc(doc(db, 'categories', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `categories/${id}`);
      }
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await updateDoc(doc(db, 'categories', id), { name: editName });
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `categories/${id}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto sm:space-y-8 space-y-4">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin')}
          className="p-2 hover:bg-neutral-100 rounded-xl transition-colors text-neutral-500"
          title="Quay lại"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">Quản lý chủ đề</h1>
      </div>

      {profile?.role === 'admin' ? (
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tên chủ đề mới..."
            className="flex-1 bg-white border border-neutral-200 rounded-xl px-3 sm:px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm sm:text-base"
          >
            <Plus className="w-4 h-4 sm:w-5 h-5" />
            Thêm
          </button>
        </form>
      ) : (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 text-amber-700">
          <ShieldAlert className="w-5 h-5" />
          <p className="text-sm font-medium">Chỉ Quản trị viên mới có quyền thêm hoặc chỉnh sửa chủ đề.</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold text-xs sm:text-sm text-neutral-600 uppercase tracking-wider">Tên chủ đề</th>
              {profile?.role === 'admin' && (
                <th className="px-3 sm:px-6 py-3 sm:py-4 font-semibold text-xs sm:text-sm text-neutral-600 uppercase tracking-wider text-right">Thao tác</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {categories.map((cat) => (
              <tr key={cat.id} className="hover:bg-neutral-50 transition-colors">
                <td className="px-3 sm:px-6 py-3 sm:py-4">
                  {editingId === cat.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      autoFocus
                    />
                  ) : (
                    <span className="font-medium text-sm sm:text-base">{cat.name}</span>
                  )}
                </td>
                {profile?.role === 'admin' && (
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                    <div className="flex justify-end gap-1 sm:gap-2">
                      {editingId === cat.id ? (
                        <>
                          <button onClick={() => handleUpdate(cat.id)} className="flex items-center gap-1 px-2 sm:px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-xs sm:text-sm font-medium">
                            <Check className="w-3.5 h-3.5 sm:w-4 h-4" />
                            <span className="hidden sm:inline">Lưu</span>
                          </button>
                          <button onClick={() => setEditingId(null)} className="flex items-center gap-1 px-2 sm:px-3 py-1.5 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 transition-colors text-xs sm:text-sm font-medium">
                            <X className="w-3.5 h-3.5 sm:w-4 h-4" />
                            <span className="hidden sm:inline">Hủy</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(cat)} className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-xs sm:text-sm font-medium">
                            <Edit2 className="w-3.5 h-3.5 sm:w-4 h-4" />
                            <span className="hidden sm:inline">Sửa</span>
                          </button>
                          <button onClick={() => handleDelete(cat.id)} className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs sm:text-sm font-medium">
                            <Trash2 className="w-3.5 h-3.5 sm:w-4 h-4" />
                            <span className="hidden sm:inline">Xóa</span>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ManageCategories;
