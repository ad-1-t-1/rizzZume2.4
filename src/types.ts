export type Category = 'Work' | 'Internship' | 'Project' | 'Achievement' | 'Skill' | 'Hobby' | 'Education' | 'Extracurricular';

export interface Pointer {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: Category;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  tags: string[];
  bulletPoints: string[];
  privateNotes?: string;
  level?: string; // For skills: Beginner, Intermediate, Expert, etc.
  documentIds?: string[]; // IDs of linked WorkDocuments
  createdAt: string;
}

export interface Resume {
  id: string;
  userId: string;
  name: string;
  targetRole: string;
  jobDescription: string;
  templateId: string;
  pointerIds: string[];
  customizedBullets: Record<string, string[]>; // pointerId -> optimized bullets
  overrides?: Record<string, {
    title?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
  }>;
  headerOverrides?: {
    name?: string;
    nameFontSize?: number;
    email?: string;
    phone?: string;
    linkedin?: string;
    github?: string;
    location?: string;
    targetRole?: string;
  };
  latexContent?: string | null;
  createdAt: string;
}

export interface WorkDocument {
  id: string;
  userId: string;
  title: string;
  content: string; // The extracted text content for AI to read
  fileName: string;
  fileType: string;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: string;
}
