import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, query } from 'firebase/firestore';
import { db } from '../firebase';
import { Question, ExamConfig, OperationType } from '../types';
import { handleFirestoreError } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Eye, EyeOff, Search, Loader2, AlertCircle, ChevronLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ManageExams: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [sources, setSources] = useState<string[]>([]);
  const [configs, setConfigs] = useState<Record<string, ExamConfig>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      navigate('/admin');
      return;
    }

    // Fetch all questions to get unique sources
    const qQuestions = query(collection(db, 'questions'));
    const unsubscribeQuestions = onSnapshot(qQuestions, (snapshot) => {
      const uniqueSources = new Set<string>();
      snapshot.docs.forEach(doc => {
        const data = doc.data() as Question;
        if (data.source && data.source.trim() !== '' && data.source.toLowerCase() !== 'chung') {
          uniqueSources.add(data.source);
        }
      });
      setSources(Array.from(uniqueSources).sort());
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'questions');
    });

    // Fetch exam configs
    const qConfigs = query(collection(db, 'exam_configs'));
    const unsubscribeConfigs = onSnapshot(qConfigs, (snapshot) => {
      const fetchedConfigs: Record<string, ExamConfig> = {};
      snapshot.docs.forEach(doc => {
        fetchedConfigs[doc.id] = doc.data() as ExamConfig;
      });
      setConfigs(fetchedConfigs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'exam_configs');
    });

    return () => {
      unsubscribeQuestions();
      unsubscribeConfigs();
    };
  }, []);

  const toggleVisibility = async (source: string) => {
    setUpdatingId(source);
    const currentConfig = configs[source];
    const isHidden = currentConfig ? currentConfig.isHidden : false;
    
    try {
      await setDoc(doc(db, 'exam_configs', source), {
        id: source,
        isHidden: !isHidden,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `exam_configs/${source}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredSources = sources.filter(s => 
    s.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/admin" className="p-2 hover:bg-neutral-100 rounded-xl transition-colors">
            <ChevronLeft className="w-6 h-6 text-neutral-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-neutral-900">Quản lý Đề thi</h1>
            <p className="text-neutral-500 font-medium text-sm">Ẩn/Hiện các đề thi thử trên hệ thống</p>
          </div>
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input 
            type="text"
            placeholder="Tìm đề quản lý..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-neutral-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all text-sm shadow-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50 border-b border-neutral-100">
                <th className="px-6 py-4 text-xs font-black text-neutral-500 uppercase tracking-widest">Đề thi</th>
                <th className="px-6 py-4 text-xs font-black text-neutral-500 uppercase tracking-widest text-center">Trạng thái</th>
                <th className="px-6 py-4 text-xs font-black text-neutral-500 uppercase tracking-widest text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              <AnimatePresence mode="popLayout">
                {filteredSources.map((source) => {
                  const isHidden = configs[source]?.isHidden || false;
                  return (
                    <motion.tr 
                      key={source}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-neutral-50/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${isHidden ? 'bg-neutral-100 text-neutral-400' : 'bg-rose-50 text-rose-600'}`}>
                            <FileText className="w-5 h-5" />
                          </div>
                          <span className={`font-bold ${isHidden ? 'text-neutral-400' : 'text-neutral-900'}`}>{source}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          isHidden 
                            ? 'bg-neutral-100 text-neutral-500' 
                            : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          {isHidden ? 'Đã ẩn' : 'Đang hiện'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => toggleVisibility(source)}
                          disabled={updatingId === source}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                            isHidden
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100'
                              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                          } disabled:opacity-50`}
                        >
                          {updatingId === source ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : isHidden ? (
                            <>
                              <Eye className="w-4 h-4" />
                              Hiện thị
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-4 h-4" />
                              Tạm ẩn
                            </>
                          )}
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>

          {filteredSources.length === 0 && (
            <div className="p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-neutral-50 text-neutral-300 rounded-full flex items-center justify-center mx-auto">
                <Search className="w-8 h-8" />
              </div>
              <p className="text-neutral-500 font-medium">Không tìm thấy đề thi nào.</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 flex gap-4">
        <AlertCircle className="w-6 h-6 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-indigo-900">Thông tin quản lý</p>
          <p className="text-sm text-indigo-800 leading-relaxed">
            Các đề thi bị "Tạm ẩn" sẽ không xuất hiện trong danh sách luyện thi của học sinh. 
            Bạn có thể dùng tính năng này để bảo trì đề thi hoặc biên tập nội dung trước khi công khai.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ManageExams;
