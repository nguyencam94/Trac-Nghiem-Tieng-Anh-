import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { ExamResult, OperationType } from '../types';
import { handleFirestoreError } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart3, Clock, Award, BookOpen, ChevronLeft, Calendar, Target, TrendingUp, Trash2, AlertCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const StatisticsPage: React.FC = () => {
  const { user, profile, schoolAccount, studentInfo } = useAuth();
  const navigate = useNavigate();
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
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
        
        // If it's a school account, we might want to filter by student name for the current session
        // but usually it's better to show all results for that school account so they can see their progress
        // or we can filter if studentInfo exists
        setResults(fetchedResults);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'exam_results');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [user, schoolAccount]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const averageScore = results.length > 0 
    ? results.reduce((acc, curr) => acc + curr.score, 0) / results.length 
    : 0;

  const highestScore = results.length > 0
    ? Math.max(...results.map(r => r.score))
    : 0;

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

      {/* History Table */}
      <div className="bg-white rounded-[2.5rem] border border-neutral-200 shadow-sm overflow-hidden">
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
                <th className="px-6 py-4 text-xs font-black text-neutral-500 uppercase tracking-widest">Điểm số</th>
                {profile?.role === 'admin' && (
                  <th className="px-6 py-4 text-xs font-black text-neutral-500 uppercase tracking-widest text-right">Thao tác</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {results.length > 0 ? (
                results.map((result) => (
                  <tr key={result.id} className="hover:bg-neutral-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-neutral-600">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm font-medium">
                          {new Date(result.completedAt).toLocaleString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
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
                      <span className="text-sm font-bold text-neutral-900">{result.examSource}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden max-w-[100px]">
                          <div 
                            className="h-full bg-blue-500" 
                            style={{ width: `${(result.correctCount / result.totalQuestions) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-neutral-600">
                          {result.correctCount}/{result.totalQuestions}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-black ${
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
                          title="Xóa kết quả này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={profile?.role === 'admin' ? 5 : 4} className="px-6 py-12 text-center text-neutral-400 font-medium">
                    Bạn chưa thực hiện bài thi nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
