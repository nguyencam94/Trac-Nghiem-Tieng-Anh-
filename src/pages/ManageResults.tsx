import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, deleteDoc, doc, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { ExamResult, OperationType } from '../types';
import { handleFirestoreError } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  Clock, 
  Award, 
  BookOpen, 
  Search, 
  Calendar, 
  Target, 
  TrendingUp, 
  Trash2, 
  AlertCircle, 
  Filter,
  Download,
  Users,
  School
} from 'lucide-react';

const ManageResults: React.FC = () => {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [results, setResults] = useState<ExamResult[]>([]);
  const [allSchools, setAllSchools] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterSchool, setFilterSchool] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (profile?.role !== 'admin' && profile?.role !== 'editor') {
      navigate('/');
      return;
    }

    // Real-time results
    const qResults = query(
      collection(db, 'exam_results'),
      orderBy('completedAt', 'desc')
    );
    const unsubscribeResults = onSnapshot(qResults, (snapshot) => {
      setResults(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExamResult)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'exam_results_admin');
      setLoading(false);
    });

    // Real-time school accounts
    const qSchools = query(collection(db, 'school_accounts'));
    const unsubscribeSchools = onSnapshot(qSchools, (snapshot) => {
      const schoolNames = snapshot.docs.map(doc => (doc.data() as any).schoolName);
      setAllSchools(schoolNames);
    }, (error) => {
      console.error("Error fetching schools:", error);
    });

    return () => {
      unsubscribeResults();
      unsubscribeSchools();
    };
  }, [profile, authLoading, navigate]);

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

  const filteredResults = results.filter(r => {
    const matchesSearch = 
      (r.studentName?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (r.userEmail?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (r.examSource?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (r.schoolName?.toLowerCase() || "").includes(searchTerm.toLowerCase());
    
    const matchesClass = filterClass === "" || r.studentClass === filterClass;
    const matchesSchool = filterSchool === "" || 
      (r.schoolName?.trim().toLowerCase() === filterSchool.trim().toLowerCase());
    
    return matchesSearch && matchesClass && matchesSchool;
  });

  const classes = Array.from(new Set(results.map(r => r.studentClass).filter(Boolean))).sort();
  const schools = Array.from(new Set([
    ...allSchools,
    ...results.map(r => r.schoolName).filter(Boolean)
  ])).sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const stats = {
    total: results.length,
    avgScore: results.length > 0 ? results.reduce((acc, curr) => acc + curr.score, 0) / results.length : 0,
    highScore: results.length > 0 ? Math.max(...results.map(r => r.score)) : 0,
    uniqueStudents: new Set(results.map(r => r.userId)).size
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-100">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-neutral-900">Quản lý kết quả thi</h1>
            <p className="text-neutral-500 font-medium text-sm">Theo dõi toàn bộ lịch sử làm bài của học sinh</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Tổng lượt thi</p>
            <BookOpen className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-3xl font-black text-neutral-900">{stats.total}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Số học sinh</p>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-3xl font-black text-neutral-900">{stats.uniqueStudents}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Điểm trung bình</p>
            <Target className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-3xl font-black text-neutral-900">{stats.avgScore.toFixed(1)}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Điểm cao nhất</p>
            <Award className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-3xl font-black text-neutral-900">{stats.highScore.toFixed(1)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-[2rem] border border-neutral-200 shadow-sm flex flex-col items-stretch gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-2">Tìm kiếm nhanh</label>
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input 
              type="text"
              placeholder="Tìm theo tên học sinh, đề thi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-4 focus:ring-blue-50 focus:border-blue-400 outline-none transition-all font-bold text-neutral-700 text-sm"
            />
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-6 pt-4 border-t border-neutral-50">
          <div className="flex-1 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-2">Lọc theo trường</label>
            <div className="flex items-center gap-3 bg-neutral-50 border border-neutral-100 rounded-2xl px-4 py-1">
              <School className="w-5 h-5 text-neutral-400" />
              <select 
                value={filterSchool}
                onChange={(e) => setFilterSchool(e.target.value)}
                className="flex-1 py-3 outline-none bg-transparent font-bold text-neutral-700"
              >
                <option value="">Tất cả trường</option>
                {schools.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-2">Lọc theo lớp</label>
            <div className="flex items-center gap-3 bg-neutral-50 border border-neutral-100 rounded-2xl px-4 py-1">
              <Filter className="w-5 h-5 text-neutral-400" />
              <select 
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="flex-1 py-3 outline-none bg-transparent font-bold text-neutral-700"
              >
                <option value="">Tất cả lớp</option>
                {classes.map(c => (
                  <option key={c} value={c}>Lớp {c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[2.5rem] border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50">
                <th className="px-6 py-4 text-xs font-black text-neutral-500 uppercase tracking-widest">Học sinh</th>
                <th className="px-6 py-4 text-xs font-black text-neutral-500 uppercase tracking-widest">Tài khoản</th>
                <th className="px-6 py-4 text-xs font-black text-neutral-500 uppercase tracking-widest">Đề thi</th>
                <th className="px-6 py-4 text-xs font-black text-neutral-500 uppercase tracking-widest">Kết quả</th>
                <th className="px-6 py-4 text-xs font-black text-neutral-500 uppercase tracking-widest">Thời gian</th>
                <th className="px-6 py-4 text-xs font-black text-neutral-500 uppercase tracking-widest text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredResults.length > 0 ? (
                filteredResults.map((result) => (
                  <tr key={result.id} className="hover:bg-neutral-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-neutral-900">{result.studentName || 'N/A'}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-blue-600 font-black uppercase tracking-wider">Lớp {result.studentClass || 'N/A'}</span>
                          {result.schoolName && (
                            <>
                              <span className="text-[10px] text-neutral-300">•</span>
                              <span className="text-[10px] text-amber-600 font-black uppercase tracking-wider">{result.schoolName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-neutral-500 font-medium">{result.userEmail}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-neutral-700">{result.examSource}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                          result.score >= 8 ? 'bg-emerald-100 text-emerald-700' :
                          result.score >= 5 ? 'bg-blue-100 text-blue-700' :
                          'bg-rose-100 text-rose-700'
                        }`}>
                          {result.score.toFixed(1)}
                        </span>
                        <span className="text-[10px] font-bold text-neutral-400">
                          {result.correctCount}/{result.totalQuestions}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-neutral-500">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-xs">
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
                    <td className="px-6 py-4 text-right">
                      {profile?.role === 'admin' && (
                        <button 
                          onClick={() => setDeleteId(result.id)}
                          className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-neutral-400 font-medium">
                    Không tìm thấy kết quả nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Modal */}
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
              <p className="text-neutral-500 font-medium text-sm">Bạn có chắc chắn muốn xóa kết quả này? Hành động này không thể hoàn tác.</p>
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

export default ManageResults;
