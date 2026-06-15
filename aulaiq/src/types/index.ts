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

export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
  badge?: string;
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

export interface UserProfile {
  name: string;
  email: string;
  institution: string;
  institutionId: string;
  course: string;
  courseId: string;
  preferences: StudyPreferences;
  createdAt: string;
  // TODO: Production — replace demoSessionActive with a real JWT from
  // Supabase Auth, Firebase Auth, Clerk, Auth.js or your own secure backend.
  demoSessionActive: boolean;
}
