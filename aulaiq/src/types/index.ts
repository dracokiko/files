export interface Institution {
  id: string;
  name: string;
  description: string;
  logo: string;
}

export interface Course {
  id: string;
  name: string;
  institutionId: string;
}

export interface Subject {
  id: string;
  name: string;
  institution: string;
  course: string;
  year: number;
  yearLabel: string;
  semester: number;
  semesterLabel: string;
  isOptional?: boolean;
  optionalChoices?: string[];
}

export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
  badge?: string;
  stripeUrl?: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface StudyPreferences {
  studyFrequency: string;
  studyHours: string;
  mainGoal: string;
  studyStyle: string;
}

export type Plan = 'free' | 'trial' | 'monthly' | 'semester';

export interface UserProfile {
  name: string;
  email: string;
  institution: string;
  institutionId: string;
  course: string;
  courseId: string;
  year: number;
  yearLabel: string;
  plan: Plan;
  preferences: StudyPreferences;
  createdAt: string;
  // TODO: Production — replace demoSessionActive with a real JWT from
  // Supabase Auth, Firebase Auth, Clerk, Auth.js or your own secure backend.
  demoSessionActive: boolean;
}
