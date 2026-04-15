import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Question, Category, OperationType } from '../types';
import { CheckCircle2, XCircle, ChevronRight, RotateCcw, Home, Info, BookOpen, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

const QuizPage: React.FC = () => {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const { schoolAccount, studentInfo } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [category, setCategory] = useState<{ name: string } | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, number | string | null>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!type || !id) return;
      
      // If school account but no student info, don't fetch and wait for modal
      if (schoolAccount && !studentInfo) {
        setLoading(false);
        return;
      }
      
      try {
        let fetchedQuestions: Question[] = [];
        
        if (type === 'category') {
          if (id === 'all') {
            setCategory({ name: 'Luyện tập chung' });
            const q = query(collection(db, 'questions'));
            const snapshot = await getDocs(q);
            fetchedQuestions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
          } else {
            const catDoc = await getDoc(doc(db, 'categories', id));
            if (catDoc.exists()) setCategory({ name: catDoc.data().name });

            const q = query(collection(db, 'questions'), where('categoryId', '==', id));
            const snapshot = await getDocs(q);
            fetchedQuestions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
          }
        } else if (type === 'type') {
          const exerciseTypes: Record<string, string> = {
            'multiple_choice': 'Chọn đáp án đúng (A, B, C, D)',
            'picture_guess': 'Nhìn tranh đoán đáp án',
            'fill_blank': 'Điền vào chỗ trống',
            'error_find': 'Tìm lỗi sai',
            'synonym_antonym': 'Đồng nghĩa / Trái nghĩa',
            'pronunciation_stress': 'Phát âm / Trọng âm',
            'sentence_transformation': 'Viết lại câu',
            'reading_comprehension': 'Đọc hiểu',
            'essay': 'Tự luận / Trả lời ngắn',
          };
          setCategory({ name: exerciseTypes[id] || 'Luyện tập theo dạng' });
          
          const q = query(collection(db, 'questions'), where('exerciseType', '==', id));
          const snapshot = await getDocs(q);
          fetchedQuestions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
        }
        
        // Group questions by passageId or passage content
        const passageGroups: Record<string, Question[]> = {};
        const singleQuestions: Question[] = [];
        
        fetchedQuestions.forEach(q => {
          const passageKey = q.passageId || (q.passage ? `text_${q.passage.substring(0, 50)}` : null);
          if (passageKey) {
            if (!passageGroups[passageKey]) passageGroups[passageKey] = [];
            passageGroups[passageKey].push(q);
          } else {
            singleQuestions.push(q);
          }
        });

        // Ensure all questions in a group have the passage text if at least one does
        Object.keys(passageGroups).forEach(pId => {
          const group = passageGroups[pId];
          // Sort questions within the group by order
          group.sort((a, b) => (a.order || 0) - (b.order || 0));
          
          const passageText = group.find(q => q.passage)?.passage;
          if (passageText) {
            group.forEach(q => q.passage = passageText);
          }
        });
        
        const allUnits: Question[][] = [
          ...Object.values(passageGroups),
          ...singleQuestions.map(q => [q])
        ];
        
        // Shuffle units
        const shuffledUnits = allUnits.sort(() => Math.random() - 0.5);
        
        // Flatten back to questions
        const shuffled = shuffledUnits.flat();
        setQuestions(shuffled);
        
        // Initialize user answers
        const initialAnswers: Record<number, number | string | null> = {};
        shuffled.forEach((q, idx) => {
          if (q.exerciseType === 'essay' && q.hint) {
            initialAnswers[idx] = q.hint;
          } else {
            initialAnswers[idx] = null;
          }
        });
        setUserAnswers(initialAnswers);
        
        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `questions filter: ${type}/${id}`);
      }
    };
    fetchData();
  }, [type, id]);

  const handleOptionSelect = (qIdx: number, optIdx: number) => {
    if (isSubmitted) return;
    setUserAnswers(prev => ({ ...prev, [qIdx]: optIdx }));
  };

  const handleEssayChange = (qIdx: number, value: string) => {
    if (isSubmitted) return;
    setUserAnswers(prev => ({ ...prev, [qIdx]: value }));
  };

  const handleSubmit = () => {
    if (isSubmitted) return;
    
    let finalScore = 0;
    questions.forEach((q, idx) => {
      if (q.exerciseType === 'essay') {
        if (q.essayAnswer && userAnswers[idx]) {
          const userAns = (userAnswers[idx] as string).trim().toLowerCase();
          const correctAns = q.essayAnswer.trim().toLowerCase();
          if (userAns === correctAns) {
            finalScore += 1;
          }
        }
      } else if (userAnswers[idx] === q.correctOption) {
        finalScore += 1;
      }
    });
    
    setScore(finalScore);
    setIsSubmitted(true);
    // No longer scrolling to top, results will be at the bottom
  };

  const restart = () => {
    setUserAnswers({});
    setIsSubmitted(false);
    setScore(0);
    setIsFinished(false);
    setLoading(true);
    
    // Group questions by passageId
    const passageGroups: Record<string, Question[]> = {};
    const singleQuestions: Question[] = [];
    
    questions.forEach(q => {
      if (q.passageId) {
        if (!passageGroups[q.passageId]) passageGroups[q.passageId] = [];
        passageGroups[q.passageId].push(q);
      } else {
        singleQuestions.push(q);
      }
    });

    // Ensure all questions in a group have the passage text if at least one does
    Object.keys(passageGroups).forEach(pId => {
      const group = passageGroups[pId];
      const passageText = group.find(q => q.passage)?.passage;
      if (passageText) {
        group.forEach(q => q.passage = passageText);
      }
    });
    
    const allUnits: Question[][] = [
      ...Object.values(passageGroups),
      ...singleQuestions.map(q => [q])
    ];
    
    // Shuffle units
    const shuffledUnits = allUnits.sort(() => Math.random() - 0.5);
    
    // Flatten back to questions
    const shuffled = shuffledUnits.flat();
    setQuestions(shuffled);
    
    const initialAnswers: Record<number, number | string | null> = {};
    shuffled.forEach((_, idx) => {
      initialAnswers[idx] = null;
    });
    setUserAnswers(initialAnswers);
    setLoading(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return <div className="flex justify-center py-20">Đang tải câu hỏi...</div>;

  if (schoolAccount && !studentInfo) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] border-2 border-amber-100 shadow-xl text-center space-y-6">
          <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto">
            <User className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-neutral-900">Thiếu thông tin học sinh</h2>
            <p className="text-neutral-500 font-medium">Vui lòng điền đầy đủ Họ tên và Lớp để bắt đầu làm bài tập.</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-amber-500 text-white py-4 rounded-2xl font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-100"
          >
            Nhập thông tin ngay
          </button>
        </div>
      </div>
    );
  }

  if (questions.length === 0) return (
    <div className="text-center py-20 space-y-4">
      <p className="text-xl text-neutral-600">Chưa có câu hỏi nào cho chủ đề này.</p>
      <Link to="/" className="inline-block text-blue-600 font-medium hover:underline">Quay lại trang chủ</Link>
    </div>
  );

  if (isSubmitted && isFinished) {
    // This part is handled by the results view below if we want to toggle it
  }

  const percentage = Math.round((score / questions.length) * 100);
  const rawScore10 = (score / questions.length) * 10;
  const roundedScore10 = Math.round(rawScore10 * 4) / 4;

  const getMessage = (s: number) => {
    if (s >= 8) return "Tuyệt vời! Bạn đã hoàn thành bài tập rất tốt. Hãy tiếp tục phát huy nhé! 🎉";
    if (s >= 5) return "Khá tốt! Bạn đã nắm được kiến thức cơ bản. Cố gắng thêm chút nữa để đạt điểm cao hơn nhé! 👍";
    return "Đừng nản lòng! Hãy ôn tập lại các kiến thức chưa vững và thử lại nhé. Bạn sẽ làm tốt hơn vào lần sau! 💪";
  };

  return (
    <div className="max-w-3xl mx-auto sm:space-y-8 space-y-6 pb-20">
      {/* Header Info */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">{category?.name}</p>
          <h2 className="text-xl font-bold text-neutral-900">Bài luyện tập</h2>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-neutral-500 uppercase">Tổng số câu</p>
          <p className="text-2xl font-black text-neutral-900">{questions.length}</p>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-12">
        {questions.map((q, qIdx) => {
          const hasPassage = !!q.passage;
          const currentPassageKey = q.passageId || q.passage || null;
          const prevPassageKey = qIdx > 0 ? (questions[qIdx - 1].passageId || questions[qIdx - 1].passage || null) : null;
          
          const isNewPassage = hasPassage && (qIdx === 0 || currentPassageKey !== prevPassageKey);
          
          const showPassage = isNewPassage;
          
          return (
            <div key={q.id} className="space-y-6">
              {showPassage && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="bg-neutral-50 p-6 sm:p-8 rounded-3xl border-2 border-neutral-200 space-y-4"
                >
                  <div className="flex items-center gap-2 text-blue-600">
                    <BookOpen className="w-5 h-5" />
                    <span className="font-bold uppercase tracking-wider text-sm">Bài đọc hiểu</span>
                  </div>
                  <div className="prose prose-neutral max-w-none prose-table:border prose-table:border-neutral-200 prose-th:bg-neutral-100 prose-th:p-2 prose-td:p-2 prose-td:border prose-td:border-neutral-100">
                    <div className="text-neutral-700 leading-relaxed space-y-4 font-serif text-lg sm:text-xl">
                      <ReactMarkdown
                        rehypePlugins={[rehypeRaw]}
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        components={{
                          strong: ({ ...props }) => <strong className="font-black text-neutral-900" {...props} />,
                          u: ({ ...props }) => <u className="decoration-blue-400 decoration-2 underline-offset-4" {...props} />
                        }}
                      >
                        {q.passage || ''}
                      </ReactMarkdown>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="flex items-center gap-4">
                <span className="w-10 h-10 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold shrink-0">
                  {qIdx + 1}
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-tighter ${
                  q.difficulty === 1 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                  q.difficulty === 2 ? 'bg-amber-50 text-amber-600 border-amber-200' :
                  'bg-rose-50 text-rose-600 border-rose-200'
                }`}>
                  {q.difficulty === 1 ? 'Dễ' : q.difficulty === 2 ? 'Vừa' : 'Khó'}
                </span>
                <div className="h-px bg-neutral-200 flex-1" />
                {q.source && (
                  <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-xl border-2 border-amber-200 shrink-0 shadow-sm">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Nguồn:</span>
                    <span className="text-sm font-black italic">{q.source}</span>
                  </div>
                )}
              </div>

            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
              {q.imageUrl && (
                <div className="rounded-xl overflow-hidden border border-neutral-100 bg-neutral-50 max-w-md mx-auto">
                  <img 
                    src={q.imageUrl} 
                    alt="Question visual" 
                    className="w-full h-auto object-contain max-h-[300px]"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://placehold.co/600x400?text=Ảnh+không+khả+dụng';
                    }}
                  />
                </div>
              )}
              <div className="text-lg sm:text-xl font-medium text-neutral-900 leading-relaxed prose prose-neutral max-w-none prose-table:border prose-table:border-neutral-200 prose-th:bg-neutral-100 prose-th:p-2 prose-td:p-2 prose-td:border prose-td:border-neutral-100 font-serif">
                <ReactMarkdown
                  rehypePlugins={[rehypeRaw]}
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  components={{
                    strong: ({ ...props }) => <strong className="font-black text-neutral-950" {...props} />,
                    u: ({ ...props }) => <u className="decoration-blue-400 decoration-2 underline-offset-4" {...props} />
                  }}
                >{q.text}</ReactMarkdown>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {q.exerciseType === 'essay' ? (
                <div className="space-y-4">
                  {q.hint && (
                    <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-4 py-2.5 rounded-2xl border border-blue-100 w-fit">
                      <Info className="w-5 h-5" />
                      <span className="text-base font-bold">Gợi ý: {q.hint}</span>
                    </div>
                  )}
                  <textarea
                    value={(userAnswers[qIdx] as string) || ''}
                    onChange={(e) => handleEssayChange(qIdx, e.target.value)}
                    disabled={isSubmitted}
                    className={`w-full p-5 rounded-2xl border-2 font-serif text-lg sm:text-xl outline-none transition-all ${
                      isSubmitted 
                        ? 'bg-neutral-50 border-neutral-200 text-neutral-600' 
                        : 'bg-white border-neutral-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-50'
                    }`}
                    placeholder="Nhập câu trả lời của bạn..."
                    rows={3}
                  />
                  {isSubmitted && (
                    <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 text-emerald-700 font-bold uppercase tracking-widest text-xs">
                        <CheckCircle2 className="w-4 h-4" />
                        Đáp án đúng / Gợi ý:
                      </div>
                      <p className="text-emerald-800 font-serif text-lg sm:text-xl">{q.essayAnswer}</p>
                    </div>
                  )}
                </div>
              ) : (
                q.options.map((opt, optIdx) => {
                  let stateClass = "bg-white border-neutral-200 hover:border-blue-300";
                  const isSelected = userAnswers[qIdx] === optIdx;
                  
                  if (isSelected) stateClass = "bg-blue-50 border-blue-400 ring-2 ring-blue-100";
                  
                  if (isSubmitted) {
                    if (optIdx === q.correctOption) {
                      stateClass = "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-100";
                    } else if (isSelected) {
                      stateClass = "bg-red-50 border-red-500 ring-2 ring-red-100";
                    } else {
                      stateClass = "bg-white border-neutral-100 opacity-50";
                    }
                  }

                  return (
                    <button
                      key={optIdx}
                      onClick={() => handleOptionSelect(qIdx, optIdx)}
                      disabled={isSubmitted}
                      className={`p-4 sm:p-5 rounded-xl border text-left transition-all flex items-center justify-between group ${stateClass}`}
                    >
                      <div className="flex items-center gap-4">
                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base sm:text-lg border transition-colors ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-neutral-50 border-neutral-200 text-neutral-500 group-hover:bg-blue-50 group-hover:border-blue-200 group-hover:text-blue-600'}`}>
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <div className="text-lg sm:text-xl font-medium font-serif">
                          <ReactMarkdown
                            rehypePlugins={[rehypeRaw]}
                            remarkPlugins={[remarkGfm, remarkBreaks]}
                            components={{
                              p: ({ children }) => <span className="inline-block">{children}</span>,
                              strong: ({ ...props }) => <strong className="font-black text-black" {...props} />,
                              u: ({ ...props }) => <u className="decoration-blue-400 decoration-2 underline-offset-4" {...props} />
                            }}
                          >
                            {opt}
                          </ReactMarkdown>
                        </div>
                      </div>
                      {isSubmitted && optIdx === q.correctOption && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      )}
                      {isSubmitted && isSelected && optIdx !== q.correctOption && (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {isSubmitted && q.explanation && (
              <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 flex gap-4">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-1" />
                <div className="space-y-1">
                  <p className="font-bold text-blue-900">Giải thích</p>
                  <div className="text-blue-800 leading-relaxed prose prose-blue max-w-none prose-table:border prose-table:border-blue-200 prose-th:bg-blue-100 prose-th:p-2 prose-td:p-2 prose-td:border prose-td:border-blue-100 font-serif text-lg sm:text-xl">
                    <ReactMarkdown
                      rehypePlugins={[rehypeRaw]}
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                      components={{
                        strong: ({ ...props }) => <strong className="font-black text-blue-950" {...props} />,
                        u: ({ ...props }) => <u className="decoration-blue-400 decoration-2 underline-offset-4" {...props} />
                      }}
                    >
                      {q.explanation}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>

      {/* Submit Button */}
      {!isSubmitted && (
        <div className="flex justify-center pt-12 pb-12">
          <button
            onClick={handleSubmit}
            className="w-full max-w-md bg-neutral-900 text-white py-5 rounded-2xl font-bold hover:bg-neutral-800 transition-all shadow-2xl flex items-center justify-center gap-3 text-lg"
          >
            Nộp bài và xem kết quả
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Results Summary (Only shown after submission) */}
      {isSubmitted && (
        <div className="pt-12 pb-20">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-xl text-center space-y-6"
          >
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-neutral-900">Kết quả của bạn</h2>
              <div className="flex flex-col items-center gap-2">
                <p className="text-4xl font-black text-blue-600">{roundedScore10.toFixed(2)}/10</p>
                <p className={`text-sm font-medium px-4 py-2 rounded-xl border ${
                  roundedScore10 >= 8 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                  roundedScore10 >= 5 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                  'bg-rose-50 text-rose-700 border-rose-100'
                }`}>
                  {getMessage(roundedScore10)}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
              <div className="relative inline-flex items-center justify-center">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-neutral-100" />
                  <circle
                    cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="10" fill="transparent"
                    strokeDasharray={351.8}
                    strokeDashoffset={351.8 - (351.8 * percentage) / 100}
                    className="text-blue-600 transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-neutral-900">{percentage}%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 flex-1 max-w-xs">
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                  <p className="text-xs font-bold text-emerald-600 uppercase">Đúng</p>
                  <p className="text-xl font-black text-emerald-700">{score}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                  <p className="text-xs font-bold text-red-600 uppercase">Sai</p>
                  <p className="text-xl font-black text-red-700">{questions.length - score}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-2">
              <button
                onClick={restart}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Làm lại
              </button>
              <Link
                to="/practice"
                className="flex-1 bg-white text-neutral-700 border border-neutral-200 py-3 rounded-xl font-bold hover:bg-neutral-50 transition-all flex items-center justify-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                Danh sách bài tập
              </Link>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default QuizPage;
