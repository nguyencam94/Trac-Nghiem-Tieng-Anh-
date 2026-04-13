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
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'user';
}

export interface GrammarTopic {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  order?: number;
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
