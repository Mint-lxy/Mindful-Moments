
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

export type AIProvider = 'Gemini' | 'DeepSeek' | 'SiliconFlow';

export interface UserProfile {
  name: string;
  avatar: string;
  themeColor: string; // Hex code
  showMoodChart: boolean;
  showCalendar: boolean;
  aiProvider: AIProvider; // Selected Provider
  apiKey?: string; // Custom API Key
  customModel?: string; // Model name for SiliconFlow (e.g., deepseek-ai/DeepSeek-V3)
}

export interface DailyJoke {
  date: string;
  content: string;
}

export interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  model?: string;
}
