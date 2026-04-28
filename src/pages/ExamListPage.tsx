import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Question, OperationType, ExamConfig } from '../types';
import { ChevronRight, FileText, Clock, BookOpen, AlertCircle, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError } from '../lib/utils';

const ExamListPage: React.FC = () => {
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState("");

  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [examConfigs, setExamConfigs] = useState<Record<string, ExamConfig>>({});

  useEffect(() => {
    // Listen to configs
    const unsubscribeConfigs = onSnapshot(collection(db, 'exam_configs'), (snapshot) => {
      const configs: Record<string, ExamConfig> = {};
      snapshot.docs.forEach(doc => {
        configs[doc.id] = doc.data() as ExamConfig;
      });
      setExamConfigs(configs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'exam_configs');
    });

    // Listen to questions
    const q = query(collection(db, 'questions'));
    const unsubscribeQuestions = onSnapshot(q, (snapshot) => {
      const questions = snapshot.docs.map(doc => doc.data() as Question);
      setAllQuestions(questions);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'questions');
      setLoading(false);
    });

    return () => {
      unsubscribeConfigs();
      unsubscribeQuestions();
    };
  }, []);

  useEffect(() => {
    // Process sources and counts whenever questions or examConfigs change
    const counts: Record<string, number> = {};
    const uniqueSources = new Set<string>();
    
    allQuestions.forEach(q => {
      if (q.source && q.source.trim() !== '' && q.source.toLowerCase() !== 'chung') {
        const config = examConfigs[q.source];
        if (!config || !config.isHidden) {
          uniqueSources.add(q.source);
          counts[q.source] = (counts[q.source] || 0) + 1;
        }
      }
    });
    
    setSources(Array.from(uniqueSources).sort());
    setQuestionCounts(counts);
  }, [allQuestions, examConfigs]);

  const getDifficultyStyles = (difficulty?: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-emerald-50 border-emerald-100 hover:border-emerald-400 hover:shadow-emerald-200/40 text-emerald-700';
      case 'medium': return 'bg-orange-50 border-orange-100 hover:border-orange-400 hover:shadow-orange-200/40 text-orange-700';
      case 'hard': return 'bg-rose-50 border-rose-100 hover:border-rose-400 hover:shadow-rose-200/40 text-rose-700';
      default: return 'bg-white border-neutral-100 hover:border-rose-400 hover:shadow-rose-200/40 text-neutral-900';
    }
  };

  const getDifficultyBadge = (difficulty?: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-emerald-500 text-white';
      case 'medium': return 'bg-orange-500 text-white';
      case 'hard': return 'bg-rose-500 text-white';
      default: return 'bg-neutral-200 text-neutral-500';
    }
  };

  const getDifficultyLabel = (difficulty?: string) => {
    switch (difficulty) {
      case 'easy': return 'Dễ';
      case 'medium': return 'Vừa';
      case 'hard': return 'Khó';
      default: return 'Cơ bản';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-500 font-medium">Đang tải danh sách đề thi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12 space-y-12">
      <section className="text-center space-y-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-block px-4 py-1.5 bg-rose-50 text-rose-600 rounded-full text-sm font-bold tracking-wide uppercase mb-2"
        >
          Luyện đề thi thử
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl sm:text-5xl font-black tracking-tight text-neutral-900 leading-tight"
        >
          Danh sách <span className="text-rose-600">Đề thi thử</span>
        </motion.h1>
        {sources.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="flex items-center justify-center gap-2 text-neutral-400 font-bold uppercase tracking-widest text-xs"
          >
            <div className="h-px w-8 bg-neutral-200" />
            <span>
              {searchTerm 
                ? `Tìm thấy ${sources.filter(s => s.toLowerCase().includes(searchTerm.toLowerCase())).length}/${sources.length} đề thi`
                : `Tổng cộng ${sources.length} đề thi`
              }
            </span>
            <div className="h-px w-8 bg-neutral-200" />
          </motion.div>
        )}
        <motion.p 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-lg text-neutral-500 max-w-2xl mx-auto"
        >
          Tổng hợp các đề thi từ các nguồn uy tín, giúp bạn làm quen với cấu trúc và áp lực thời gian.
        </motion.p>
      </section>

      {sources.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="sticky top-16 sm:relative sm:top-0 z-20 -mx-4 px-4 py-4 sm:p-0 bg-neutral-50/80 backdrop-blur-md sm:bg-transparent"
        >
          <div className="max-w-xl mx-auto space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4 sm:hidden">
              Tìm kiếm đề thi
            </label>
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input 
                type="text"
                placeholder="Tìm đề thi (ví dụ: Đề 1, Chuyên Thái Bình...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-14 pr-6 py-3 bg-white border-2 border-neutral-200 sm:border-neutral-100 rounded-[1.5rem] shadow-xl shadow-neutral-200/50 sm:shadow-lg sm:shadow-neutral-100/50 outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-50 transition-all font-bold text-neutral-800 placeholder:text-neutral-400"
              />
            </div>
          </div>
        </motion.div>
      )}

      {sources.length === 0 ? (
        <div className="bg-white p-12 rounded-[2.5rem] border-2 border-dashed border-neutral-200 text-center space-y-4">
          <div className="w-20 h-20 bg-neutral-50 text-neutral-300 rounded-full flex items-center justify-center mx-auto">
            <FileText className="w-10 h-10" />
          </div>
          <p className="text-neutral-500 font-medium">Hiện chưa có đề thi nào được cập nhật.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {sources
              .filter(source => source.toLowerCase().includes(searchTerm.toLowerCase()))
              .map((source, index) => (
                <motion.div
                  key={source}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className={`group block p-6 sm:p-8 rounded-[2rem] border-2 shadow-xl shadow-neutral-100/50 hover:shadow-2xl transition-all duration-300 h-full ${getDifficultyStyles(examConfigs[source]?.difficulty)}`}>
                    <div className="flex items-start justify-between gap-4 h-full">
                      <div className="space-y-4 flex-1">
                        <div className="flex items-center justify-between">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 ${
                            examConfigs[source]?.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-600' :
                            examConfigs[source]?.difficulty === 'medium' ? 'bg-orange-100 text-orange-600' :
                            examConfigs[source]?.difficulty === 'hard' ? 'bg-rose-100 text-rose-600' :
                            'bg-rose-50 text-rose-600'
                          }`}>
                            <FileText className="w-7 h-7" />
                          </div>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getDifficultyBadge(examConfigs[source]?.difficulty)}`}>
                            {getDifficultyLabel(examConfigs[source]?.difficulty)}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-xl font-black transition-colors line-clamp-2">
                            {source}
                          </h3>
                          <div className="flex items-center gap-4 text-neutral-400 text-sm font-bold uppercase tracking-wider">
                            <span className="flex items-center gap-1.5">
                              <BookOpen className="w-4 h-4" />
                              {questionCounts[source]} câu hỏi
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-4 h-4" />
                              60 phút
                            </span>
                          </div>
                        </div>
                        
                        <div className="pt-4 flex flex-col sm:flex-row gap-2">
                          <Link
                            to={`/exam/${encodeURIComponent(source)}`}
                            className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded-xl text-center text-sm font-bold hover:bg-neutral-800 transition-colors shadow-lg shadow-neutral-200"
                          >
                            Làm bài tiêu chuẩn
                          </Link>
                          <Link
                            to={`/exam/${encodeURIComponent(source)}?hints=true`}
                            className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-xl text-center text-sm font-bold hover:bg-amber-600 transition-colors shadow-lg shadow-amber-200"
                          >
                            Làm bài kèm gợi ý
                          </Link>
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-white text-neutral-400 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-all shadow-sm shrink-0">
                        <ChevronRight className="w-6 h-6" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
          </AnimatePresence>
          
          {sources.filter(source => source.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
            <div className="col-span-1 md:col-span-2 py-12 text-center space-y-4">
              <div className="w-16 h-16 bg-neutral-50 text-neutral-300 rounded-full flex items-center justify-center mx-auto">
                <Search className="w-8 h-8" />
              </div>
              <p className="text-neutral-500 font-medium text-lg">Không tìm thấy đề thi nào khớp với "{searchTerm}"</p>
            </div>
          )}
        </div>
      )}

      <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 flex gap-4 max-w-3xl mx-auto">
        <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-amber-900">Lưu ý khi làm đề</p>
          <p className="text-sm text-amber-800 leading-relaxed">
            Mỗi đề thi có thời gian làm bài là 60 phút. Hệ thống sẽ tự động thu bài khi hết giờ. Hãy đảm bảo kết nối mạng ổn định trước khi bắt đầu.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ExamListPage;
