import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, BookOpen, LayoutGrid, FileText } from 'lucide-react';
import { motion } from 'motion/react';

const HomePage: React.FC = () => {
  return (
    <div className="sm:space-y-16 space-y-12 py-8 sm:py-12">
      <section className="text-center space-y-6 max-w-4xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-block px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-sm font-bold tracking-wide uppercase mb-2"
        >
          Chinh phục kỳ thi 10
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-black tracking-tight text-neutral-900 sm:text-7xl leading-[1.1]"
        >
          Ôn thi vào lớp 10 <br />
          <span className="text-blue-600">THPT Môn Tiếng Anh</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-lg sm:text-2xl text-neutral-500 leading-relaxed max-w-2xl mx-auto"
        >
          Hệ thống ôn tập kiến thức trọng tâm và luyện đề trắc nghiệm giúp bạn tự tin đạt điểm cao.
        </motion.p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto px-4">
        {/* Grammar Review Section */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Link
            to="/grammar"
            className="group relative block h-full bg-white p-8 sm:p-10 rounded-[2.5rem] border-2 border-neutral-100 shadow-xl shadow-neutral-100/50 hover:shadow-2xl hover:shadow-emerald-200/40 hover:border-emerald-400 transition-all duration-500 overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-emerald-50 rounded-full group-hover:scale-150 transition-transform duration-700 opacity-50" />
            
            <div className="relative z-10 space-y-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-600 text-white rounded-3xl flex items-center justify-center shadow-lg shadow-emerald-200 group-hover:rotate-6 transition-transform duration-500">
                <BookOpen className="w-8 h-8 sm:w-10 h-10" />
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 group-hover:text-emerald-700 transition-colors">Ôn tập ngữ pháp</h2>
                <p className="text-neutral-500 text-base sm:text-lg leading-relaxed">
                  Tổng hợp các chủ đề ngữ pháp trọng tâm, ví dụ minh họa và mẹo làm bài thi hiệu quả.
                </p>
              </div>
              <div className="flex items-center gap-2 text-emerald-600 font-black text-sm sm:text-base uppercase tracking-wider group-hover:gap-4 transition-all">
                Bắt đầu ôn tập <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Practice Exercises Section */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Link
            to="/practice"
            className="group relative block h-full bg-white p-8 sm:p-10 rounded-[2.5rem] border-2 border-neutral-100 shadow-xl shadow-neutral-100/50 hover:shadow-2xl hover:shadow-blue-200/40 hover:border-blue-400 transition-all duration-500 overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-blue-50 rounded-full group-hover:scale-150 transition-transform duration-700 opacity-50" />

            <div className="relative z-10 space-y-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center shadow-lg shadow-blue-200 group-hover:-rotate-6 transition-transform duration-500">
                <LayoutGrid className="w-8 h-8 sm:w-10 h-10" />
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 group-hover:text-blue-700 transition-colors">Bài tập vận dụng</h2>
                <p className="text-neutral-500 text-base sm:text-lg leading-relaxed">
                  Luyện tập trắc nghiệm theo từng chủ đề, có giải thích chi tiết và chấm điểm tức thì.
                </p>
              </div>
              <div className="flex items-center gap-2 text-blue-600 font-black text-sm sm:text-base uppercase tracking-wider group-hover:gap-4 transition-all">
                Làm bài tập ngay <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Exam Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="md:col-span-2"
        >
          <Link
            to="/exams"
            className="group relative block h-full bg-white p-8 sm:p-10 rounded-[2.5rem] border-2 border-neutral-100 shadow-xl shadow-neutral-100/50 hover:shadow-2xl hover:shadow-rose-200/40 hover:border-rose-400 transition-all duration-500 overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-rose-50 rounded-full group-hover:scale-150 transition-transform duration-700 opacity-50" />

            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-rose-600 text-white rounded-[2rem] flex items-center justify-center shadow-lg shadow-rose-200 group-hover:scale-110 transition-transform duration-500 shrink-0">
                <FileText className="w-10 h-10 sm:w-12 h-12" />
              </div>
              <div className="space-y-4 flex-1 text-center md:text-left">
                <div className="space-y-2">
                  <h2 className="text-3xl sm:text-4xl font-black text-neutral-900 group-hover:text-rose-700 transition-colors">Luyện đề thi thử</h2>
                  <p className="text-neutral-500 text-lg sm:text-xl leading-relaxed max-w-2xl">
                    Thử sức với các đề thi chính thức từ các năm trước. Có đồng hồ bấm giờ 60 phút và chấm điểm theo hệ số 10.
                  </p>
                </div>
                <div className="flex items-center justify-center md:justify-start gap-2 text-rose-600 font-black text-base sm:text-lg uppercase tracking-wider group-hover:gap-4 transition-all">
                  Bắt đầu luyện đề <ChevronRight className="w-6 h-6" />
                </div>
              </div>
            </div>
          </Link>
        </motion.div>
      </div>

      {/* Quick Stats or Info */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="max-w-4xl mx-auto px-4"
      >
        <div className="bg-neutral-900 rounded-[2rem] p-8 sm:p-12 text-white flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-xl sm:text-2xl font-bold">Sẵn sàng cho kỳ thi?</h3>
            <p className="text-neutral-400">Hàng ngàn câu hỏi đang chờ bạn chinh phục.</p>
          </div>
          <div className="flex gap-8 sm:gap-12">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-black text-blue-400">100%</div>
              <div className="text-xs sm:text-sm text-neutral-500 font-bold uppercase tracking-widest mt-1">Miễn phí</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-black text-emerald-400">24/7</div>
              <div className="text-xs sm:text-sm text-neutral-500 font-bold uppercase tracking-widest mt-1">Truy cập</div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default HomePage;
