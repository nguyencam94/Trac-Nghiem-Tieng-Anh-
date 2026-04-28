import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { ExamResult, OperationType, Question, ExamConfig } from '../types';
import { handleFirestoreError } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart3, Clock, Award, BookOpen, ChevronLeft, Calendar, Target, TrendingUp, Trash2, AlertCircle, X, ChevronRight, FileText, CheckCircle2 } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

const StatisticsPage: React.FC = () => {
  const { user, profile, schoolAccount } = useAuth();
  const navigate = useNavigate();
  const [results, setResults] = useState<ExamResult[]>([]);
  const [availableExams, setAvailableExams] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingExams, setLoadingExams] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchResults = async () => {
      const currentUserId = user?.uid || schoolAccount?.id;
      if (!currentUserId) return;
      try {
        const q = query(
          collection(db, 'exam_results'),
          where('userId', '==', currentUserId),
          orderBy('completedAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const fetchedResults = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExamResult));
        setResults(fetchedResults);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'exam_results');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [user, schoolAccount]);

  useEffect(() => {
    // Fetch available exams to compare completion
    const fetchExams = async () => {
      try {
        // Get hidden sources
        const configSnapshot = await getDocs(collection(db, 'exam_configs'));
        const hidden = new Set<string>();
        configSnapshot.docs.forEach(doc => {
          const cfg = doc.data() as ExamConfig;
          if (cfg.isHidden) {
            hidden.add(doc.id);
          }
        });

        // Get unique sources from questions
        const questionSnapshot = await getDocs(collection(db, 'questions'));
        const uniqueSources = new Set<string>();
        questionSnapshot.docs.forEach(doc => {
          const q = doc.data() as Question;
          if (q.source && q.source.trim() !== '' && q.source.toLowerCase() !== 'chung') {
            if (!hidden.has(q.source)) {
              uniqueSources.add(q.source);
            }
          }
        });
        setAvailableExams(Array.from(uniqueSources).sort());
      } catch (error) {
        console.error("Error fetching exams for stats:", error);
      } finally {
        setLoadingExams(false);
      }
    };

    fetchExams();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'exam_results', deleteId));
      setResults(prev => prev.filter(r => r.id !== deleteId));
      setDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `exam_results/${deleteId}`);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading || loadingExams) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-500 font-medium">Đang tổng hợp dữ liệu...</p>
        </div>
      </div>
    );
  }

  const averageScore = results.length > 0 
    ? results.reduce((acc, curr) => acc + curr.score, 0) / results.length 
    : 0;

  const highestScore = results.length > 0
    ? Math.max(...results.map(r => r.score))
    : 0;

  // Progress logic
  const completedSources = new Set(results.map(r => r.examSource));
  const completedCount = availableExams.filter(source => completedSources.has(source)).length;
  const uncompletedExams = availableExams.filter(source => !completedSources.has(source));
  const completionRate = availableExams.length > 0 ? (completedCount / availableExams.length) * 100 : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-neutral-900 tracking-tight">THỐNG KÊ KẾT QUẢ</h1>
          <p className="text-neutral-500 font-medium">Theo dõi tiến độ luyện tập của bạn</p>
        </div>
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-neutral-100 rounded-xl transition-colors text-neutral-500"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Progress Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="relative w-32 h-32 flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="64" cy="64" r="58"
                className="stroke-blue-400/30 fill-none"
                strokeWidth="12"
              />
              <motion.circle
                cx="64" cy="64" r="58"
                className="stroke-white fill-none"
                strokeWidth="12"
                strokeDasharray={364.4}
                initial={{ strokeDashoffset: 364.4 }}
                animate={{ strokeDashoffset: 364.4 - (364.4 * completionRate) / 100 }}
                transition={{ duration: 1, ease: "easeOut" }}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center font-black text-2xl">
              {Math.round(completionRate)}%
            </div>
          </div>
          
          <div className="flex-1 space-y-4 text-center md:text-left">
            <div>
              <h2 className="text-2xl font-black">TIẾN ĐỘ LUYỆN ĐỀ</h2>
              <p className="text-blue-100 font-medium">Bạn đã hoàn thành <span className="font-black text-white">{completedCount}</span> trên tổng số <span className="font-black text-white">{availableExams.length}</span> đề thi hiện có.</p>
            </div>
            {completionRate === 100 ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full backdrop-blur-md border border-white/30 text-sm font-bold">
                < Award className="w-4 h-4" /> Tuyệt vời! Bạn đã chinh phục toàn bộ đề thi.
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full backdrop-blur-md border border-white/30 text-sm font-bold">
                <Clock className="w-4 h-4" /> Cố gắng lên! Chỉ còn {uncompletedExams.length} đề nữa thôi.
              </div>
            )}
          </div>
          
          <Link 
            to="/exams" 
            className="px-8 py-4 bg-white text-blue-600 rounded-2xl font-black uppercase tracking-wider hover:bg-blue-50 transition-all shadow-lg active:scale-95"
          >
            Làm tiếp nhé
          </Link>
        </div>
      </motion.div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Số bài đã làm</p>
            <p className="text-3xl font-black text-neutral-900">{results.length}</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Điểm trung bình</p>
            <p className="text-3xl font-black text-neutral-900">{averageScore.toFixed(1)}</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Điểm cao nhất</p>
            <p className="text-3xl font-black text-neutral-900">{highestScore.toFixed(1)}</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Tỷ lệ chính xác</p>
            <p className="text-3xl font-black text-neutral-900">
              {results.length > 0 
                ? Math.round((results.reduce((acc, curr) => acc + (curr.correctCount / curr.totalQuestions), 0) / results.length) * 100) 
                : 0}%
            </p>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Uncompleted Exams List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-[2.5rem] border border-neutral-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <h2 className="text-lg font-black text-neutral-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                ĐỀ CHƯA LÀM
              </h2>
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black">{uncompletedExams.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[500px] p-4 divide-y divide-neutral-50">
              {uncompletedExams.length > 0 ? (
                uncompletedExams.map((exam) => (
                  <Link 
                    key={exam} 
                    to={`/exam/${encodeURIComponent(exam)}`}
                    className="flex items-center justify-between p-4 hover:bg-neutral-50 rounded-2xl group transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-neutral-100 text-neutral-400 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold text-neutral-700 group-hover:text-blue-600 transition-colors line-clamp-1">{exam}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-blue-400" />
                  </Link>
                ))
              ) : (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="text-neutral-500 font-medium text-sm">Tuyệt vời! Bạn đã hoàn thành tất cả đề thi.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-[2.5rem] border border-neutral-200 shadow-sm overflow-hidden h-full">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="text-xl font-black text-neutral-900 flex items-center gap-2">
                <Clock className="w-6 h-6 text-blue-600" />
                LỊCH SỬ LÀM BÀI
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50/50">
                    <th className="px-6 py-4 text-xs font-black text-neutral-500 uppercase tracking-widest">Thời gian</th>
                    {schoolAccount && (
                      <th className="px-6 py-4 text-xs font-black text-neutral-500 uppercase tracking-widest">Học sinh</th>
                    )}
                    <th className="px-6 py-4 text-xs font-black text-neutral-500 uppercase tracking-widest">Tên đề thi</th>
                    <th className="px-6 py-4 text-xs font-black text-neutral-500 uppercase tracking-widest">Số câu đúng</th>
                    <th className="px-6 py-4 text-xs font-black text-neutral-500 uppercase tracking-widest text-right">Điểm</th>
                    {profile?.role === 'admin' && (
                      <th className="px-6 py-4 text-xs font-black text-neutral-500 uppercase tracking-widest text-right"></th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {results.length > 0 ? (
                    results.map((result) => (
                      <tr key={result.id} className="hover:bg-neutral-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-neutral-600">
                            <Calendar className="w-4 h-4 text-neutral-400" />
                            <span className="text-xs font-bold">
                              {new Date(result.completedAt).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                        </td>
                        {schoolAccount && (
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-neutral-900">{result.studentName || 'N/A'}</span>
                              <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Lớp {result.studentClass || 'N/A'}</span>
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-neutral-900 line-clamp-1">{result.examSource}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-neutral-600">
                            {result.correctCount}/{result.totalQuestions}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`px-2 py-0.5 rounded-lg text-sm font-black ${
                            result.score >= 8 ? 'bg-emerald-100 text-emerald-700' :
                            result.score >= 5 ? 'bg-blue-100 text-blue-700' :
                            'bg-rose-100 text-rose-700'
                          }`}>
                            {result.score.toFixed(1)}
                          </span>
                        </td>
                        {profile?.role === 'admin' && (
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => setDeleteId(result.id)}
                              className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-neutral-400 font-medium">
                        Bạn chưa thực hiện bài thi nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteId(null)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm p-6 rounded-[2rem] shadow-2xl relative z-10 space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight">Xác nhận xóa</h3>
              </div>
              <p className="text-neutral-500 font-medium">Bạn có chắc chắn muốn xóa kết quả làm bài này không? Hành động này không thể hoàn tác.</p>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setDeleteId(null)}
                  className="flex-1 px-4 py-2.5 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition-all"
                >
                  Hủy
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 flex items-center justify-center gap-2"
                >
                  {isDeleting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Xóa ngay
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StatisticsPage;
