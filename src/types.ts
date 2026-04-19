export interface Category {
  id: string;
  name: string;
  createdAt: string;
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctOption: number;
  categoryId: string;
  exerciseType: string; // New field for exercise type (e.g., 'multiple_choice', 'fill_blank', 'error_find')
  explanation?: string;
  difficulty: number;
  source?: string; // New field for exam source (e.g., 'Đề thi THPT 2023')
  createdAt: string;
  passage?: string; // Optional reading passage for comprehension questions
  passageId?: string; // Optional ID to group questions belonging to the same passage
  order?: number; // Optional field to maintain order of questions
  imageUrl?: string; // Optional image URL for 'look at picture and guess' questions
  essayAnswer?: string; // Optional answer for essay/short answer questions
  hint?: string; // Optional hint for essay questions (e.g., "I wish...")
  pedagogicalHint?: string; // Optional pedagogical hint to guide the student
  authorId?: string; // ID of the user who created the question
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'editor' | 'user';
}

export interface ExamResult {
  id: string;
  userId: string;
  userEmail: string;
  studentName?: string; // For school account students
  studentClass?: string; // For school account students
  schoolName?: string; // For school account students
  examSource: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  completedAt: string;
}

export interface SchoolAccount {
  id: string;
  username: string;
  password: string;
  schoolName: string;
  createdAt: string;
}

export interface GrammarTopic {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  order?: number;
  authorId?: string;
}

export interface ExamConfig {
  id: string; // The source name acts as ID
  isHidden: boolean;
  order?: number;
  updatedAt: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
