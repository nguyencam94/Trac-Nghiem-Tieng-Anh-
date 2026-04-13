import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { GrammarTopic, OperationType } from '../types';
import { ChevronRight, BookOpen, ChevronLeft, Search } from 'lucide-react';
import { handleFirestoreError } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { useNavigate } from 'react-router-dom';

const GrammarPage: React.FC = () => {
  const navigate = useNavigate();
  const [topics, setTopics] = useState<GrammarTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<GrammarTopic | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'grammar'), orderBy('order', 'asc'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GrammarTopic));
      setTopics(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'grammar');
    });

    return () => unsubscribe();
  }, []);

  const filteredTopics = topics.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-20 text-neutral-500 font-medium">Đang tải kiến thức ngữ pháp...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => selectedTopic ? setSelectedTopic(null) : navigate('/')}
            className="p-2 hover:bg-neutral-100 rounded-xl transition-colors text-neutral-500"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black text-neutral-900">
              {selectedTopic ? 'Chi tiết ngữ pháp' : 'Ôn tập ngữ pháp'}
            </h1>
            <p className="text-sm font-medium text-neutral-500">
              {selectedTopic ? selectedTopic.title : 'Tổng hợp các chủ đề ngữ pháp trọng tâm thi vào lớp 10'}
            </p>
          </div>
        </div>

        {!selectedTopic && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Tìm kiếm chủ đề..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
            />
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {selectedTopic ? (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden"
          >
            <div className="p-6 sm:p-10">
              <h2 className="text-2xl sm:text-4xl font-black text-neutral-900 mb-8 border-b border-neutral-100 pb-6">
                {selectedTopic.title}
              </h2>
              <div className="prose prose-neutral max-w-none prose-headings:font-black prose-headings:text-neutral-900 prose-p:text-neutral-700 prose-strong:text-neutral-950 prose-strong:font-black prose-table:border prose-table:border-neutral-200 prose-th:bg-neutral-100 prose-th:p-2 prose-td:p-2 prose-td:border prose-td:border-neutral-100 font-serif">
                <ReactMarkdown
                  rehypePlugins={[rehypeRaw]}
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  components={{
                    strong: ({ ...props }) => <strong className="font-black text-neutral-950" {...props} />,
                    u: ({ ...props }) => <u className="decoration-blue-400 decoration-2 underline-offset-4" {...props} />
                  }}
                >
                  {selectedTopic.content}
                </ReactMarkdown>
              </div>
              <div className="mt-12 pt-8 border-t border-neutral-100 flex justify-center">
                <button
                  onClick={() => setSelectedTopic(null)}
                  className="px-8 py-3 bg-neutral-100 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-200 transition-all flex items-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Quay lại danh sách
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6"
          >
            {filteredTopics.map((topic, idx) => (
              <button
                key={topic.id}
                onClick={() => setSelectedTopic(topic)}
                className="group bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm hover:shadow-xl hover:border-blue-400 hover:-translate-y-1 transition-all flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-neutral-50 rounded-2xl flex items-center justify-center text-neutral-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shrink-0">
                    <span className="text-xl font-black">{idx + 1}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-neutral-900 leading-tight group-hover:text-blue-700 transition-colors">
                      {topic.title}
                    </h3>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </button>
            ))}

            {filteredTopics.length === 0 && (
              <div className="col-span-full text-center py-20 bg-white rounded-3xl border border-dashed border-neutral-300">
                <p className="text-neutral-500 italic">Không tìm thấy chủ đề ngữ pháp nào phù hợp.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GrammarPage;
