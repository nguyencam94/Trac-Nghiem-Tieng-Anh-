import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { GrammarTopic, OperationType, Category } from '../types';
import { ChevronRight, BookOpen, ChevronLeft, Search, Settings2, Type, MoveVertical, X, Bold, Underline, Palette, Save, AlertCircle, Edit2 } from 'lucide-react';
import { handleFirestoreError } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';

const GrammarPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [topics, setTopics] = useState<GrammarTopic[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<GrammarTopic | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState(110); // 1.1rem as base
  const [lineHeight, setLineHeight] = useState(1.8);
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans'>('serif');
  const [themeColor, setThemeColor] = useState<string>('#171717'); // neutral-900
  const [editedContent, setEditedContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const themeOptions = [
    { name: 'Mặc định', color: '#171717', bg: 'bg-neutral-900' },
    { name: 'Xanh đậm', color: '#1e3a8a', bg: 'bg-blue-900' },
    { name: 'Nâu cổ điển', color: '#451a03', bg: 'bg-amber-950' },
    { name: 'Đỏ đậm', color: '#7f1d1d', bg: 'bg-red-900' },
  ];

  useEffect(() => {
    const q = query(collection(db, 'grammar'), orderBy('order', 'asc'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GrammarTopic));
      setTopics(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'grammar');
    });

    const qCats = query(collection(db, 'categories'), orderBy('name', 'asc'));
    const unsubscribeCats = onSnapshot(qCats, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });

    return () => {
      unsubscribe();
      unsubscribeCats();
    };
  }, []);

  const handleSelectTopic = (topic: GrammarTopic) => {
    setSelectedTopic(topic);
    setEditedContent(topic.content);
    setHasChanges(false);
  };

  const handleApplyFormat = (type: 'bold' | 'underline' | 'color', colorValue?: string) => {
    // If not in edit mode, editing from preview is limited and buggy
    // Better to focus the textarea and apply there
    if (!isEditMode) {
      setIsEditMode(true);
      setTimeout(() => applyToTextarea(type, colorValue), 50);
      return;
    }
    applyToTextarea(type, colorValue);
  };

  const applyToTextarea = (type: 'bold' | 'underline' | 'color', colorValue?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selection = editedContent.substring(start, end);
    
    if (!selection) return;

    let newText = selection;
    if (type === 'bold') newText = `**${selection}**`;
    else if (type === 'underline') newText = `<u>${selection}</u>`;
    else if (type === 'color' && colorValue) newText = `<span style="color:${colorValue}">${selection}</span>`;

    const nextContent = editedContent.substring(0, start) + newText + editedContent.substring(end);
    setEditedContent(nextContent);
    setHasChanges(true);

    // Maintain selection roughly
    setTimeout(() => {
      textarea.focus();
      const offset = newText.length - selection.length;
      textarea.setSelectionRange(start, end + offset);
    }, 0);
  };

  const handleSaveChanges = async () => {
    if (!selectedTopic || !hasChanges) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'grammar', selectedTopic.id), {
        content: editedContent
      });
      setHasChanges(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `grammar/${selectedTopic.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredTopics = topics.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-20 text-neutral-500 font-medium">Đang tải kiến thức ngữ pháp...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => selectedTopic ? setSelectedTopic(null) : navigate('/')}
            className="p-2 hover:bg-neutral-100 rounded-xl transition-colors text-neutral-500"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black text-neutral-900">
              {selectedTopic ? 'Chi tiết ngữ pháp' : 'Ôn tập ngữ pháp'}
            </h1>
            <p className="text-sm font-medium text-neutral-500">
              {selectedTopic ? selectedTopic.title : 'Tổng hợp các chủ đề ngữ pháp trọng tâm thi vào lớp 10'}
            </p>
          </div>
        </div>

        {!selectedTopic && (
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              placeholder="Tìm kiếm chủ đề ngữ pháp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 bg-white border-2 border-neutral-100 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-400 outline-none text-sm transition-all shadow-lg shadow-neutral-100/50"
            />
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {selectedTopic ? (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden"
          >
            <div className="p-6 sm:p-10 relative">
              <div className="flex justify-between items-center mb-8 border-b border-neutral-100 pb-6 gap-4">
                <h2 className="text-2xl sm:text-4xl font-black text-neutral-900">
                  {selectedTopic.title}
                </h2>
                <div className="flex items-center gap-3">
                  {(profile?.role === 'admin' || profile?.role === 'editor') && hasChanges && (
                    <button
                      onClick={handleSaveChanges}
                      disabled={isSaving}
                      className="p-3 bg-red-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                    >
                      <Save className="w-5 h-5" />
                      <span className="hidden sm:inline">{isSaving ? 'Đang lưu...' : 'Lưu lại'}</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`p-3 rounded-2xl transition-all duration-300 flex items-center gap-2 group ${showSettings ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                    title="Cài đặt đọc"
                  >
                    <Settings2 className={`w-5 h-5 ${showSettings ? 'animate-spin-slow' : 'group-hover:rotate-45 transition-transform duration-500'}`} />
                    <span className="hidden sm:inline font-bold text-sm">Cài đặt</span>
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mb-8"
                  >
                    <div className="p-6 bg-neutral-50 rounded-2xl border border-neutral-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-neutral-500 uppercase tracking-wider flex items-center gap-2">
                            <Type className="w-4 h-4" /> Kích cỡ chữ: {fontSize}%
                          </label>
                          <button onClick={() => setFontSize(110)} className="text-[10px] text-blue-600 font-bold hover:underline">Đặt lại</button>
                        </div>
                        <input
                          type="range"
                          min="80"
                          max="200"
                          step="5"
                          value={fontSize}
                          onChange={(e) => setFontSize(Number(e.target.value))}
                          className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-neutral-500 uppercase tracking-wider flex items-center gap-2">
                            <MoveVertical className="w-4 h-4" /> Khoảng cách dòng: {lineHeight}
                          </label>
                          <button onClick={() => setLineHeight(1.8)} className="text-[10px] text-blue-600 font-bold hover:underline">Đặt lại</button>
                        </div>
                        <input
                          type="range"
                          min="1.2"
                          max="3"
                          step="0.1"
                          value={lineHeight}
                          onChange={(e) => setLineHeight(Number(e.target.value))}
                          className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-black text-neutral-500 uppercase tracking-wider">Định dạng selection</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApplyFormat('bold')}
                            className="flex-1 py-2 bg-white rounded-xl border border-neutral-200 hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center"
                            title="In đậm"
                          >
                            <Bold className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleApplyFormat('underline')}
                            className="flex-1 py-2 bg-white rounded-xl border border-neutral-200 hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center underline"
                            title="Gạch chân"
                          >
                            <Underline className="w-4 h-4" />
                          </button>
                          <div className="relative group flex-1">
                            <button
                              className="w-full py-2 bg-white rounded-xl border border-neutral-200 hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center"
                              title="Đổi màu"
                            >
                              <Palette className="w-4 h-4" />
                            </button>
                            <div className="absolute top-full left-0 mt-2 bg-white border border-neutral-200 rounded-xl p-2 shadow-xl z-50 hidden group-hover:grid grid-cols-5 gap-1">
                              {['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'].map(c => (
                                <button key={c} onClick={() => handleApplyFormat('color', c)} className="w-6 h-6 rounded-full border border-neutral-100" style={{ backgroundColor: c }} />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-black text-neutral-500 uppercase tracking-wider">Màu chữ & Phông</label>
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-1.5">
                            {themeOptions.map((opt) => (
                              <button
                                key={opt.color}
                                onClick={() => setThemeColor(opt.color)}
                                className={`w-8 h-8 rounded-full ${opt.bg} border-2 transition-all ${themeColor === opt.color ? 'border-blue-500 scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                                title={opt.name}
                              />
                            ))}
                          </div>
                          <div className="flex gap-1 p-1 bg-neutral-100 rounded-xl">
                            <button
                              onClick={() => setFontFamily('serif')}
                              className={`flex-1 py-1 rounded-lg font-bold text-[10px] uppercase transition-all ${fontFamily === 'serif' ? 'bg-white text-blue-600 shadow-sm' : 'text-neutral-500'}`}
                            >
                              Serif
                            </button>
                            <button
                              onClick={() => setFontFamily('sans')}
                              className={`flex-1 py-1 rounded-lg font-bold text-[10px] uppercase transition-all ${fontFamily === 'sans' ? 'bg-white text-blue-600 shadow-sm' : 'text-neutral-500'}`}
                            >
                              Sans
                            </button>
                          </div>
                        </div>
                      </div>

                      {(profile?.role === 'admin' || profile?.role === 'editor') && (
                        <div className="space-y-3">
                          <label className="text-xs font-black text-neutral-500 uppercase tracking-wider">Chế độ sửa nhanh</label>
                          <button
                            onClick={() => setIsEditMode(!isEditMode)}
                            className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${isEditMode ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-blue-600 border-2 border-blue-100 hover:border-blue-400'}`}
                          >
                            <Edit2 className="w-4 h-4" />
                            {isEditMode ? 'Đang bật sửa' : 'Bật sửa source'}
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-col lg:flex-row gap-8">
                {isEditMode && (profile?.role === 'admin' || profile?.role === 'editor') && (
                  <div className="flex-1 space-y-4">
                    <div className="flex justify-between items-center text-xs font-bold text-neutral-400 uppercase tracking-widest">
                      <span>Nội dung Markdown</span>
                      <span className="text-blue-600">Hỗ trợ bôi đen để định dạng</span>
                    </div>
                    <textarea
                      ref={textareaRef}
                      value={editedContent}
                      onChange={(e) => { setEditedContent(e.target.value); setHasChanges(true); }}
                      className="w-full h-[500px] p-6 bg-neutral-900 text-neutral-100 font-mono text-sm rounded-2xl focus:ring-4 focus:ring-blue-500/20 outline-none resize-none leading-relaxed border border-neutral-800"
                      placeholder="Nhập nội dung bài viết..."
                    />
                  </div>
                )}

                <div 
                  className={`flex-1 prose prose-neutral max-w-none prose-headings:font-black prose-headings:text-neutral-900 prose-p:text-neutral-700 prose-strong:text-neutral-950 prose-strong:font-black prose-table:border prose-table:border-neutral-200 prose-th:bg-neutral-100 prose-th:p-2 prose-td:p-2 prose-td:border prose-td:border-neutral-100 prose-li:leading-relaxed`}
                  style={{ 
                    fontSize: `${fontSize}%`, 
                    lineHeight: lineHeight,
                    color: themeColor,
                    fontFamily: fontFamily === 'serif' ? 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' : 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                  }}
                >
                  <ReactMarkdown
                    rehypePlugins={[rehypeRaw]}
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={{
                      strong: ({ ...props }) => <strong className="font-black text-neutral-950" {...props} />,
                      u: ({ ...props }) => <u className="decoration-blue-400 decoration-2 underline-offset-4" {...props} />
                    }}
                  >
                    {editedContent}
                  </ReactMarkdown>
                </div>
              </div>
              <div className="mt-12 pt-8 border-t border-neutral-100 flex flex-col sm:flex-row justify-center gap-4">
                <button
                  onClick={() => setSelectedTopic(null)}
                  className="px-8 py-3 bg-neutral-100 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 order-2 sm:order-1"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Quay lại danh sách
                </button>
                
                {(() => {
                  const linkedCategory = categories.find(c => 
                    c.id === selectedTopic.categoryId || 
                    selectedTopic.title.toLowerCase().includes(c.name.toLowerCase()) ||
                    c.name.toLowerCase().includes(selectedTopic.title.toLowerCase())
                  );
                  
                  return (
                    <button
                      onClick={() => navigate(linkedCategory ? `/quiz/category/${linkedCategory.id}` : '/practice')}
                      className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100 order-1 sm:order-2"
                    >
                      <BookOpen className="w-5 h-5" />
                      Làm bài tập vận dụng {linkedCategory ? `(${linkedCategory.name})` : ''}
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  );
                })()}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6"
          >
            {filteredTopics.map((topic, idx) => (
              <button
                key={topic.id}
                onClick={() => handleSelectTopic(topic)}
                className="group bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm hover:shadow-xl hover:border-blue-400 hover:-translate-y-1 transition-all flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-neutral-50 rounded-2xl flex items-center justify-center text-neutral-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shrink-0">
                    <span className="text-xl font-black">{idx + 1}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-neutral-900 leading-tight group-hover:text-blue-700 transition-colors">
                      {topic.title}
                    </h3>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </button>
            ))}

            {filteredTopics.length === 0 && (
              <div className="col-span-full text-center py-20 bg-white rounded-3xl border border-dashed border-neutral-300">
                <p className="text-neutral-500 italic">Không tìm thấy chủ đề ngữ pháp nào phù hợp.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GrammarPage;
