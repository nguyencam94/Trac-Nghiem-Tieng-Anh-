import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { GrammarTopic, OperationType, UserProfile, Category } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Edit2, X, ChevronLeft, BookOpen, AlertCircle, GripVertical, Table, ShieldAlert } from 'lucide-react';
import { handleFirestoreError } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { motion, AnimatePresence } from 'motion/react';

const ManageGrammar: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [topics, setTopics] = useState<GrammarTopic[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [authors, setAuthors] = useState<UserProfile[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    order: 0,
    categoryId: '',
  });

  const contentRef = React.useRef<HTMLTextAreaElement>(null);

  const insertAtCursor = (text: string) => {
    const textarea = contentRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = formData.content;

    const newValue = value.substring(0, start) + text + value.substring(end);
    setFormData({ ...formData, content: newValue });

    // Reset cursor position after state update
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Alt + Enter to insert <br><br>
    if (e.altKey && e.key === 'Enter') {
      e.preventDefault();
      insertAtCursor('<br><br>');
    }
    // Ctrl + B for bold
    if (e.ctrlKey && e.key === 'b') {
      e.preventDefault();
      const textarea = contentRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = formData.content.substring(start, end);
      insertAtCursor(`**${selectedText}**`);
    }
    // Alt + T for table template
    if (e.altKey && e.key === 't') {
      e.preventDefault();
      insertAtCursor('\n| Tiêu đề 1 | Tiêu đề 2 |\n| --- | --- |\n| Nội dung 1 | Nội dung 2 |\n');
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'grammar'), orderBy('order', 'asc'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTopics(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GrammarTopic)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'grammar');
    });

    const qUsers = query(collection(db, 'users'), orderBy('email'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setAuthors(snapshot.docs.map(doc => doc.data() as UserProfile));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const qCats = query(collection(db, 'categories'), orderBy('name', 'asc'));
    const unsubCats = onSnapshot(qCats, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });

    return () => {
      unsubscribe();
      unsubUsers();
      unsubCats();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content) return;

    try {
      if (editingId) {
        // Find the original topic to preserve createdAt
        const originalTopic = topics.find(t => t.id === editingId);
        await updateDoc(doc(db, 'grammar', editingId), {
          ...formData,
          createdAt: originalTopic?.createdAt || new Date().toISOString(),
        });
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'grammar'), {
          ...formData,
          createdAt: new Date().toISOString(),
          authorId: user?.uid
        });
      }

      setFormData({ title: '', content: '', order: topics.length + 1, categoryId: '' });
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, editingId ? `grammar/${editingId}` : 'grammar');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa chủ đề ngữ pháp này?')) {
      try {
        await deleteDoc(doc(db, 'grammar', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `grammar/${id}`);
      }
    }
  };

  const startEdit = (t: GrammarTopic) => {
    setFormData({
      title: t.title,
      content: t.content,
      order: t.order || 0,
      categoryId: t.categoryId || '',
    });
    setEditingId(t.id);
    setViewMode('edit');
    setIsModalOpen(true);
  };

  return (
    <div className="sm:space-y-8 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin')}
            className="p-2 hover:bg-neutral-100 rounded-xl transition-colors text-neutral-500"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black text-neutral-900">Quản lý ngữ pháp</h1>
            <p className="text-sm font-medium text-neutral-500">
              Tổng số: <span className="text-neutral-900 font-bold">{topics.length}</span> chủ đề
            </p>
          </div>
        </div>
        {profile?.role === 'admin' || profile?.role === 'editor' ? (
          <button
            onClick={() => { setIsModalOpen(true); setEditingId(null); setViewMode('edit'); setFormData({ title: '', content: '', order: topics.length + 1, categoryId: '' }); }}
            className="bg-blue-600 text-white px-4 sm:px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2 self-start text-sm sm:text-base"
          >
            <Plus className="w-4 h-4 sm:w-5 h-5" />
            Thêm chủ đề
          </button>
        ) : (
          <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl flex items-center gap-2 text-amber-700">
            <ShieldAlert className="w-4 h-4" />
            <span className="text-xs font-bold">Chỉ Admin mới có quyền soạn thảo ngữ pháp</span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
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
              className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-4 sm:p-6 border-b border-neutral-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${editingId ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {editingId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    </div>
                    <h2 className="text-xl font-black text-neutral-900">
                      {editingId ? 'Sửa chủ đề' : 'Thêm chủ đề mới'}
                    </h2>
                  </div>
                  
                  <div className="flex bg-neutral-100 p-1 rounded-xl">
                    <button
                      onClick={() => setViewMode('edit')}
                      className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'edit' ? 'bg-white text-blue-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
                    >
                      Soạn thảo
                    </button>
                    <button
                      onClick={() => setViewMode('preview')}
                      className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'preview' ? 'bg-white text-blue-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
                    >
                      Xem trước
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-neutral-100 rounded-xl transition-colors text-neutral-400"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {viewMode === 'edit' ? (
                  <form id="grammar-form" onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-xs sm:text-sm font-semibold text-neutral-600 uppercase tracking-wider">Tiêu đề chủ đề</label>
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base transition-all"
                          placeholder="Ví dụ: Thì Hiện tại đơn (Present Simple)..."
                          required
                        />
                      </div>
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-xs sm:text-sm font-semibold text-neutral-600 uppercase tracking-wider">Gắn với bài tập (Chủ đề)</label>
                        <select
                          value={formData.categoryId}
                          onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base transition-all"
                        >
                          <option value="">-- Không gắn --</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs sm:text-sm font-semibold text-neutral-600 uppercase tracking-wider">Thứ tự</label>
                        <input
                          type="number"
                          value={formData.order}
                          onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base transition-all"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs sm:text-sm font-semibold text-neutral-600 uppercase tracking-wider">Nội dung (Markdown)</label>
                      <textarea
                        ref={contentRef}
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        onKeyDown={handleKeyDown}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none h-64 sm:h-96 text-sm sm:text-base font-mono transition-all"
                        placeholder="Nhập nội dung ngữ pháp sử dụng Markdown..."
                        required
                      />
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                          <AlertCircle className="w-3 h-3" />
                          <span>Dùng <strong>**chữ in đậm**</strong> để in đậm, <u>&lt;u&gt;gạch chân&lt;/u&gt;</u> để gạch chân.</span>
                        </div>
                        <div className="flex gap-3">
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-tighter">
                            Alt + Enter: &lt;br&gt;&lt;br&gt;
                          </span>
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-tighter">
                            Alt + T: Table
                          </span>
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-tighter">
                            Ctrl + B: **Bold**
                          </span>
                        </div>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-8">
                    <div className="border-b border-neutral-100 pb-6">
                      <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-2">Xem trước tiêu đề</h3>
                      <h2 className="text-2xl sm:text-3xl font-black text-neutral-900">
                        {formData.title || 'Chưa có tiêu đề'}
                      </h2>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-4">Xem trước nội dung</h3>
                      <div className="bg-neutral-50 rounded-2xl p-6 sm:p-8 border border-neutral-100">
                        <div className="prose prose-neutral max-w-none prose-headings:font-black prose-headings:text-neutral-900 prose-p:text-neutral-700 prose-strong:text-neutral-950 prose-strong:font-black prose-table:border prose-table:border-neutral-200 prose-th:bg-neutral-100 prose-th:p-2 prose-td:p-2 prose-td:border prose-td:border-neutral-100 font-serif">
                          <ReactMarkdown
                            rehypePlugins={[rehypeRaw]}
                            remarkPlugins={[remarkGfm, remarkBreaks]}
                            components={{
                              strong: ({ ...props }) => <strong className="font-black text-neutral-950" {...props} />,
                              u: ({ ...props }) => <u className="decoration-blue-400 decoration-2 underline-offset-4" {...props} />
                            }}
                          >
                            {formData.content || '*Chưa có nội dung để hiển thị*'}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-6 border-t border-neutral-100 bg-neutral-50 flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl font-bold text-neutral-500 hover:bg-neutral-200 transition-all text-sm sm:text-base"
                >
                  Hủy bỏ
                </button>
                <button
                  form="grammar-form"
                  type="submit"
                  className={`px-8 py-2.5 rounded-xl font-bold text-white transition-all shadow-lg text-sm sm:text-base ${editingId ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-100' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'}`}
                >
                  {editingId ? 'Cập nhật chủ đề' : 'Lưu chủ đề'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-4">
            {topics.map((topic) => {
              const canEdit = profile?.role === 'admin' || (profile?.role === 'editor' && topic.authorId === user?.uid);
              return (
                <div key={topic.id} className="bg-white p-4 sm:p-6 rounded-2xl border border-neutral-200 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-neutral-50 rounded-xl flex items-center justify-center text-neutral-400 font-bold">
                      {topic.order}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-neutral-900">{topic.title}</h3>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-neutral-500">
                          Cập nhật: {new Date(topic.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                        {topic.authorId && (
                          <span className="text-[10px] font-bold text-neutral-400 bg-neutral-50 px-2 py-0.5 rounded-full border border-neutral-100">
                            {topic.authorId === user?.uid ? 'Của tôi' : (authors.find(a => a.uid === topic.authorId)?.email.split('@')[0] || 'Người khác')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {canEdit ? (
                      <>
                        <button onClick={() => startEdit(topic)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDelete(topic.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    ) : (
                      <div className="p-2 text-neutral-300 cursor-not-allowed" title="Bạn không có quyền sửa bài này">
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

        {topics.length === 0 && (
          <div className="text-center py-12 text-neutral-500 italic bg-white rounded-2xl border border-dashed border-neutral-200">
            Chưa có chủ đề ngữ pháp nào.
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageGrammar;
