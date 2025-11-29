
export interface DiaryEntry {
  id: string;
  content: string;
  date: string; // ISO string
  moodScore: number; // 1-10
  tags: string[];
  summary: string;
  advice: string;
  attachments?: string[]; // Base64 strings for images/videos
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  NEW_ENTRY = 'NEW_ENTRY',
  CHAT = 'CHAT',
  LIVE_SESSION = 'LIVE_SESSION',
  SETTINGS = 'SETTINGS',
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface UserProfile {
  name: string;
  avatar: string;
  themeColor: string; // Hex code
  showMoodChart: boolean;
}

export interface DailyJoke {
  date: string;
  content: string;
}
