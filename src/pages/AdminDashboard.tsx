import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings, PlusCircle, LayoutDashboard, BarChart3, HelpCircle, BookOpen } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({ categories: 0, questions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [catsSnap, questsSnap] = await Promise.all([
          getDocs(collection(db, 'categories')),
          getDocs(collection(db, 'questions'))
        ]);
        setStats({
          categories: catsSnap.size,
          questions: questsSnap.size
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-200">
          <LayoutDashboard className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-neutral-900">Bảng điều khiển</h1>
          <p className="text-neutral-500 font-medium">Quản lý nội dung ôn tập</p>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm flex items-center gap-6">
          <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
            <BarChart3 className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-500 uppercase tracking-widest">Tổng chủ đề</p>
            <p className="text-4xl font-black text-neutral-900">{loading ? '...' : stats.categories}</p>
          </div>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm flex items-center gap-6">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
            <HelpCircle className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-500 uppercase tracking-widest">Tổng câu hỏi</p>
            <p className="text-4xl font-black text-neutral-900">{loading ? '...' : stats.questions}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          to="/admin/categories"
          className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm hover:shadow-xl hover:border-purple-300 transition-all group"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-4 bg-purple-50 rounded-2xl text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
              <Settings className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold text-neutral-900">Quản lý chủ đề</h2>
          </div>
          <p className="text-neutral-600 leading-relaxed">Thêm, sửa hoặc xóa các chủ đề ôn tập (Grammar, Vocabulary, Reading...).</p>
        </Link>

        <Link
          to="/admin/questions"
          className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm hover:shadow-xl hover:border-emerald-300 transition-all group"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
              <PlusCircle className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold text-neutral-900">Quản lý câu hỏi</h2>
          </div>
          <p className="text-neutral-600 leading-relaxed">Thêm câu hỏi trắc nghiệm mới và gán vào các chủ đề tương ứng.</p>
        </Link>

        <Link
          to="/admin/grammar"
          className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all group"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-4 bg-blue-50 rounded-2xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
              <BookOpen className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold text-neutral-900">Quản lý ngữ pháp</h2>
          </div>
          <p className="text-neutral-600 leading-relaxed">Soạn thảo và quản lý các bài viết ôn tập ngữ pháp trọng tâm.</p>
        </Link>
      </div>
    </div>
  );
};

export default AdminDashboard;
