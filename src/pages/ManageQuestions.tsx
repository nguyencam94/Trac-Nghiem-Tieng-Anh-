import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebase';
import { Category, Question, OperationType, UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Edit2, X, Check, Filter, ChevronLeft, BookOpen, AlertCircle, Sparkles, Loader2, Save, FileText, Image as ImageIcon, Upload, Search, Copy, Download, Info, User, Shield } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { handleFirestoreError } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { motion, AnimatePresence } from 'motion/react';
import { parseQuestionsFromText, parseQuestionsFromFile, ParsedQuestion, translateExplanation, generatePedagogicalHint } from '../services/aiService';

const QuestionFormModal = React.memo(({
    isOpen,
    onClose,
    editingId,
    initialData,
    categories,
    exerciseTypes,
    questions,
    userUid,
    authors,
    uniqueSources,
    onSuccess,
    onLastUsedSourceChange
  }: {
    isOpen: boolean;
    onClose: () => void;
    editingId: string | null;
    initialData: any;
    categories: Category[];
    exerciseTypes: any[];
    questions: Question[];
    userUid?: string;
    authors: UserProfile[];
    uniqueSources: string[];
    onSuccess: () => void;
    onLastUsedSourceChange: (source: string) => void;
  }) => {
    const [formData, setFormData] = useState(initialData);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
  
    useEffect(() => {
      setFormData(initialData);
    }, [initialData]);
  
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
  
      if (!auth.currentUser) {
        alert('Lỗi: Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn. Vui lòng tải lại trang.');
        return;
      }
  
      if (!file.type.startsWith('image/')) {
        alert('Vui lòng chọn tệp hình ảnh.');
        return;
      }
  
      if (file.size > 5 * 1024 * 1024) {
        alert('Kích thước ảnh quá lớn. Vui lòng chọn ảnh dưới 5MB.');
        return;
      }
  
      setIsUploading(true);
      setUploadProgress(0);
      
      try {
        const storageRef = ref(storage, `question-images/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);
  
        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
          }, 
          (error) => {
            console.error("Upload Error:", error);
            alert('Lỗi khi tải ảnh lên. Vui lòng thử lại.');
            setIsUploading(false);
          }, 
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            setFormData((prev: any) => ({ ...prev, imageUrl: downloadURL }));
            setIsUploading(false);
            setUploadProgress(100);
          }
        );
      } catch (error) {
        console.error("Storage Error:", error);
        alert('Lỗi hệ thống khi tải ảnh.');
        setIsUploading(false);
      }
    };
  
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      const isEssay = formData.exerciseType === 'essay';
      const hasText = !!formData.text;
      const hasCategory = !!formData.categoryId;
      const hasValidOptions = isEssay ? true : (formData.options.length === 4 && formData.options.every((o: string) => !!o));
      
      if (!hasText || !hasCategory || !hasValidOptions) {
        alert('Vui lòng điền đầy đủ thông tin (Câu hỏi, Danh mục và các Đáp án nếu là trắc nghiệm).');
        return;
      }
  
      try {
        if (editingId) {
          await updateDoc(doc(db, 'questions', editingId), formData);
          
          if (formData.passageId && formData.passageId.trim()) {
            const otherQuestionsInGroup = questions.filter(q => 
              q.passageId === formData.passageId && 
              q.id !== editingId
            );
            
            for (const otherQ of otherQuestionsInGroup) {
              if (otherQ.passage !== formData.passage) {
                await updateDoc(doc(db, 'questions', otherQ.id), { 
                  passage: formData.passage 
                });
              }
            }
          }
        } else {
          const samePassageQuestions = questions.filter(q => q.passageId === formData.passageId && q.categoryId === formData.categoryId);
          const maxOrder = samePassageQuestions.length > 0 
            ? Math.max(...samePassageQuestions.map(q => q.order || 0)) 
            : -1;
  
          await addDoc(collection(db, 'questions'), {
            ...formData,
            createdAt: new Date().toISOString(),
            order: maxOrder + 1,
            authorId: userUid
          });
        }

        if (formData.source) {
          localStorage.setItem('lastUsedSource', formData.source);
          onLastUsedSourceChange(formData.source);
        }

        onSuccess();
      } catch (error) {
        handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, editingId ? `questions/${editingId}` : 'questions');
      }
    };
  
    return (
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-4 sm:p-6 border-b border-neutral-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${editingId ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {editingId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </div>
                  <h2 className="text-xl font-black text-neutral-900">
                    {editingId ? 'Sửa câu hỏi' : 'Thêm câu hỏi mới'}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-neutral-100 rounded-xl transition-colors text-neutral-400"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
  
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                <form id="question-form" onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-semibold text-neutral-600 uppercase tracking-wider">Nội dung câu hỏi</label>
                    <textarea
                      value={formData.text}
                      onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          const target = e.target as HTMLTextAreaElement;
                          const start = target.selectionStart;
                          const end = target.selectionEnd;
                          const value = formData.text;
                          const newValue = value.substring(0, start) + "\n\n" + value.substring(end);
                          setFormData({ ...formData, text: newValue });
                          setTimeout(() => {
                            target.selectionStart = target.selectionEnd = start + 2;
                          }, 0);
                        }
                      }}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none h-24 sm:h-32 text-sm sm:text-base transition-all"
                      placeholder="Nhập câu hỏi..."
                      required
                    />
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                        <AlertCircle className="w-3 h-3" />
                        <span>Dùng <strong>**chữ in đậm**</strong> để in đậm, <u>&lt;u&gt;gạch chân&lt;/u&gt;</u> để gạch chân.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const textarea = document.querySelector('textarea[placeholder="Nhập câu hỏi..."]') as HTMLTextAreaElement;
                          if (textarea) {
                            const start = textarea.selectionStart;
                            const end = textarea.selectionEnd;
                            const value = formData.text;
                            const newValue = value.substring(0, start) + "\n\n" + value.substring(end);
                            setFormData({ ...formData, text: newValue });
                            textarea.focus();
                            setTimeout(() => {
                              textarea.selectionStart = textarea.selectionEnd = start + 2;
                            }, 0);
                          }
                        }}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg transition-all"
                      >
                        <Plus className="w-3 h-3" />
                        Ngắt đoạn (Ctrl + Enter)
                      </button>
                    </div>
                  </div>
  
                  {formData.exerciseType === 'essay' ? (
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs sm:text-sm font-semibold text-neutral-600 uppercase tracking-wider">Cụm từ gợi ý (Bắt đầu bằng...)</label>
                        <input
                          type="text"
                          value={formData.hint}
                          onChange={(e) => setFormData({ ...formData, hint: e.target.value })}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base transition-all"
                          placeholder="Ví dụ: I wish..., She said that..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs sm:text-sm font-semibold text-neutral-600 uppercase tracking-wider">Đáp án tự luận / Trả lời ngắn</label>
                        <textarea
                          value={formData.essayAnswer}
                          onChange={(e) => setFormData({ ...formData, essayAnswer: e.target.value })}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none h-24 text-sm sm:text-base transition-all"
                          placeholder="Nhập đáp án đúng hoặc hướng dẫn chấm..."
                          required
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      {formData.options.map((opt: string, idx: number) => (
                        <div key={idx} className="space-y-1.5">
                          <label className="text-xs sm:text-sm font-semibold text-neutral-600 uppercase tracking-wider">Đáp án {String.fromCharCode(65 + idx)}</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...formData.options];
                                newOpts[idx] = e.target.value;
                                setFormData({ ...formData, options: newOpts });
                              }}
                              className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base transition-all"
                              placeholder={`Đáp án ${String.fromCharCode(65 + idx)}...`}
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, correctOption: idx })}
                              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all text-xs font-bold uppercase tracking-wider ${formData.correctOption === idx ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-white border-neutral-200 text-neutral-400 hover:border-emerald-300 hover:text-emerald-600'}`}
                            >
                              <Check className="w-4 h-4" />
                              <span className="hidden xs:inline">{formData.correctOption === idx ? 'Đúng' : 'Chọn'}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
  
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-1.5">
                        <label className="text-xs sm:text-sm font-semibold text-neutral-600 uppercase tracking-wider">Chủ đề</label>
                        <select
                          value={formData.categoryId}
                          onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base transition-all"
                          required
                        >
                          <option value="">Chọn chủ đề...</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs sm:text-sm font-semibold text-neutral-600 uppercase tracking-wider">Loại bài tập</label>
                        <select
                          value={formData.exerciseType}
                          onChange={(e) => setFormData({ ...formData, exerciseType: e.target.value })}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base transition-all"
                          required
                        >
                          {exerciseTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                    </div>
  
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-1.5">
                        <label className="text-xs sm:text-sm font-semibold text-neutral-600 uppercase tracking-wider">Hình ảnh câu hỏi</label>
                        <div className="flex flex-col gap-3">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                              <input
                                type="text"
                                value={formData.imageUrl}
                                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base transition-all"
                                placeholder="Dán link ảnh (Direct Link)..."
                              />
                            </div>
                            <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-all font-bold text-sm ${isUploading ? 'bg-neutral-50 border-neutral-200 text-neutral-400' : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'}`}>
                              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                              <span>{isUploading ? `Đang tải (${Math.round(uploadProgress)}%)` : 'Tải ảnh lên'}</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={handleImageUpload}
                                disabled={isUploading}
                              />
                            </label>
                          </div>
                          {formData.imageUrl && (
                            <div className="relative w-fit group">
                              <img 
                                src={formData.imageUrl} 
                                alt="Preview" 
                                className="h-20 sm:h-24 w-auto rounded-xl border border-neutral-200 shadow-sm"
                                referrerPolicy="no-referrer"
                              />
                              <button
                                type="button"
                                onClick={() => setFormData({ ...formData, imageUrl: '' })}
                                className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm text-rose-600 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-50"
                                title="Xóa ảnh"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-1">Dán link ảnh hoặc tải ảnh trực tiếp từ máy tính của bạn.</p>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs sm:text-sm font-semibold text-neutral-600 uppercase tracking-wider">Giải thích (tùy chọn)</label>
                        <input
                          type="text"
                          value={formData.explanation}
                          onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base transition-all"
                          placeholder="Giải thích..."
                        />
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 mt-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>Dùng <strong>**chữ in đậm**</strong> để in đậm, <u>&lt;u&gt;gạch chân&lt;/u&gt;</u> để gạch chân.</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs sm:text-sm font-semibold text-neutral-600 uppercase tracking-wider">Gợi ý học tập (hiện khi bấm nút gợi ý)</label>
                        <textarea
                          value={formData.pedagogicalHint}
                          onChange={(e) => setFormData({ ...formData, pedagogicalHint: e.target.value })}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base transition-all h-20"
                          placeholder="Nhập gợi ý hướng dẫn học sinh suy nghĩ..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs sm:text-sm font-semibold text-neutral-600 uppercase tracking-wider">Nguồn đề thi (tùy chọn)</label>
                        <input
                          type="text"
                          value={formData.source}
                          onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base transition-all"
                          placeholder="Ví dụ: Đề thi THPT 2023, Đề minh họa..."
                        />
                        {uniqueSources.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {uniqueSources.map(source => (
                              <button
                                key={source}
                                type="button"
                                onClick={() => setFormData({ ...formData, source })}
                                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-blue-50 hover:text-blue-600 transition-all border border-neutral-200"
                              >
                                {source}
                              </button>
                            ))}
                          </div>
                        )}
                        <p className="text-[10px] text-neutral-400 mt-1">Để trống hoặc điền "chung" nếu không có nguồn cụ thể.</p>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs sm:text-sm font-semibold text-neutral-600 uppercase tracking-wider">Độ khó</label>
                        <div className="flex gap-2">
                          {[1, 2, 3].map((level) => (
                            <button
                              key={level}
                              type="button"
                              onClick={() => setFormData({ ...formData, difficulty: level })}
                              className={`flex-1 py-2.5 rounded-xl border font-bold text-sm transition-all ${
                                formData.difficulty === level
                                  ? level === 1 ? 'bg-emerald-600 border-emerald-200 text-white shadow-lg shadow-emerald-100' :
                                    level === 2 ? 'bg-amber-500 border-amber-200 text-white shadow-lg shadow-amber-100' :
                                    'bg-rose-600 border-rose-200 text-white shadow-lg shadow-rose-100'
                                  : 'bg-white border-neutral-200 text-neutral-400 hover:border-neutral-300'
                              }`}
                            >
                              {level === 1 ? 'Dễ' : level === 2 ? 'Vừa' : 'Khó'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
  
                  <div className="bg-neutral-50 p-4 sm:p-6 rounded-2xl border border-neutral-200 space-y-4">
                    <div className="flex items-center gap-2 text-neutral-900">
                      <BookOpen className="w-5 h-5" />
                      <h3 className="font-bold text-sm sm:text-base uppercase tracking-wider">Phần đọc hiểu (Tùy chọn)</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:gap-6">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Nội dung bài đọc</label>
                        <textarea
                          value={formData.passage}
                          onChange={(e) => setFormData({ ...formData, passage: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                              e.preventDefault();
                              const target = e.target as HTMLTextAreaElement;
                              const start = target.selectionStart;
                              const end = target.selectionEnd;
                              const value = formData.passage;
                              const newValue = value.substring(0, start) + "\n\n" + value.substring(end);
                              setFormData({ ...formData, passage: newValue });
                              setTimeout(() => {
                                target.selectionStart = target.selectionEnd = start + 2;
                              }, 0);
                            }
                          }}
                          className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none h-[500px] text-sm transition-all font-serif leading-relaxed"
                          placeholder="Dán nội dung bài đọc hiểu vào đây (3-4 đoạn văn)..."
                        />
                        <div className="flex items-center justify-between mt-1">
                          <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                            <AlertCircle className="w-3 h-3" />
                            <span>Dùng <strong>**chữ in đậm**</strong> để in đậm văn bản.</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const textarea = document.querySelector('textarea[placeholder*="Dán nội dung bài đọc"]') as HTMLTextAreaElement;
                              if (textarea) {
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                const value = formData.passage;
                                const newValue = value.substring(0, start) + "\n\n" + value.substring(end);
                                setFormData({ ...formData, passage: newValue });
                                textarea.focus();
                                setTimeout(() => {
                                  textarea.selectionStart = textarea.selectionEnd = start + 2;
                                }, 0);
                              }
                            }}
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg transition-all"
                          >
                            <Plus className="w-3 h-3" />
                            Ngắt đoạn (Ctrl + Enter)
                          </button>
                        </div>
                        {formData.passageId && questions.filter(q => q.passageId === formData.passageId && q.id !== editingId).length > 0 && (
                          <div className="flex items-center gap-1.5 text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-lg mt-2">
                            <Info className="w-3 h-3" />
                            <span>Lưu ý: Thay đổi nội dung bài đọc sẽ tự động cập nhật cho {questions.filter(q => q.passageId === formData.passageId && q.id !== editingId).length} câu hỏi khác có cùng mã "{formData.passageId}".</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Mã bài đọc</label>
                        <input
                          type="text"
                          value={formData.passageId}
                          onChange={(e) => setFormData({ ...formData, passageId: e.target.value })}
                          className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                          placeholder="Ví dụ: doc_hieu_01"
                        />
                        <p className="text-[10px] text-neutral-400 leading-tight mt-1">
                          Các câu hỏi có cùng mã này sẽ được hiển thị chung dưới một bài đọc.
                        </p>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
  
              <div className="p-4 sm:p-6 border-t border-neutral-100 bg-neutral-50 flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl font-bold text-neutral-500 hover:bg-neutral-200 transition-all text-sm sm:text-base"
                >
                  Hủy bỏ
                </button>
                <button
                  form="question-form"
                  type="submit"
                  className={`px-8 py-2.5 rounded-xl font-bold text-white transition-all shadow-lg text-sm sm:text-base ${editingId ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-100' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'}`}
                >
                  {editingId ? 'Cập nhật câu hỏi' : 'Lưu câu hỏi'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  });

const QuestionCard = React.memo(({ 
  q, 
  categories, 
  exerciseTypes, 
  isRecent, 
  canEdit, 
  onEdit, 
  onDelete, 
  userUid, 
  authors 
}: { 
  q: Question, 
  categories: Category[], 
  exerciseTypes: any[], 
  isRecent: boolean, 
  canEdit: boolean, 
  onEdit: (q: Question) => void, 
  onDelete: (id: string) => void, 
  userUid?: string, 
  authors: UserProfile[] 
}) => {
  return (
    <div 
      className={`bg-white p-4 sm:p-6 rounded-2xl border transition-all relative overflow-hidden ${
        isRecent 
          ? 'border-blue-400 shadow-md ring-1 ring-blue-100' 
          : 'border-neutral-200 shadow-sm hover:shadow-md'
      }`}
    >
      {isRecent && (
        <div className="absolute top-0 right-0">
          <div className="bg-blue-600 text-white text-[8px] sm:text-[10px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest shadow-sm flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" />
            Mới cập nhật
          </div>
        </div>
      )}
      <div className="flex justify-between items-start gap-3 mb-3 sm:mb-4">
      <div className="space-y-0.5 sm:space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] sm:text-xs font-bold text-blue-600 uppercase tracking-wider">
            {categories.find(c => c.id === q.categoryId)?.name || 'N/A'}
          </span>
          <span className="text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider">
            • {exerciseTypes.find(t => t.id === q.exerciseType)?.name || 'Chọn đáp án'}
          </span>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-tighter ${
            q.difficulty === 1 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
            q.difficulty === 2 ? 'bg-amber-50 text-amber-600 border-amber-200' :
            'bg-rose-50 text-rose-600 border-rose-200'
          }`}>
            {q.difficulty === 1 ? 'Dễ' : q.difficulty === 2 ? 'Vừa' : 'Khó'}
          </span>
          {(q.passage || q.passageId) && (
            <span className="flex items-center gap-1 bg-amber-50 text-amber-600 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-200 uppercase tracking-tighter">
              <BookOpen className="w-2.5 h-2.5" />
              {q.passageId ? `Đọc hiểu: ${q.passageId}` : 'Có bài đọc'}
            </span>
          )}
          {q.authorId && (
            <span className="flex items-center gap-1 bg-neutral-50 text-neutral-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-neutral-200 uppercase tracking-tighter">
              <User className="w-2.5 h-2.5" />
              {q.authorId === userUid ? 'Của tôi' : (authors.find(a => a.uid === q.authorId)?.email.split('@')[0] || 'Người khác')}
            </span>
          )}
        </div>
        <div className="text-base sm:text-lg font-medium text-neutral-900 leading-tight prose prose-neutral max-w-none font-serif">
          <ReactMarkdown
            rehypePlugins={[rehypeRaw]}
            remarkPlugins={[remarkGfm, remarkBreaks]}
            components={{
              strong: ({ ...props }) => <strong className="font-black text-neutral-950" {...props} />,
              u: ({ ...props }) => <u className="decoration-blue-400 decoration-2 underline-offset-4" {...props} />
            }}
          >
            {q.source && q.source.toLowerCase() !== 'chung' ? `**[${q.source}]** ${q.text}` : q.text}
          </ReactMarkdown>
        </div>
        {q.imageUrl && (
          <div className="mt-2 rounded-lg overflow-hidden border border-neutral-100 bg-neutral-50 w-fit max-w-[200px] group cursor-zoom-in">
            <img 
              src={q.imageUrl} 
              alt="Preview" 
              className="w-full h-auto object-contain max-h-[120px] transition-transform group-hover:scale-105"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'https://placehold.co/400x300?text=Lỗi+tải+ảnh';
              }}
            />
          </div>
        )}
      </div>
      <div className="flex gap-1 sm:gap-2 shrink-0">
        {canEdit && (
          <>
            <button onClick={() => onEdit(q)} className="p-1.5 sm:px-3 sm:py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium flex items-center gap-1">
              <Edit2 className="w-4 h-4" />
              <span className="hidden sm:inline">Sửa</span>
            </button>
            <button onClick={() => onDelete(q.id)} className="p-1.5 sm:px-3 sm:py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium flex items-center gap-1">
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Xóa</span>
            </button>
          </>
        )}
      </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
        {q.exerciseType === 'essay' ? (
          <div className="col-span-1 sm:col-span-2 p-3 bg-neutral-50 rounded-xl border border-neutral-100 italic text-sm text-neutral-600">
            <p className="font-bold text-neutral-900 not-italic mb-1">Câu trả lời:</p>
            {q.essayAnswer}
          </div>
        ) : (
          (q.options || []).map((option, idx) => (
            <div 
              key={idx}
              className={`flex items-start gap-3 p-3 rounded-xl border text-sm transition-all ${
                idx === q.correctOption 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-bold' 
                  : 'bg-neutral-50 border-neutral-100 text-neutral-600'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 font-black text-xs ${
                idx === q.correctOption 
                  ? 'bg-emerald-600 border-emerald-600 text-white' 
                  : 'bg-white border-neutral-300 text-neutral-400'
              }`}>
                {String.fromCharCode(65 + idx)}
              </div>
              <span className="flex-1 break-words">{option}</span>
              {idx === q.correctOption && <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
            </div>
          ))
        )}
      </div>

      {q.explanation && (
        <div className="mt-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100/50 space-y-2">
          <div className="flex items-center gap-1.5 text-blue-600">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-black uppercase tracking-widest">Giải thích chi tiết</span>
          </div>
          <div className="text-sm text-neutral-700 leading-relaxed font-sans prose prose-blue prose-sm max-w-none">
            <ReactMarkdown
              rehypePlugins={[rehypeRaw]}
              remarkPlugins={[remarkGfm, remarkBreaks]}
              components={{
                strong: ({ ...props }) => <strong className="font-bold text-neutral-900" {...props} />,
                u: ({ ...props }) => <u className="decoration-blue-300 underline-offset-2" {...props} />,
                code: ({ ...props }) => <code className="bg-blue-100 text-blue-700 px-1 rounded" {...props} />
              }}
            >
              {q.explanation}
            </ReactMarkdown>
          </div>
        </div>
      )}
      
      {q.hint && (
        <div className="mt-3 flex items-center gap-1.5 text-rose-600 bg-rose-50/50 p-2 rounded-lg border border-rose-100/50 w-fit">
          <Info className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold">Gợi ý: {q.hint}</span>
        </div>
      )}

      {q.pedagogicalHint && (
        <div className="mt-3 flex items-center gap-1.5 text-amber-600 bg-amber-50/50 p-2 rounded-lg border border-amber-100/50 w-fit">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Học tập: {q.pedagogicalHint}</span>
        </div>
      )}
    </div>
  );
});

const BulkAiImportModal = React.memo(({
    isOpen,
    onClose,
    categories,
    exerciseTypes,
    uniqueSources,
    userUid,
    onLastUsedSourceChange
  }: {
    isOpen: boolean;
    onClose: () => void;
    categories: Category[];
    exerciseTypes: any[];
    uniqueSources: string[];
    userUid?: string;
    onLastUsedSourceChange: (source: string) => void;
  }) => {
    const [bulkRawText, setBulkRawText] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
    const [bulkCategoryId, setBulkCategoryId] = useState('');
    const [bulkExerciseType, setBulkExerciseType] = useState('multiple_choice');
    const [bulkSource, setBulkSource] = useState('');
    const [isSavingBulk, setIsSavingBulk] = useState(false);

    const handleAiParse = async () => {
      if (!bulkRawText.trim()) return;
      setIsParsing(true);
      try {
        const result = await parseQuestionsFromText(bulkRawText);
        setParsedQuestions(result);
      } catch (error) {
        console.error("AI Parse Error:", error);
        alert("Có lỗi xảy ra khi phân tích văn bản. Vui lòng thử lại.");
      } finally {
        setIsParsing(false);
      }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsParsing(true);
      try {
        const result = await parseQuestionsFromFile(file);
        setParsedQuestions(result);
      } catch (error) {
        console.error("File Parse Error:", error);
        alert("Có lỗi xảy ra khi phân tích tệp. Vui lòng đảm bảo tệp hợp lệ (PDF, DOCX hoặc Ảnh).");
      } finally {
        setIsParsing(false);
        e.target.value = '';
      }
    };

    const handleSaveBulk = async () => {
      if (!bulkCategoryId || parsedQuestions.length === 0) return;
      setIsSavingBulk(true);
      try {
        let index = 0;
        for (const q of parsedQuestions) {
          const finalType = q.exerciseType === 'essay' ? 'essay' : (bulkExerciseType || q.exerciseType || 'multiple_choice');
          
          await addDoc(collection(db, 'questions'), {
            ...q,
            categoryId: bulkCategoryId,
            exerciseType: finalType,
            source: bulkSource || q.source || '',
            essayAnswer: q.essayAnswer || '',
            createdAt: new Date().toISOString(),
            order: index++,
            authorId: userUid
          });
        }
        
        if (bulkSource) {
          localStorage.setItem('lastUsedSource', bulkSource);
          onLastUsedSourceChange(bulkSource);
        }

        onClose();
        setBulkRawText('');
        setParsedQuestions([]);
        setBulkCategoryId('');
        setBulkSource('');
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'questions');
      } finally {
        setIsSavingBulk(false);
      }
    };

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        >
          <div className="p-4 sm:p-6 border-b border-neutral-100 flex items-center justify-between bg-white sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Sparkles className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-black text-neutral-900">Nhập câu hỏi nhanh bằng AI</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors text-neutral-400">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <input
                      type="file"
                      accept=".pdf,.docx,image/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      disabled={isParsing}
                    />
                    <div className="bg-blue-50 border-2 border-dashed border-blue-200 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-blue-600 hover:bg-blue-100 transition-all">
                      <Upload className="w-6 h-6" />
                      <span className="text-xs font-bold">Tải tệp lên</span>
                    </div>
                  </div>
                  <div className="bg-neutral-50 border-2 border-dashed border-neutral-200 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-neutral-400">
                    <div className="flex gap-2">
                      <FileText className="w-5 h-5" />
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-medium">PDF, DOCX, Ảnh</span>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-neutral-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-neutral-400 font-bold tracking-widest">Hoặc dán văn bản</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <textarea
                    value={bulkRawText}
                    onChange={(e) => setBulkRawText(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none h-[250px] text-sm transition-all font-mono"
                    placeholder="Dán nội dung câu hỏi từ PDF, Website hoặc tài liệu của bạn vào đây..."
                  />
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] text-neutral-400">AI sẽ tự động nhận diện câu hỏi, đáp án, giải thích và bài đọc hiểu.</p>
                  </div>
                </div>
                <button
                  onClick={handleAiParse}
                  disabled={isParsing || !bulkRawText.trim()}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Đang phân tích...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Phân tích bằng AI
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-xs sm:text-sm font-semibold text-neutral-600 uppercase tracking-wider">Kết quả phân tích ({parsedQuestions.length})</label>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase">Dạng bài:</label>
                        <select
                          value={bulkExerciseType}
                          onChange={(e) => setBulkExerciseType(e.target.value)}
                          className="bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1 text-xs font-bold text-emerald-600 outline-none"
                        >
                          {exerciseTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase">Chủ đề:</label>
                        <select
                          value={bulkCategoryId}
                          onChange={(e) => setBulkCategoryId(e.target.value)}
                          className="bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1 text-xs font-bold text-blue-600 outline-none"
                        >
                          <option value="">Chọn...</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase">Nguồn:</label>
                        <div className="relative group">
                          <input
                            type="text"
                            value={bulkSource}
                            onChange={(e) => setBulkSource(e.target.value)}
                            placeholder="Ví dụ: Đề THPT 2023"
                            className="bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1 text-xs font-bold text-neutral-600 outline-none w-32"
                          />
                          {uniqueSources.length > 0 && (
                            <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-neutral-200 rounded-xl shadow-xl p-2 z-20 hidden group-focus-within:block hover:block">
                              <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mb-1 px-1">Chọn nhanh:</p>
                              <div className="max-h-32 overflow-y-auto space-y-1">
                                {uniqueSources.map(source => (
                                  <button
                                    key={source}
                                    type="button"
                                    onClick={() => setBulkSource(source)}
                                    className="w-full text-left text-[10px] font-bold px-2 py-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-all"
                                  >
                                    {source}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-neutral-50 border border-neutral-200 rounded-2xl h-[400px] overflow-y-auto p-4 space-y-4">
                  {parsedQuestions.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-neutral-400 text-center space-y-2">
                      <AlertCircle className="w-8 h-8 opacity-20" />
                      <p className="text-sm italic">Chưa có dữ liệu. Hãy dán văn bản và nhấn "Phân tích".</p>
                    </div>
                  ) : (
                    parsedQuestions.map((q, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <span className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px] font-bold shrink-0">{idx + 1}</span>
                          <p className="text-sm font-medium text-neutral-900 flex-1">{q.text}</p>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border uppercase ${
                            q.difficulty === 1 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                            q.difficulty === 2 ? 'bg-amber-50 text-amber-600 border-amber-200' :
                            'bg-rose-50 text-rose-600 border-rose-200'
                          }`}>
                            {q.difficulty === 1 ? 'Dễ' : q.difficulty === 2 ? 'Vừa' : 'Khó'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {q.exerciseType === 'essay' ? (
                            <div className="col-span-2 space-y-2">
                              {q.hint && (
                                <div className="text-[10px] p-2 rounded border bg-blue-50 border-blue-200 text-blue-700 font-bold">
                                  Gợi ý: {q.hint}
                                </div>
                              )}
                              <div className="text-[10px] p-2 rounded border bg-emerald-50 border-emerald-200 text-emerald-700 font-bold">
                                Đáp án: {q.essayAnswer}
                              </div>
                            </div>
                          ) : (
                            q.options.map((opt, oIdx) => (
                              <div key={oIdx} className={`text-[10px] p-1.5 rounded border ${oIdx === q.correctOption ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold' : 'bg-neutral-50 border-neutral-100 text-neutral-500'}`}>
                                {String.fromCharCode(65 + oIdx)}. {opt}
                              </div>
                            ))
                          )}
                        </div>
                        {q.passageId && (
                          <div className="flex items-center gap-1 text-[8px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100">
                            <BookOpen className="w-3 h-3" />
                            Bài đọc: {q.passageId}
                          </div>
                        )}
                        {q.essayAnswer && (
                          <div className="text-[10px] p-2 bg-blue-50 border border-blue-100 rounded text-blue-700">
                            <span className="font-bold uppercase tracking-widest text-[8px] block mb-1">Đáp án tự luận:</span>
                            {q.essayAnswer}
                          </div>
                        )}
                        {q.pedagogicalHint && (
                          <div className="text-[10px] p-2 bg-amber-50 border border-amber-100 rounded text-amber-700">
                            <div className="flex items-center gap-1.5 font-bold uppercase tracking-widest text-[8px] mb-1">
                              <Sparkles className="w-3 h-3" />
                              Gợi ý học tập (AI):
                            </div>
                            {q.pedagogicalHint}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <button
                  onClick={handleSaveBulk}
                  disabled={isSavingBulk || parsedQuestions.length === 0 || !bulkCategoryId}
                  className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingBulk ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Đang lưu tất cả...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Lưu {parsedQuestions.length} câu hỏi
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  });

const ManageQuestions: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedExerciseType, setSelectedExerciseType] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedAuthor, setSelectedAuthor] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [authors, setAuthors] = useState<UserProfile[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Bulk Import state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Duplicate scan state
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<{ text: string, items: Question[] }[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslateConfirmOpen, setIsTranslateConfirmOpen] = useState(false);
  const [translationStatus, setTranslationStatus] = useState<{ total: number, current: number, success: number, isWaiting?: boolean } | null>(null);
  const [isHintGenerating, setIsHintGenerating] = useState(false);
  const [isHintConfirmOpen, setIsHintConfirmOpen] = useState(false);
  const [hintGenerationStatus, setHintGenerationStatus] = useState<{ total: number, current: number, success: number, isWaiting?: boolean } | null>(null);
  const [lastUsedSource, setLastUsedSource] = useState(() => localStorage.getItem('lastUsedSource') || '');

  // Form state
  const [formData, setFormData] = useState({
    text: '',
    options: ['', '', '', ''],
    correctOption: 0,
    categoryId: '',
    exerciseType: 'multiple_choice',
    explanation: '',
    imageUrl: '',
    difficulty: 1,
    source: '',
    passage: '',
    passageId: '',
    essayAnswer: '',
    hint: '',
    pedagogicalHint: '',
  });

  const exerciseTypes = useMemo(() => [
    { id: 'multiple_choice', name: 'Chọn đáp án đúng (A, B, C, D)' },
    { id: 'picture_guess', name: 'Nhìn tranh đoán đáp án' },
    { id: 'fill_blank', name: 'Điền vào chỗ trống' },
    { id: 'error_find', name: 'Tìm lỗi sai' },
    { id: 'synonym_antonym', name: 'Đồng nghĩa / Trái nghĩa' },
    { id: 'pronunciation_stress', name: 'Phát âm / Trọng âm' },
    { id: 'sentence_transformation', name: 'Viết lại câu' },
    { id: 'reorder', name: 'Sắp xếp hội thoại, đoạn văn' },
    { id: 'reading_comprehension', name: 'Đọc hiểu' },
    { id: 'essay', name: 'Tự luận / Trả lời ngắn' },
    { id: 'other', name: 'Khác' },
  ], []);

  useEffect(() => {
    if (authLoading) return;
    if (profile?.role !== 'admin' && profile?.role !== 'editor') {
      navigate('/admin');
      return;
    }

    const qCats = query(collection(db, 'categories'), orderBy('createdAt', 'desc'));
    const unsubCats = onSnapshot(qCats, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });

    const qQuests = query(collection(db, 'questions'), orderBy('createdAt', 'desc'));
    const unsubQuests = onSnapshot(qQuests, (snapshot) => {
      setQuestions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'questions');
    });

    const qUsers = query(collection(db, 'users'), orderBy('email'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setAuthors(snapshot.docs.map(doc => doc.data() as UserProfile));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubCats();
      unsubQuests();
      unsubUsers();
    };
  }, [profile, authLoading, navigate]);

  const handleTranslateAll = async () => {
    const questionsToTranslate = filteredQuestions.filter(q => q.explanation && q.explanation.trim());
    if (questionsToTranslate.length === 0) {
      setTranslationStatus({ total: 0, current: 0, success: 0 });
      return;
    }
    setIsTranslateConfirmOpen(true);
  };

  const startTranslation = async () => {
    const questionsToTranslate = filteredQuestions.filter(q => q.explanation && q.explanation.trim());
    setIsTranslateConfirmOpen(false);
    setIsTranslating(true);
    let successCount = 0;
    let currentCount = 0;
    
    setTranslationStatus({ total: questionsToTranslate.length, current: 0, success: 0, isWaiting: false });

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      for (const q of questionsToTranslate) {
        currentCount++;
        
        // Use a 7s delay to be much safer (Gemini free tier is ~15 RPM)
        if (currentCount > 1) {
          await sleep(7000); 
        }

        let retries = 0;
        const maxRetries = 2;
        let success = false;

        while (retries <= maxRetries && !success) {
          try {
            const translated = await translateExplanation(q.explanation!);
            if (translated && translated !== q.explanation) {
              await updateDoc(doc(db, 'questions', q.id), { 
                explanation: translated,
                text: q.text,
                options: q.options,
                correctOption: q.correctOption,
                categoryId: q.categoryId,
                createdAt: q.createdAt || new Date().toISOString(),
                difficulty: q.difficulty || 1,
                exerciseType: q.exerciseType || 'multiple_choice'
              });
              successCount++;
            }
            success = true;
          } catch (err: any) {
            const errorStr = (err.message || err.statusText || JSON.stringify(err) || "").toString();
            const isRateLimit = errorStr.includes('429') || 
                                errorStr.includes('RESOURCE_EXHAUSTED') || 
                                err.status === 429 || 
                                err.code === 429;

            if (isRateLimit) {
              console.error(`Rate limit hit on question ${q.id} (Attempt ${retries + 1}):`, err);
              setTranslationStatus(prev => prev ? { ...prev, isWaiting: true } : null);
              console.log("Waiting 60 seconds before retry...");
              await sleep(60000); // Wait 60s on rate limit
              setTranslationStatus(prev => prev ? { ...prev, isWaiting: false } : null);
              retries++;
            } else {
              console.error(`Failed to translate question ${q.id}:`, err);
              break;
            }
          }
        }
        
        setTranslationStatus({ 
          total: questionsToTranslate.length, 
          current: currentCount, 
          success: successCount,
          isWaiting: false
        });
      }
    } catch (error) {
      console.error("Translation Loop Error:", error);
    } finally {
      setIsTranslating(false);
      setTimeout(() => setTranslationStatus(null), 5000);
    }
  };

  const handleGenerateAllHints = async () => {
    const questionsWithoutHints = filteredQuestions.filter(q => !q.pedagogicalHint || !q.pedagogicalHint.trim());
    if (questionsWithoutHints.length === 0) {
      alert("Tất cả câu hỏi trong danh sách đang lọc đều đã có gợi ý hoặc không có câu hỏi nào để xử lý!");
      return;
    }
    setIsHintConfirmOpen(true);
  };

  const startHintGeneration = async () => {
    const questionsWithoutHints = filteredQuestions.filter(q => !q.pedagogicalHint || !q.pedagogicalHint.trim());
    setIsHintConfirmOpen(false);
    setIsHintGenerating(true);
    let successCount = 0;
    let currentCount = 0;
    
    setHintGenerationStatus({ total: questionsWithoutHints.length, current: 0, success: 0, isWaiting: false });

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      for (const q of questionsWithoutHints) {
        currentCount++;
        
        // Use 7s delay to be much safer
        if (currentCount > 1) {
          await sleep(7000); 
        }

        let retries = 0;
        const maxRetries = 2;
        let success = false;

        while (retries <= maxRetries && !success) {
          try {
            const hint = await generatePedagogicalHint(q.text, q.options, q.exerciseType);
            if (hint) {
              await updateDoc(doc(db, 'questions', q.id), { 
                pedagogicalHint: hint,
                text: q.text,
                options: q.options,
                correctOption: q.correctOption,
                categoryId: q.categoryId,
                createdAt: q.createdAt || new Date().toISOString(),
                difficulty: q.difficulty || 1,
                exerciseType: q.exerciseType || 'multiple_choice'
              });
              successCount++;
            }
            success = true;
          } catch (err: any) {
            const errorStr = (err.message || err.statusText || JSON.stringify(err) || "").toString();
            const isRateLimit = errorStr.includes('429') || 
                                errorStr.includes('RESOURCE_EXHAUSTED') || 
                                err.status === 429 || 
                                err.code === 429;

            if (isRateLimit) {
              console.error(`Rate limit hit on question ${q.id} (Attempt ${retries + 1}):`, err);
              setHintGenerationStatus(prev => prev ? { ...prev, isWaiting: true } : null);
              console.log("Waiting 60 seconds before retry...");
              await sleep(60000); // Wait 60s on rate limit
              setHintGenerationStatus(prev => prev ? { ...prev, isWaiting: false } : null);
              retries++;
            } else {
              console.error(`Failed to generate hint for question ${q.id}:`, err);
              break;
            }
          }
        }
        
        setHintGenerationStatus({ 
          total: questionsWithoutHints.length, 
          current: currentCount, 
          success: successCount,
          isWaiting: false
        });
      }
    } catch (error) {
      console.error("Hint Generation Loop Error:", error);
    } finally {
      setIsHintGenerating(false);
      setTimeout(() => setHintGenerationStatus(null), 5000);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'questions', id));
      setDeleteConfirmId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `questions/${id}`);
    }
  };

  const startEdit = (q: Question) => {
    setFormData({
      text: q.text,
      options: [...q.options],
      correctOption: q.correctOption,
      categoryId: q.categoryId,
      exerciseType: q.exerciseType || 'multiple_choice',
      explanation: q.explanation || '',
      imageUrl: q.imageUrl || '',
      difficulty: q.difficulty || 1,
      source: q.source || '',
      passage: q.passage || '',
      passageId: q.passageId || '',
      essayAnswer: q.essayAnswer || '',
      hint: q.hint || '',
      pedagogicalHint: q.pedagogicalHint || '',
    });
    setEditingId(q.id);
    setIsModalOpen(true);
  };

  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      const categoryMatch = selectedCategory === 'all' || q.categoryId === selectedCategory;
      const difficultyMatch = selectedDifficulty === 'all' || q.difficulty?.toString() === selectedDifficulty;
      const exerciseTypeMatch = selectedExerciseType === 'all' || q.exerciseType === selectedExerciseType;
      const sourceValue = q.source || 'Nguồn tổng hợp';
      const sourceMatch = selectedSource === 'all' || sourceValue === selectedSource;
      const authorMatch = selectedAuthor === 'all' || q.authorId === selectedAuthor;
      const searchMatch = !searchQuery || q.text.toLowerCase().includes(searchQuery.toLowerCase());
      return categoryMatch && difficultyMatch && exerciseTypeMatch && sourceMatch && authorMatch && searchMatch;
    });
  }, [questions, selectedCategory, selectedDifficulty, selectedExerciseType, selectedSource, selectedAuthor, searchQuery]);

  const recentIds = useMemo(() => questions.slice(0, 30).map(q => q.id), [questions]);

  const uniqueSources = useMemo(() => {
    const sources = Array.from(new Set(questions.map(q => q.source || 'Nguồn tổng hợp'))) as string[];
    if (lastUsedSource && sources.includes(lastUsedSource)) {
      return [lastUsedSource, ...sources.filter(s => s !== lastUsedSource)];
    }
    return sources;
  }, [questions, lastUsedSource]);

  const handleAiParse = () => {
    // Moved to BulkAiImportModal
  };

  const handleFileChange = () => {
    // Moved to BulkAiImportModal
  };

  const handleSaveBulk = () => {
    // Moved to BulkAiImportModal
  };

  const handleScanDuplicates = () => {
    setIsScanning(true);
    const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
    
    const groups: Record<string, Question[]> = {};
    questions.forEach(q => {
      const normalized = normalize(q.text);
      if (!groups[normalized]) groups[normalized] = [];
      groups[normalized].push(q);
    });

    const duplicates = Object.entries(groups)
      .filter(([_, items]) => items.length > 1)
      .map(([text, items]) => ({ text, items }));

    setDuplicateGroups(duplicates);
    setIsScanning(false);
    setIsDuplicateModalOpen(true);
  };

  const handleExportWord = async () => {
    if (filteredQuestions.length === 0) return;

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: "DANH SÁCH CÂU HỎI VÀ ĐÁP ÁN",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            ...filteredQuestions.flatMap((q, index) => {
              const category = categories.find(c => c.id === q.categoryId)?.name || "Chưa phân loại";
              const questionText = q.source && q.source.toLowerCase() !== 'chung' 
                ? `[${q.source}] ${q.text}` 
                : q.text;
              return [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Câu ${index + 1}: `,
                      bold: true,
                    }),
                    new TextRun({
                      text: questionText,
                    }),
                  ],
                  spacing: { before: 200, after: 100 },
                }),
                ...q.options.map((opt, optIdx) => (
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `${String.fromCharCode(65 + optIdx)}. `,
                        bold: true,
                      }),
                      new TextRun({
                        text: opt,
                      }),
                    ],
                    indent: { left: 720 },
                  })
                )),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Đáp án đúng: ",
                      bold: true,
                      color: "22c55e",
                    }),
                    new TextRun({
                      text: String.fromCharCode(65 + q.correctOption),
                      bold: true,
                      color: "22c55e",
                    }),
                  ],
                  spacing: { before: 100 },
                }),
                ...(q.explanation ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "Giải thích: ",
                        bold: true,
                        italics: true,
                      }),
                      new TextRun({
                        text: q.explanation,
                        italics: true,
                      }),
                    ],
                    spacing: { after: 200 },
                  })
                ] : [
                  new Paragraph({ spacing: { after: 200 } })
                ]),
              ];
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Danh_sach_cau_hoi_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.docx`);
  };

  return (
    <div className="sm:space-y-8 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin')}
            className="p-2 hover:bg-neutral-100 rounded-xl transition-colors text-neutral-500"
            title="Quay lại"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black text-neutral-900">Quản lý câu hỏi</h1>
            <p className="text-sm font-medium text-neutral-500">
              Tổng số: <span className="text-neutral-900 font-bold">{questions.length}</span> câu hỏi
              {(selectedCategory !== 'all' || selectedDifficulty !== 'all' || selectedExerciseType !== 'all' || selectedSource !== 'all') && (
                <>
                  {' '}| Đang lọc: <span className="text-blue-600 font-bold">{filteredQuestions.length}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportWord}
            disabled={filteredQuestions.length === 0}
            className="bg-white text-emerald-600 border-2 border-emerald-100 px-4 sm:px-6 py-2.5 rounded-xl font-bold hover:bg-emerald-50 transition-all flex items-center gap-2 text-sm sm:text-base disabled:opacity-50"
          >
            <Download className="w-4 h-4 sm:w-5 h-5" />
            Tải file Word
          </button>
          <button
            onClick={handleScanDuplicates}
            className="bg-white text-amber-600 border-2 border-amber-100 px-4 sm:px-6 py-2.5 rounded-xl font-bold hover:bg-amber-50 transition-all flex items-center gap-2 text-sm sm:text-base"
          >
            <Search className="w-4 h-4 sm:w-5 h-5" />
            Quét trùng lặp
          </button>
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="bg-white text-blue-600 border-2 border-blue-100 px-4 sm:px-6 py-2.5 rounded-xl font-bold hover:bg-blue-50 transition-all flex items-center gap-2 text-sm sm:text-base"
          >
            <Sparkles className="w-4 h-4 sm:w-5 h-5" />
            Nhập nhanh (AI)
          </button>
          <button
            onClick={handleTranslateAll}
            disabled={isTranslating || questions.length === 0}
            className="bg-white text-indigo-600 border-2 border-indigo-100 px-4 sm:px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-50 transition-all flex items-center gap-2 text-sm sm:text-base disabled:opacity-50"
          >
            {isTranslating ? <Loader2 className="w-4 h-4 sm:w-5 h-5 animate-spin" /> : <Sparkles className="w-4 h-4 sm:w-5 h-5" />}
            Dịch giải thích (AI)
          </button>
          <button
            onClick={handleGenerateAllHints}
            disabled={isHintGenerating || questions.length === 0}
            className="bg-white text-amber-600 border-2 border-amber-100 px-4 sm:px-6 py-2.5 rounded-xl font-bold hover:bg-amber-50 transition-all flex items-center gap-2 text-sm sm:text-base disabled:opacity-50"
          >
            {isHintGenerating ? <Loader2 className="w-4 h-4 sm:w-5 h-5 animate-spin" /> : <Sparkles className="w-4 h-4 sm:w-5 h-5" />}
            Tạo gợi ý (AI)
          </button>
          <button
            onClick={() => { setIsModalOpen(true); setEditingId(null); setFormData({ text: '', options: ['', '', '', ''], correctOption: 0, categoryId: '', exerciseType: 'multiple_choice', explanation: '', imageUrl: '', difficulty: 1, source: '', passage: '', passageId: '', essayAnswer: '', hint: '', pedagogicalHint: '' }); }}
            className="bg-blue-600 text-white px-4 sm:px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2 text-sm sm:text-base"
          >
            <Plus className="w-4 h-4 sm:w-5 h-5" />
            Thêm câu hỏi
          </button>
        </div>
      </div>

      <QuestionFormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingId(null); }}
        editingId={editingId}
        initialData={formData}
        categories={categories}
        exerciseTypes={exerciseTypes}
        questions={questions}
        userUid={user?.uid}
        authors={authors}
        uniqueSources={uniqueSources}
        onSuccess={() => {
          setIsModalOpen(false);
          setEditingId(null);
          setFormData({ text: '', options: ['', '', '', ''], correctOption: 0, categoryId: '', exerciseType: 'multiple_choice', explanation: '', imageUrl: '', difficulty: 1, source: '', passage: '', passageId: '', essayAnswer: '', hint: '', pedagogicalHint: '' });
        }}
        onLastUsedSourceChange={setLastUsedSource}
      />

      {/* Translation Confirmation Modal */}
      <AnimatePresence>
        {isTranslateConfirmOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-neutral-100 text-center space-y-6"
            >
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto">
                <Sparkles className="w-10 h-10 text-indigo-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-neutral-900">Dịch giải thích bằng AI?</h3>
                <p className="text-neutral-500 font-medium">
                  Hệ thống tìm thấy <span className="text-indigo-600 font-bold">{filteredQuestions.filter(q => q.explanation?.trim()).length}</span> câu hỏi đang được lọc có phần giải thích. Bạn có muốn dịch các câu hỏi này sang tiếng Việt không?
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsTranslateConfirmOpen(false)}
                  className="flex-1 px-6 py-3 rounded-2xl font-bold text-neutral-500 hover:bg-neutral-100 transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={startTranslation}
                  className="flex-1 px-6 py-3 rounded-2xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
                >
                  Bắt đầu dịch
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hint Generation Confirmation Modal */}
      <AnimatePresence>
        {isHintConfirmOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-neutral-100 text-center space-y-6"
            >
              <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
                <Sparkles className="w-10 h-10 text-amber-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-neutral-900">Tạo gợi ý học tập bằng AI?</h3>
                <p className="text-neutral-500 font-medium">
                  Hệ thống tìm thấy <span className="text-amber-600 font-bold">{filteredQuestions.filter(q => !q.pedagogicalHint || !q.pedagogicalHint.trim()).length}</span> câu hỏi trong danh sách lọc chưa có gợi ý học tập. Bạn có muốn sử dụng AI để tạo gợi ý cho các câu hỏi này không?
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsHintConfirmOpen(false)}
                  className="flex-1 px-6 py-3 rounded-2xl font-bold text-neutral-500 hover:bg-neutral-100 transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={startHintGeneration}
                  className="flex-1 px-6 py-3 rounded-2xl font-bold bg-amber-600 text-white hover:bg-amber-700 shadow-lg shadow-amber-200 transition-all"
                >
                  Bắt đầu tạo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Translation Progress Toast */}
      <AnimatePresence>
        {translationStatus && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 right-8 z-[100] bg-neutral-900 text-white p-6 rounded-2xl shadow-2xl border border-white/10 min-w-[300px]"
          >
            <div className="flex items-center gap-4">
              {isTranslating ? (
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
              ) : (
                <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
              <div className="flex-1 space-y-1">
                <p className="font-bold text-sm">
                  {translationStatus.isWaiting ? 'Đang tạm dừng chờ API (Rate Limit)...' : isTranslating ? 'Đang dịch giải thích...' : 'Đã hoàn thành dịch!'}
                </p>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-indigo-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${(translationStatus.current / translationStatus.total) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-neutral-400 font-medium">
                  Tiến độ: {translationStatus.current}/{translationStatus.total} câu hỏi ({translationStatus.success} thành công)
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hint Generation Progress Toast */}
      <AnimatePresence>
        {hintGenerationStatus && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 right-8 z-[110] bg-neutral-900 text-white p-6 rounded-2xl shadow-2xl border border-white/10 min-w-[300px]"
          >
            <div className="flex items-center gap-4">
              {isHintGenerating ? (
                <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
              ) : (
                <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
              <div className="flex-1 space-y-1">
                <p className="font-bold text-sm">
                  {hintGenerationStatus.isWaiting ? 'Đang tạm dừng chờ API (Rate Limit)...' : isHintGenerating ? 'Đang tạo gợi ý học tập...' : 'Đã hoàn thành tạo gợi ý!'}
                </p>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-amber-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${(hintGenerationStatus.current / hintGenerationStatus.total) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-neutral-400 font-medium">
                  Tiến độ: {hintGenerationStatus.current}/{hintGenerationStatus.total} câu hỏi ({hintGenerationStatus.success} thành công)
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BulkAiImportModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        categories={categories}
        exerciseTypes={exerciseTypes}
        uniqueSources={uniqueSources}
        userUid={user?.uid}
        onLastUsedSourceChange={setLastUsedSource}
      />

      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center space-y-6"
            >
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-neutral-900">Xác nhận xóa?</h3>
                <p className="text-neutral-500 text-sm">Hành động này không thể hoàn tác. Bạn có chắc chắn muốn xóa câu hỏi này?</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-bold text-neutral-500 hover:bg-neutral-100 transition-all"
                >
                  Hủy
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirmId)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                >
                  Xóa ngay
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDuplicateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDuplicateModalOpen(false)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-4 sm:p-6 border-b border-neutral-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                    <Copy className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-neutral-900">Kết quả quét trùng lặp</h2>
                    <p className="text-xs font-medium text-neutral-500">Tìm thấy {duplicateGroups.length} nhóm câu hỏi có nội dung tương tự</p>
                  </div>
                </div>
                <button onClick={() => setIsDuplicateModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors text-neutral-400">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8">
                {duplicateGroups.length === 0 ? (
                  <div className="py-20 text-center space-y-4">
                    <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                      <Check className="w-10 h-10" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold text-neutral-900">Tuyệt vời!</h3>
                      <p className="text-neutral-500">Không tìm thấy câu hỏi nào bị trùng lặp trong hệ thống.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {duplicateGroups.map((group, gIdx) => (
                      <div key={gIdx} className="space-y-3 p-4 rounded-2xl border border-amber-200 bg-amber-50/30">
                        <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
                          <AlertCircle className="w-4 h-4" />
                          Nhóm trùng lặp {gIdx + 1}
                        </div>
                        <div className="space-y-3">
                          {group.items.map((q) => (
                            <div key={q.id} className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm flex flex-col sm:flex-row justify-between gap-4">
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                                    {categories.find(c => c.id === q.categoryId)?.name || 'N/A'}
                                  </span>
                                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                    • {exerciseTypes.find(t => t.id === q.exerciseType)?.name || 'Chọn đáp án'}
                                  </span>
                                </div>
                                <p className="text-sm text-neutral-900 line-clamp-2">{q.text}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button 
                                  onClick={() => { startEdit(q); setIsDuplicateModalOpen(false); }}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Sửa"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => setDeleteConfirmId(q.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Xóa"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-6 border-t border-neutral-100 bg-neutral-50 flex justify-end">
                <button
                  onClick={() => setIsDuplicateModalOpen(false)}
                  className="px-6 py-2.5 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-col gap-4 bg-white p-3 sm:p-4 rounded-xl border border-neutral-200 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Tìm kiếm nội dung câu hỏi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3 sm:gap-6">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 sm:w-5 h-5 text-neutral-400" />
              <span className="text-xs sm:text-sm font-semibold text-neutral-600">Lọc:</span>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 sm:gap-8">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Chủ đề</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-xs sm:text-sm font-bold text-blue-600 cursor-pointer p-0"
              >
                <option value="all">Tất cả</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Loại bài tập</span>
              <select
                value={selectedExerciseType}
                onChange={(e) => setSelectedExerciseType(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-xs sm:text-sm font-bold text-blue-600 cursor-pointer p-0"
              >
                <option value="all">Tất cả</option>
                {exerciseTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Độ khó</span>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-xs sm:text-sm font-bold text-blue-600 cursor-pointer p-0"
              >
                <option value="all">Tất cả</option>
                <option value="1">Dễ</option>
                <option value="2">Vừa</option>
                <option value="3">Khó</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Nguồn</span>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-xs sm:text-sm font-bold text-blue-600 cursor-pointer p-0"
              >
                <option value="all">Tất cả</option>
                {uniqueSources.sort().map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Người soạn</span>
              <select
                value={selectedAuthor}
                onChange={(e) => setSelectedAuthor(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-xs sm:text-sm font-bold text-blue-600 cursor-pointer p-0"
              >
                <option value="all">Tất cả</option>
                {authors
                  .filter(a => a.role === 'admin' || a.role === 'editor')
                  .map(a => (
                    <option key={a.uid} value={a.uid}>
                      {a.email.split('@')[0]} ({a.role === 'admin' ? 'Admin' : 'BT Viên'})
                    </option>
                  ))
                }
              </select>
            </div>
          </div>
        </div>
      </div>

        <div className="space-y-3 sm:space-y-4">
          {filteredQuestions.map((q) => (
            <QuestionCard
              key={q.id}
              q={q}
              isRecent={recentIds.includes(q.id)}
              canEdit={profile?.role === 'admin' || (profile?.role === 'editor' && q.authorId === user?.uid)}
              userUid={user?.uid}
              categories={categories}
              exerciseTypes={exerciseTypes}
              authors={authors}
              onEdit={startEdit}
              onDelete={setDeleteConfirmId}
            />
          ))}
          {filteredQuestions.length === 0 && (
            <div className="text-center py-12 text-neutral-500 italic">
              Không tìm thấy câu hỏi nào.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageQuestions;
