import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Category, OperationType } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, BookOpen, BarChart3, ChevronLeft } from 'lucide-react';
import { handleFirestoreError } from '../lib/utils';
import { motion } from 'motion/react';

const PracticePage: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qCats = query(collection(db, 'categories'), orderBy('createdAt', 'desc'));
    const unsubscribeCats = onSnapshot(qCats, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      setCategories(cats);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });

    return () => unsubscribeCats();
  }, []);

  const exerciseTypes = [
    { id: 'multiple_choice', name: 'Chọn đáp án đúng (A, B, C, D)', description: 'Luyện tập chọn đáp án đúng nhất' },
    { id: 'picture_guess', name: 'Nhìn tranh đoán đáp án', description: 'Chọn đáp án đúng dựa trên hình ảnh' },
    { id: 'fill_blank', name: 'Điền vào chỗ trống', description: 'Hoàn thành câu bằng từ thích hợp' },
    { id: 'error_find', name: 'Tìm lỗi sai', description: 'Phát hiện lỗi sai trong câu' },
    { id: 'synonym_antonym', name: 'Đồng nghĩa / Trái nghĩa', description: 'Mở rộng vốn từ vựng' },
    { id: 'pronunciation_stress', name: 'Phát âm / Trọng âm', description: 'Luyện kỹ năng phát âm' },
    { id: 'sentence_transformation', name: 'Viết lại câu', description: 'Chuyển đổi cấu trúc câu' },
    { id: 'reading_comprehension', name: 'Đọc hiểu', description: 'Rèn luyện kỹ năng đọc' },
  ];

  if (loading) return <div className="flex justify-center py-20 text-neutral-500 font-medium">Đang tải danh sách bài tập...</div>;

  return (
    <div className="sm:space-y-12 space-y-8">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-neutral-100 rounded-xl transition-colors text-neutral-500"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900">Bài tập vận dụng</h1>
          <p className="text-sm font-medium text-neutral-500">Chọn phương thức luyện tập phù hợp với bạn</p>
        </div>
      </div>

      {/* Section 1: Practice by Topic */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-blue-600 rounded-full" />
          <h2 className="text-xl sm:text-2xl font-black text-neutral-900 uppercase tracking-tight">1. Luyện tập theo chủ đề</h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* General Practice Card */}
          <Link
            to="/quiz/category/all"
            className="group bg-gradient-to-br from-blue-600 to-indigo-700 p-5 sm:p-6 rounded-3xl border border-transparent shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-white">
                <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white leading-tight">Luyện tập chung</h3>
                <p className="text-sm text-blue-100 mt-1">Câu hỏi từ tất cả chủ đề</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </Link>

          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/quiz/category/${category.id}`}
              className="group bg-white p-5 sm:p-6 rounded-3xl border border-neutral-200 shadow-sm hover:shadow-xl hover:border-blue-400 hover:-translate-y-1 transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-neutral-50 rounded-2xl flex items-center justify-center text-neutral-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                  <BookOpen className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-neutral-900 leading-tight group-hover:text-blue-700 transition-colors">{category.name}</h3>
                  <p className="text-sm text-neutral-500 mt-1">Bắt đầu luyện tập ngay</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </Link>
          ))}
        </div>
      </div>

      {/* Section 2: Practice by Type */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-emerald-600 rounded-full" />
          <h2 className="text-xl sm:text-2xl font-black text-neutral-900 uppercase tracking-tight">2. Luyện tập theo dạng bài</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {exerciseTypes.map((type) => (
            <Link
              key={type.id}
              to={`/quiz/type/${type.id}`}
              className="group bg-white p-5 sm:p-6 rounded-3xl border border-neutral-200 shadow-sm hover:shadow-xl hover:border-emerald-400 hover:-translate-y-1 transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-neutral-50 rounded-2xl flex items-center justify-center text-neutral-400 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                  <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-neutral-900 leading-tight group-hover:text-emerald-700 transition-colors">{type.name}</h3>
                  <p className="text-sm text-neutral-500 mt-1">{type.description}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
            </Link>
          ))}
        </div>
      </div>

      {categories.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-neutral-300">
          <p className="text-neutral-500 italic">Chưa có chủ đề nào được tạo. Vui lòng quay lại sau.</p>
        </div>
      )}
    </div>
  );
};

export default PracticePage;
