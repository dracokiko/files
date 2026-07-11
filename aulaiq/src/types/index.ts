// id/institutionId are real Supabase UUIDs (faculdades/cursos), not slugs.
export interface Institution {
  id: string;
  name: string;
  description: string;
  logo: string;
  imagemUrl?: string;
}

export interface Course {
  id: string;
  name: string;
  institutionId: string;
  durationYears: number;
}

// id is a real cadeiras.id UUID.
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
  // Rows sharing the same (curso, year, optionalGroup) are alternative
  // choices for the same elective slot.
  optionalGroup?: string;
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

export type Plan = 'free' | 'essential' | 'team';

export interface UserProfile {
  id: string;
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
