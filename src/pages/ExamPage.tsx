import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, doc, updateDoc, addDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebase';
import { Question, OperationType, ExamConfig } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Clock, AlertCircle, ChevronLeft, Send, RotateCcw, Info, BookOpen, ChevronRight, Eye, EyeOff, Edit3, Save, X, Underline, CornerDownLeft, Bold, Upload, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { handleFirestoreError } from '../lib/utils';

const ExamPage: React.FC = () => {
  const { source } = useParams<{ source: string }>();
  const navigate = useNavigate();
  const { profile, schoolAccount, studentInfo } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<number, number | string | null>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPassageId, setEditingPassageId] = useState<string | null>(null);
  const [editingOptionsId, setEditingOptionsId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editOrder, setEditOrder] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60 * 60); // 60 minutes in seconds
  const [isRetryMode, setIsRetryMode] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Use refs to avoid stale closures in timer callback
  const schoolAccountRef = useRef(schoolAccount);
  const studentInfoRef = useRef(studentInfo);
  const profileRef = useRef(profile);

  useEffect(() => {
    schoolAccountRef.current = schoolAccount;
    studentInfoRef.current = studentInfo;
    profileRef.current = profile;
  }, [schoolAccount, studentInfo, profile]);

  const exerciseTypeLabels: Record<string, string> = {
    'multiple_choice': 'Chọn đáp án đúng (A, B, C, D)',
    'picture_guess': 'Nhìn tranh đoán đáp án',
    'fill_blank': 'Điền vào chỗ trống',
    'error_find': 'Tìm lỗi sai',
    'synonym_antonym': 'Đồng nghĩa / Trái nghĩa',
    'pronunciation_stress': 'Phát âm / Trọng âm',
    'sentence_transformation': 'Viết lại câu',
    'reorder': 'Sắp xếp hội thoại, đoạn văn',
    'reading_comprehension': 'Đọc hiểu',
    'essay': 'Tự luận / Trả lời ngắn',
    'other': 'Khác'
  };

  const sortQuestions = (qs: Question[]) => {
    // Sort primarily by type priority, then by passage, then by order, then by createdAt
    const typePriority: Record<string, number> = {
      'multiple_choice': 1,
      'pronunciation_stress': 2,
      'error_find': 3,
      'synonym_antonym': 4,
      'fill_blank': 5,
      'reading_comprehension': 6,
      'sentence_transformation': 7,
      'reorder': 8,
      'essay': 9,
      'picture_guess': 10,
      'other': 11
    };

    return [...qs].sort((a, b) => {
      // 1. Priority by exercise type (Group same types together)
      const priorityA = typePriority[a.exerciseType] || 99;
      const priorityB = typePriority[b.exerciseType] || 99;
      if (priorityA !== priorityB) return priorityA - priorityB;

      // 2. Group by passageId within the same type (especially for reading)
      if (a.passageId || b.passageId) {
        if (a.passageId && b.passageId) {
          if (a.passageId !== b.passageId) return a.passageId.localeCompare(b.passageId);
        } else if (a.passageId) {
          return -1;
        } else if (b.passageId) {
          return 1;
        }
      }

      // 3. Priority by explicit order
      const orderA = a.order ?? 999;
      const orderB = b.order ?? 999;
      if (orderA !== orderB) return orderA - orderB;

      // 4. Finally by creation time
      return a.createdAt.localeCompare(b.createdAt);
    });
  };

  useEffect(() => {
    const fetchQuestions = async () => {
      if (!source) return;
      
      // If school account but no student info, don't fetch and wait for modal
      if (schoolAccount && !studentInfo) {
        setLoading(false);
        return;
      }
      
      try {
        // Check if exam is hidden
        const configDoc = await getDoc(doc(db, 'exam_configs', source));
        if (configDoc.exists()) {
          const config = configDoc.data() as ExamConfig;
          if (config.isHidden && profile?.role !== 'admin' && profile?.role !== 'editor') {
            alert('Đề thi này đang tạm ẩn.');
            navigate('/exams');
            return;
          }
        }

        const q = query(collection(db, 'questions'), where('source', '==', source));
        const snapshot = await getDocs(q);
        const fetchedQuestions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
        
        const finalQuestions = sortQuestions(fetchedQuestions);
        setQuestions(finalQuestions);
        setAllQuestions(finalQuestions);
        
        // Initialize user answers
        const initialAnswers: Record<number, number | string | null> = {};
        finalQuestions.forEach((q, idx) => {
          if (q.exerciseType === 'essay' && q.hint) {
            initialAnswers[idx] = q.hint;
          } else {
            initialAnswers[idx] = null;
          }
        });
        setUserAnswers(initialAnswers);
        setLoading(false);

        // Start timer
        timerRef.current = setInterval(() => {
          setTimeLeft(prev => {
            if (prev <= 1) {
              clearInterval(timerRef.current!);
              handleSubmit();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'questions_exam');
        setLoading(false);
      }
    };

    fetchQuestions();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [source]);

  const handleRetryIncorrect = () => {
    const incorrectQuestions = questions.filter((q, idx) => userAnswers[idx] !== q.correctOption);
    if (incorrectQuestions.length === 0) return;

    setQuestions(incorrectQuestions);
    const initialAnswers: Record<number, number | string | null> = {};
    incorrectQuestions.forEach((_, idx) => {
      initialAnswers[idx] = null;
    });
    setUserAnswers(initialAnswers);
    setIsSubmitted(false);
    setIsRetryMode(true);
    setShowResultModal(false);
    setScore(0);
    setTimeLeft(Math.min(incorrectQuestions.length * 120, 3600)); // 2 mins per question, max 1 hour
    
    // Restart timer
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleOptionSelect = (questionIdx: number, optionIdx: number) => {
    if (isSubmitted) return;
    setUserAnswers(prev => ({ ...prev, [questionIdx]: optionIdx }));
  };

  const handleEssayChange = (questionIdx: number, value: string) => {
    if (isSubmitted) return;
    setUserAnswers(prev => ({ ...prev, [questionIdx]: value }));
  };

  const startEditing = (q: Question) => {
    setEditingId(q.id);
    setEditValue(q.text);
    setEditImageUrl(q.imageUrl || "");
    setEditOrder(q.order || 0);
  };

  const startEditingPassage = (q: Question) => {
    setEditingPassageId(q.passageId || q.id);
    setEditValue(q.passage || "");
  };

  const startEditingOptions = (q: Question) => {
    setEditingOptionsId(q.id);
    setEditOptions([...q.options]);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingPassageId(null);
    setEditingOptionsId(null);
    setEditValue("");
    setEditOptions([]);
    setEditImageUrl("");
    setEditOrder(0);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!auth.currentUser) {
      alert('Vui lòng đăng nhập để thực hiện thao tác này.');
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
          console.error("Upload Error details:", error);
          alert('Lỗi tải ảnh: ' + error.message);
          setIsUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setEditImageUrl(downloadURL);
          setIsUploading(false);
          setUploadProgress(0);
        }
      );
    } catch (error) {
      console.error("Upload Catch Error:", error);
      alert('Lỗi hệ thống khi tải ảnh.');
      setIsUploading(false);
    }
  };

  const saveQuickEdit = async (qId: string) => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'questions', qId), {
        text: editValue,
        imageUrl: editImageUrl,
        order: editOrder
      });
      
      setQuestions(prev => {
        const updated = prev.map(q => q.id === qId ? { ...q, text: editValue, imageUrl: editImageUrl, order: editOrder } : q);
        return sortQuestions(updated);
      });
      
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `questions/${qId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const saveQuickEditPassage = async (passageId: string) => {
    setIsSaving(true);
    try {
      // Find all questions with this passageId
      const relatedQuestions = questions.filter(q => q.passageId === passageId);
      
      // Update all in Firestore (this is a bit heavy but necessary for consistency)
      const updatePromises = relatedQuestions.map(q => 
        updateDoc(doc(db, 'questions', q.id), { passage: editValue })
      );
      await Promise.all(updatePromises);

      setQuestions(prev => prev.map(q => q.passageId === passageId ? { ...q, passage: editValue } : q));
      setEditingPassageId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `passages/${passageId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const saveQuickEditOptions = async (qId: string) => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'questions', qId), {
        options: editOptions
      });
      
      setQuestions(prev => prev.map(q => q.id === qId ? { ...q, options: editOptions } : q));
      setEditingOptionsId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `questions/${qId}/options`);
    } finally {
      setIsSaving(false);
    }
  };

  const insertFormat = (tag: string, isWrap: boolean = true, target: 'text' | 'options' = 'text', optionIdx?: number) => {
    let text = "";
    let textareaId = "quick-edit-textarea";

    if (target === 'text') {
      text = editValue;
    } else if (target === 'options' && optionIdx !== undefined) {
      text = editOptions[optionIdx];
      textareaId = `quick-edit-option-${optionIdx}`;
    }

    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement | HTMLInputElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);

    let newValue = "";
    if (isWrap) {
      const openTag = tag.startsWith('<') ? tag : `**`;
      const closeTag = tag.startsWith('<') ? tag.replace('<', '</') : `**`;
      newValue = before + openTag + selection + closeTag + after;
    } else {
      newValue = before + tag + selection + after;
    }

    if (target === 'text') {
      setEditValue(newValue);
    } else if (target === 'options' && optionIdx !== undefined) {
      const newOptions = [...editOptions];
      newOptions[optionIdx] = newValue;
      setEditOptions(newOptions);
    }

    setTimeout(() => {
      textarea.focus();
      if (isWrap) {
        const tagLen = tag.startsWith('<') ? tag.length : 2;
        textarea.setSelectionRange(start + tagLen, end + tagLen);
      }
    }, 0);
  };

  const handleSubmit = () => {
    if (isSubmitted) return;
    
    if (timerRef.current) clearInterval(timerRef.current);
    
    let correctCount = 0;
    questions.forEach((q, idx) => {
      if (q.exerciseType === 'essay') {
        // Simple check for essay: if user typed something, we can count it or just compare
        // For now, let's do a case-insensitive comparison if essayAnswer exists
        if (q.essayAnswer && userAnswers[idx]) {
          const userAns = (userAnswers[idx] as string).trim().toLowerCase();
          const correctAns = q.essayAnswer.trim().toLowerCase();
          if (userAns === correctAns) {
            correctCount++;
          }
        }
      } else if (userAnswers[idx] === q.correctOption) {
        correctCount++;
      }
    });
    
    const finalScore = (correctCount / questions.length) * 10;
    setScore(finalScore);
    setIsSubmitted(true);
    setShowResultModal(true);

    // Save result to Firestore if user is logged in and NOT in retry mode
    // Use refs to get latest auth state
    const currentSchoolAccount = schoolAccountRef.current;
    const currentStudentInfo = studentInfoRef.current;
    
    if ((auth.currentUser || currentSchoolAccount) && source && !isRetryMode) {
      const saveResult = async () => {
        try {
          await addDoc(collection(db, 'exam_results'), {
            userId: auth.currentUser?.uid || currentSchoolAccount?.id,
            userEmail: auth.currentUser?.email || currentSchoolAccount?.username,
            studentName: currentStudentInfo?.name || null,
            studentClass: currentStudentInfo?.class || null,
            schoolName: currentSchoolAccount?.schoolName || null,
            examSource: source,
            score: finalScore,
            correctCount: correctCount,
            totalQuestions: questions.length,
            completedAt: new Date().toISOString()
          });
        } catch (error) {
          console.error("Error saving exam result:", error);
          // We don't use handleFirestoreError here to avoid blocking the UI for a background save
        }
      };
      saveResult();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-rose-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-500 font-medium">Đang chuẩn bị đề thi...</p>
        </div>
      </div>
    );
  }

  if (schoolAccount && !studentInfo) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] border-2 border-amber-100 shadow-xl text-center space-y-6">
          <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto">
            <User className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-neutral-900">Thiếu thông tin học sinh</h2>
            <p className="text-neutral-500 font-medium">Vui lòng điền đầy đủ Họ tên và Lớp để bắt đầu làm bài thi.</p>
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

  return (
    <div className="relative max-w-4xl mx-auto px-4 pb-24 pt-6 space-y-4">
      {/* Minimal Sticky Header with Timer Toggle - Positioned at far right of screen */}
      <div className="fixed top-[72px] left-0 right-0 z-30 pointer-events-none px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between pointer-events-none">
          <div className="flex-1 pointer-events-none">
            <AnimatePresence>
              {showControls && (
                <motion.button 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onClick={() => navigate('/exams')}
                  className="p-2 bg-white/90 backdrop-blur-md hover:bg-white rounded-xl border border-neutral-200 shadow-sm transition-all text-neutral-500 pointer-events-auto"
                  title="Quay lại"
                >
                  <ChevronLeft className="w-5 h-5" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <AnimatePresence>
              {showControls && (
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className={`flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur-md rounded-xl border-2 transition-colors shadow-sm ${timeLeft < 300 ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'border-neutral-200 text-neutral-700'}`}
                >
                  <span className="font-mono font-black text-base">{formatTime(timeLeft)}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => setShowControls(!showControls)}
              className={`p-2.5 rounded-full border shadow-md transition-all flex items-center justify-center ${showControls ? 'bg-neutral-900 border-neutral-900 text-white' : 'bg-white/90 backdrop-blur-md border-neutral-200 text-neutral-600 hover:bg-white'}`}
              title={showControls ? "Ẩn thời gian" : "Xem thời gian"}
            >
              <Clock className={`w-5 h-5 ${!showControls && timeLeft < 300 ? 'text-red-600 animate-pulse' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showResultModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResultModal(false)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg p-8 rounded-[2.5rem] border-4 border-rose-100 shadow-2xl text-center space-y-6 relative overflow-hidden z-10"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-rose-500" />
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-neutral-900 uppercase tracking-tight">Kết quả bài thi</h3>
                {isRetryMode ? (
                  <div className="inline-block px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-full">
                    Chế độ làm lại câu sai (Không lưu điểm)
                  </div>
                ) : (
                  <p className="text-neutral-500 font-medium">Bạn đã hoàn thành bài thi với số điểm:</p>
                )}
              </div>
              <div className="relative inline-block">
                <div className="text-7xl sm:text-8xl font-black text-rose-600 tabular-nums">
                  {score.toFixed(1)}
                </div>
                <div className="absolute -top-2 -right-6 bg-neutral-900 text-white text-xs font-black px-2 py-1 rounded-lg rotate-12">
                  / 10
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button 
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" /> Làm lại toàn bộ
                </button>
                {questions.some((q, idx) => userAnswers[idx] !== q.correctOption) && (
                  <button 
                    onClick={handleRetryIncorrect}
                    className="px-6 py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-100 flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-5 h-5" /> Làm lại câu sai
                  </button>
                )}
                <button 
                  onClick={() => navigate('/exams')}
                  className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2"
                >
                  Chọn đề khác <ChevronRight className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setShowResultModal(false)}
                  className="sm:col-span-2 px-6 py-3 border-2 border-neutral-200 text-neutral-500 rounded-xl font-bold hover:bg-neutral-50 transition-all flex items-center justify-center gap-2"
                >
                  Xem chi tiết đáp án <CheckCircle2 className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Questions List */}
      <div className="space-y-8">
        {questions.map((q, qIdx) => {
          const hasPassage = !!q.passage;
          const currentPassageKey = q.passageId || q.passage || null;
          const prevPassageKey = qIdx > 0 ? (questions[qIdx - 1].passageId || questions[qIdx - 1].passage || null) : null;
          
          const isNewPassage = hasPassage && (qIdx === 0 || currentPassageKey !== prevPassageKey);
          const isNewType = qIdx === 0 || q.exerciseType !== questions[qIdx - 1].exerciseType;
          
          // Calculate part number
          let partNumber = 0;
          if (isNewType) {
            const uniqueTypesBefore = new Set(questions.slice(0, qIdx + 1).map(item => item.exerciseType));
            partNumber = uniqueTypesBefore.size;
          }

          const showPassage = isNewPassage;
          
          return (
            <div key={q.id} className="space-y-4">
              {isNewType && (
                <div className="pt-8 pb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-blue-100">
                      {partNumber}
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg sm:text-xl font-black text-neutral-900 uppercase tracking-tight">
                        {exerciseTypeLabels[q.exerciseType] || 'Phần tiếp theo'}
                      </h2>
                      <div className="h-1 w-20 bg-blue-600 rounded-full mt-1" />
                    </div>
                  </div>
                </div>
              )}

              {showPassage && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="bg-neutral-50 p-4 sm:p-5 rounded-2xl border-2 border-neutral-200 space-y-3 relative group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-600">
                      <BookOpen className="w-5 h-5" />
                      <span className="font-bold uppercase tracking-wider text-sm">Bài đọc hiểu</span>
                    </div>
                    {profile?.role === 'admin' && !editingPassageId && (
                      <button 
                        onClick={() => startEditingPassage(q)}
                        className="p-1.5 bg-white text-neutral-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-50 hover:text-rose-600 border border-neutral-200 shadow-sm"
                        title="Sửa bài đọc"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {editingPassageId === (q.passageId || q.id) ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-1 border-b border-neutral-200 pb-2">
                        <button 
                          onClick={() => insertFormat('<u>')}
                          className="p-1.5 hover:bg-neutral-200 rounded text-neutral-600"
                          title="Gạch chân"
                        >
                          <Underline className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => insertFormat('**')}
                          className="p-1.5 hover:bg-neutral-200 rounded text-neutral-600"
                          title="In đậm"
                        >
                          <Bold className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => insertFormat('\n', false)}
                          className="p-1.5 hover:bg-neutral-200 rounded text-neutral-600"
                          title="Xuống dòng"
                        >
                          <CornerDownLeft className="w-4 h-4" />
                        </button>
                      </div>
                      <textarea
                        id="quick-edit-textarea"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full min-h-[200px] p-3 border border-rose-200 rounded-xl focus:ring-2 focus:ring-rose-100 focus:border-rose-400 outline-none font-serif text-base"
                        placeholder="Nội dung bài đọc..."
                      />
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={cancelEditing}
                          className="px-3 py-1.5 text-sm font-bold text-neutral-500 hover:bg-neutral-200 rounded-lg flex items-center gap-1"
                        >
                          <X className="w-4 h-4" /> Hủy
                        </button>
                        <button 
                          onClick={() => saveQuickEditPassage(q.passageId || q.id)}
                          disabled={isSaving}
                          className="px-3 py-1.5 text-sm font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 flex items-center gap-1"
                        >
                          {isSaving ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Lưu
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="prose prose-neutral max-w-none prose-table:border prose-table:border-neutral-200 prose-th:bg-neutral-100 prose-th:p-2 prose-td:p-2 prose-td:border prose-td:border-neutral-100">
                      <div className="text-neutral-700 leading-relaxed space-y-3 font-serif text-sm sm:text-base">
                        <ReactMarkdown
                          rehypePlugins={[rehypeRaw]}
                          remarkPlugins={[remarkGfm, remarkBreaks]}
                          components={{
                            strong: ({ ...props }) => <strong className="font-black text-black bg-neutral-100/50 px-1 rounded" {...props} />,
                            u: ({ ...props }) => <u className="decoration-rose-400 decoration-2 underline-offset-4" {...props} />
                          }}
                        >
                          {q.passage || ''}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold shrink-0 text-sm">
                    {qIdx + 1}
                  </span>
                  {profile?.role === 'admin' && q.order !== undefined && (
                    <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold uppercase">
                      Order: {q.order}
                    </span>
                  )}
                </div>
                {profile?.role === 'admin' && !editingOptionsId && q.exerciseType !== 'essay' && (
                  <button 
                    onClick={() => startEditingOptions(q)}
                    className="p-1.5 bg-neutral-100 text-neutral-500 rounded-lg hover:bg-rose-50 hover:text-rose-600 transition-colors flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                    title="Sửa nhanh đáp án"
                  >
                    <Edit3 className="w-3 h-3" /> Sửa đáp án
                  </button>
                )}
                <div className="h-px bg-neutral-200 flex-1" />
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-xl border border-neutral-200 shadow-sm relative group">
                {profile?.role === 'admin' && !editingId && (
                  <button 
                    onClick={() => startEditing(q)}
                    className="absolute top-2 right-2 p-1.5 bg-neutral-100 text-neutral-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-50 hover:text-blue-600"
                    title="Sửa nhanh"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}

                {editingId === q.id ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-1 border-b border-neutral-100 pb-2">
                      <button 
                        onClick={() => insertFormat('<u>')}
                        className="p-1.5 hover:bg-neutral-100 rounded text-neutral-600"
                        title="Gạch chân"
                      >
                        <Underline className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => insertFormat('**')}
                        className="p-1.5 hover:bg-neutral-100 rounded text-neutral-600"
                        title="In đậm"
                      >
                        <Bold className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => insertFormat('\n', false)}
                        className="p-1.5 hover:bg-neutral-100 rounded text-neutral-600"
                        title="Xuống dòng"
                      >
                        <CornerDownLeft className="w-4 h-4" />
                      </button>
                    </div>
                    <textarea
                      id="quick-edit-textarea"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full min-h-[100px] p-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none font-serif text-base"
                      placeholder="Nội dung câu hỏi..."
                    />
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-bold text-neutral-500">Hình ảnh:</label>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          value={editImageUrl}
                          onChange={(e) => setEditImageUrl(e.target.value)}
                          className="flex-1 p-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                          placeholder="Link ảnh (Direct Link)..."
                        />
                        <label className={`p-2 rounded-lg border-2 border-dashed cursor-pointer transition-all flex items-center justify-center min-w-[40px] ${isUploading ? 'bg-neutral-50 border-neutral-200 text-neutral-400' : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'}`}>
                          {isUploading ? <span className="text-[10px] font-bold">{Math.round(uploadProgress)}%</span> : <Upload className="w-4 h-4" />}
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                        </label>
                      </div>
                      {editImageUrl && !editImageUrl.includes('firebasestorage.googleapis.com') && !editImageUrl.match(/\.(jpeg|jpg|gif|png|webp|svg|avif)(\?.*)?$/i) && (
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                          <AlertCircle className="w-3 h-3" />
                          <span>Dùng <strong>Direct Link</strong> nếu ảnh không hiện.</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-bold text-neutral-500">Thứ tự (Order):</label>
                      <input 
                        type="number"
                        value={editOrder}
                        onChange={(e) => setEditOrder(parseInt(e.target.value) || 0)}
                        className="w-20 p-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none font-bold"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={cancelEditing}
                        className="px-3 py-1.5 text-sm font-bold text-neutral-500 hover:bg-neutral-100 rounded-lg flex items-center gap-1"
                      >
                        <X className="w-4 h-4" /> Hủy
                      </button>
                      <button 
                        onClick={() => saveQuickEdit(q.id)}
                        disabled={isSaving}
                        className="px-3 py-1.5 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        {isSaving ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Lưu
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {q.imageUrl && (
                      <div className="mb-4 rounded-xl overflow-hidden border border-neutral-100 bg-neutral-50 max-w-2xl mx-auto">
                        <img 
                          src={q.imageUrl} 
                          alt="Question visual" 
                          className="w-full h-auto object-contain max-h-[400px]"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = 'https://placehold.co/600x400?text=Ảnh+không+khả+dụng';
                          }}
                        />
                      </div>
                    )}
                    <div className="text-base sm:text-lg font-medium text-neutral-900 leading-relaxed prose prose-neutral max-w-none prose-table:border prose-table:border-neutral-200 prose-th:bg-neutral-100 prose-th:p-2 prose-td:p-2 prose-td:border prose-td:border-neutral-100 font-serif">
                      <ReactMarkdown
                        rehypePlugins={[rehypeRaw]}
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        components={{
                          strong: ({ ...props }) => <strong className="font-black text-black bg-neutral-100/50 px-1 rounded" {...props} />,
                          u: ({ ...props }) => <u className="decoration-rose-400 decoration-2 underline-offset-4" {...props} />
                        }}
                      >{q.text}</ReactMarkdown>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2">
                {q.exerciseType === 'essay' ? (
                  <div className="space-y-3">
                    {q.hint && (
                      <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 w-fit">
                        <Info className="w-4 h-4" />
                        <span className="text-sm font-bold">Gợi ý: {q.hint}</span>
                      </div>
                    )}
                    <textarea
                      value={(userAnswers[qIdx] as string) || ''}
                      onChange={(e) => handleEssayChange(qIdx, e.target.value)}
                      disabled={isSubmitted}
                      className={`w-full p-4 rounded-xl border-2 font-serif text-lg outline-none transition-all ${
                        isSubmitted 
                          ? 'bg-neutral-50 border-neutral-200 text-neutral-600' 
                          : 'bg-white border-neutral-200 focus:border-rose-400 focus:ring-4 focus:ring-rose-50'
                      }`}
                      placeholder="Nhập câu trả lời của bạn vào đây..."
                      rows={3}
                    />
                    {isSubmitted && (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                        <div className="flex items-center gap-2 text-emerald-700 font-bold uppercase tracking-widest text-xs">
                          <CheckCircle2 className="w-4 h-4" />
                          Đáp án đúng / Gợi ý:
                        </div>
                        <p className="text-emerald-800 font-serif text-lg">{q.essayAnswer}</p>
                      </div>
                    )}
                  </div>
                ) : editingOptionsId === q.id ? (
                  <div className="space-y-4 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {editOptions.map((opt, idx) => (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-neutral-500 uppercase">Đáp án {String.fromCharCode(65 + idx)}</label>
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => insertFormat('<u>', true, 'options', idx)}
                                className="p-1 hover:bg-neutral-200 rounded text-neutral-500"
                                title="Gạch chân"
                              >
                                <Underline className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={() => insertFormat('**', true, 'options', idx)}
                                className="p-1 hover:bg-neutral-200 rounded text-neutral-500"
                                title="In đậm"
                              >
                                <Bold className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <input 
                            id={`quick-edit-option-${idx}`}
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const newOpts = [...editOptions];
                              newOpts[idx] = e.target.value;
                              setEditOptions(newOpts);
                            }}
                            className="w-full p-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none text-sm font-serif"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
                      <button 
                        onClick={cancelEditing}
                        className="px-3 py-1.5 text-sm font-bold text-neutral-500 hover:bg-neutral-200 rounded-lg flex items-center gap-1"
                      >
                        <X className="w-4 h-4" /> Hủy
                      </button>
                      <button 
                        onClick={() => saveQuickEditOptions(q.id)}
                        disabled={isSaving}
                        className="px-3 py-1.5 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        {isSaving ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Lưu đáp án
                      </button>
                    </div>
                  </div>
                ) : (
                  q.options.map((opt, optIdx) => {
                    let stateClass = "bg-white border-neutral-200 hover:border-rose-300";
                    const isSelected = userAnswers[qIdx] === optIdx;
                    
                    if (isSelected) stateClass = "bg-rose-50 border-rose-400 ring-2 ring-rose-100";
                    
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
                        className={`p-3 sm:p-4 rounded-xl border text-left transition-all flex items-center justify-between group ${stateClass}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm sm:text-base border transition-colors ${isSelected ? 'bg-rose-600 border-rose-600 text-white' : 'bg-neutral-50 border-neutral-200 text-neutral-500 group-hover:bg-rose-50 group-hover:border-rose-200 group-hover:text-rose-600'}`}>
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <div className="text-base sm:text-lg font-medium font-serif">
                            <ReactMarkdown
                              rehypePlugins={[rehypeRaw]}
                              remarkPlugins={[remarkGfm, remarkBreaks]}
                              components={{
                                p: ({ children }) => <span className="inline-block">{children}</span>,
                                strong: ({ ...props }) => <strong className="font-black text-black" {...props} />,
                                u: ({ ...props }) => <u className="decoration-rose-400 decoration-2 underline-offset-4" {...props} />
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
                <div className="bg-rose-50 p-5 rounded-xl border border-rose-100 flex gap-4">
                  <Info className="w-5 h-5 text-rose-600 shrink-0 mt-1" />
                  <div className="space-y-1">
                    <p className="font-bold text-rose-900">Giải thích</p>
                    <div className="text-rose-800 leading-relaxed prose prose-rose max-w-none prose-table:border prose-table:border-rose-200 prose-th:bg-rose-100 prose-th:p-2 prose-td:p-2 prose-td:border prose-td:border-rose-100 font-serif text-lg sm:text-xl">
                      <ReactMarkdown
                        rehypePlugins={[rehypeRaw]}
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        components={{
                          strong: ({ ...props }) => <strong className="font-black text-rose-950" {...props} />,
                          u: ({ ...props }) => <u className="decoration-rose-400 decoration-2 underline-offset-4" {...props} />
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

      {!isSubmitted && (
        <div className="pt-12 flex justify-center">
          <button
            onClick={handleSubmit}
            className="px-12 py-4 bg-rose-600 text-white rounded-2xl font-black text-xl hover:bg-rose-700 transition-all shadow-xl shadow-rose-200 flex items-center gap-3 group"
          >
            <Send className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            Nộp bài thi
          </button>
        </div>
      )}
    </div>
  );
};

export default ExamPage;
