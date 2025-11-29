import React, { useState, useEffect, useRef } from 'react';
import { DiaryEntry, AppView, UserProfile, DailyJoke } from './types';
import { analyzeDiaryEntry, transcribeAudio, fetchDailyJoke } from './services/geminiService';
import { arrayBufferToBase64 } from './services/audioUtils';
import { LiveSession } from './components/LiveSession';
import { MoodChart } from './components/MoodChart';
import { ChatAssistant } from './components/ChatAssistant';
import { 
  BookHeart, 
  MessageCircle, 
  Plus, 
  Mic, 
  Calendar,
  ChevronRight,
  ChevronLeft,
  BrainCircuit,
  Loader2,
  StopCircle,
  X,
  Search,
  Settings,
  Smile,
  Palette,
  User,
  Sparkles,
  Cloud,
  Heart,
  Star,
  Camera,
  Upload,
  Check,
  PenLine,
  Image as ImageIcon,
  Video,
  Eye,
  EyeOff,
  Trash2,
  RefreshCcw,
  Zap,
  AlertTriangle,
  Maximize2,
  Tag,
  Pipette
} from 'lucide-react';

// Cute Color Palette
const PRESET_COLORS = [
  { hex: '#818cf8', name: '静谧靛蓝' }, // Indigo (Default)
  { hex: '#f472b6', name: '樱花粉' },   // Pink
  { hex: '#38bdf8', name: '天空蓝' },   // Sky
  { hex: '#34d399', name: '薄荷绿' },   // Mint
  { hex: '#fb923c', name: '活力橙' },   // Orange
  { hex: '#a78bfa', name: '香芋紫' },   // Violet
  { hex: '#fb7185', name: '玫瑰红' },   // Rose
  { hex: '#facc15', name: '玫瑰黄' },   // Yellow
];

// Cute Avatars
const AVATARS = ['🐻', '🐱', '🐰', '🦊', '🐼', '🐨', '🐯', '🐷', '🐸', '🦄', '🐙', '🐣'];

// Helper to convert hex to rgb string for Tailwind vars
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}` : '99 102 241';
}

// Image compression helper
const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculate new dimensions (max 1280px)
                const MAX_WIDTH = 1280;
                let width = img.width;
                let height = img.height;
                
                if (width > MAX_WIDTH) {
                    height = (height * MAX_WIDTH) / width;
                    width = MAX_WIDTH;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                ctx?.drawImage(img, 0, 0, width, height);
                
                // Compress to JPEG 0.7
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

export const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [newEntryText, setNewEntryText] = useState('');
  const [newEntryAttachments, setNewEntryAttachments] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // User Profile
  const [userProfile, setUserProfile] = useState<UserProfile>({ 
    name: '旅行者', 
    avatar: '🐱', 
    themeColor: '#818cf8',
    showMoodChart: true,
    showCalendar: true
  });
  
  // Avatar Upload State
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);
  
  // Detail View State
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntry | null>(null);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);

  // Clear Data State
  const [clearDataStep, setClearDataStep] = useState<number>(0); // 0: off, 1: first confirm, 2: final confirm
  
  // Daily Joke
  const [dailyJoke, setDailyJoke] = useState<DailyJoke | null>(null);

  // Search & Filter State
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  // Calendar State
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // File Upload Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  // Load from local storage
  useEffect(() => {
    try {
        const savedEntries = localStorage.getItem('mindful_moments_entries');
        if (savedEntries) setEntries(JSON.parse(savedEntries));

        const savedProfile = localStorage.getItem('mindful_moments_profile');
        if (savedProfile) {
            // Migrate old profile structure if needed
            const parsed = JSON.parse(savedProfile);
            setUserProfile({ 
                ...parsed, 
                showMoodChart: parsed.showMoodChart ?? true,
                showCalendar: parsed.showCalendar ?? true 
            });
        }

        const savedJoke = localStorage.getItem('mindful_moments_joke');
        if (savedJoke) setDailyJoke(JSON.parse(savedJoke));
    } catch (e) {
        console.error("Failed to load from storage", e);
    }
  }, []);

  // Reset delete confirmation when selected entry changes
  useEffect(() => {
    setIsDeleteConfirming(false);
  }, [selectedEntry]);

  // Save entries to local storage
  useEffect(() => {
    try {
        localStorage.setItem('mindful_moments_entries', JSON.stringify(entries));
    } catch (e) {
        console.error("Failed to save entries (likely quota exceeded)", e);
        // Optional: Notify user that storage is full if needed
    }
  }, [entries]);

  // Save profile to local storage and apply theme
  useEffect(() => {
    try {
        localStorage.setItem('mindful_moments_profile', JSON.stringify(userProfile));
    } catch (e) { console.error(e); }
    
    // Apply theme variables dynamically
    const primaryRgb = hexToRgb(userProfile.themeColor);
    const root = document.documentElement;
    root.style.setProperty('--color-primary', primaryRgb);
    root.style.setProperty('--color-secondary', primaryRgb);
    root.style.setProperty('--color-accent', primaryRgb);
  }, [userProfile]);

  // Fetch Daily Joke logic
  useEffect(() => {
    const checkAndFetchJoke = async () => {
      const today = new Date().toLocaleDateString('zh-CN');
      if (!dailyJoke || dailyJoke.date !== today) {
        // Fetch new joke
        const jokeContent = await fetchDailyJoke();
        const newJoke = { date: today, content: jokeContent };
        setDailyJoke(newJoke);
        try { localStorage.setItem('mindful_moments_joke', JSON.stringify(newJoke)); } catch(e){}
      }
    };
    checkAndFetchJoke();
  }, [dailyJoke]);

  // Stop camera stream when component unmounts or camera closes
  useEffect(() => {
    if (!isCameraOpen && cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  }, [isCameraOpen, cameraStream]);

  // Get Dynamic Greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 5) return '深夜好';
    if (hour < 11) return '早上好';
    if (hour < 13) return '中午好';
    if (hour < 18) return '下午好';
    return '晚上好';
  };

  const checkSecureContext = () => {
      if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          alert("安全限制：为了保护您的隐私，浏览器要求在 HTTPS 环境下才能使用摄像头和麦克风。请确保您使用 https:// 访问此应用。");
          return false;
      }
      return true;
  };

  const handleSaveEntry = async () => {
    if (!newEntryText.trim() && newEntryAttachments.length === 0) return;

    setIsAnalyzing(true);
    try {
      const analysis = await analyzeDiaryEntry(newEntryText, newEntryAttachments);
      
      // Determine date: use filterDate if set, otherwise current time
      let entryDate = new Date();
      if (filterDate) {
          // preserve current time but on selected date
          const selected = new Date(filterDate);
          entryDate.setFullYear(selected.getFullYear());
          entryDate.setMonth(selected.getMonth());
          entryDate.setDate(selected.getDate());
      }

      const newEntry: DiaryEntry = {
        id: Date.now().toString(),
        content: newEntryText,
        date: entryDate.toISOString(),
        moodScore: analysis.moodScore || 5,
        tags: analysis.tags || [],
        summary: analysis.summary || "暂无总结",
        advice: analysis.advice || "继续加油！",
        attachments: newEntryAttachments
      };
      
      setEntries([newEntry, ...entries]);
      setNewEntryText('');
      setNewEntryAttachments([]);
      setFilterDate(''); // Reset filter after saving
      setShowDateFilter(false);
      setView(AppView.DASHBOARD);
    } catch (e) {
      console.error(e);
      alert("分析失败，请重试。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteEntry = (id: string) => {
      const updatedEntries = entries.filter(e => e.id !== id);
      setEntries(updatedEntries);
      setSelectedEntry(null);
  };

  const getMoodColor = (score: number) => {
    if (score >= 8) return 'bg-green-50 text-green-600 border-green-100';
    if (score >= 5) return 'bg-blue-50 text-blue-600 border-blue-100';
    return 'bg-amber-50 text-amber-600 border-amber-100';
  };

  const startRecording = async () => {
    if (!checkSecureContext()) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        const base64Audio = arrayBufferToBase64(arrayBuffer);
        
        setIsTranscribing(true);
        try {
            const text = await transcribeAudio(base64Audio, 'audio/webm');
            setNewEntryText(prev => (prev ? prev + " " + text : text));
        } catch (error) {
            console.error(error);
            alert("语音转录失败");
        } finally {
            setIsTranscribing(false);
            stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone", err);
      alert("无法访问麦克风。请检查系统权限或 HTTPS 设置。");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Avatar Upload Handler
  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        compressImage(file).then(base64 => {
            setPendingAvatar(base64);
        }).catch(err => {
            console.error("Failed to process image", err);
            alert("图片处理失败");
        });
    }
  };

  const confirmAvatarUpload = () => {
    if (pendingAvatar) {
        setUserProfile(prev => ({ ...prev, avatar: pendingAvatar }));
        setPendingAvatar(null);
    }
  };

  const cancelAvatarUpload = () => {
    setPendingAvatar(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  // Clear Data Handler
  const handleClearData = () => {
      localStorage.clear();
      window.location.reload();
  };

  // Diary Attachment Handler
  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
        for (const file of Array.from(files)) {
            // Increased limit to 50MB for video support
            if (file.size > 50 * 1024 * 1024) {
                alert(`文件 ${file.name} 太大，请选择小于 50MB 的文件。`);
                continue;
            }

            try {
                let result = '';
                if (file.type.startsWith('image/')) {
                    // Compress image
                    result = await compressImage(file);
                } else {
                    // For video, read as dataURL directly
                     result = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target?.result as string);
                        reader.readAsDataURL(file);
                     });
                }
                setNewEntryAttachments(prev => [...prev, result]);
            } catch (err) {
                console.error("Upload failed", err);
                alert("上传失败");
            }
        }
    }
    // Reset input
    if (event.target) event.target.value = '';
  };

  // --- Camera Logic ---

  const startCamera = async (mode: 'user' | 'environment' = 'environment') => {
    if (!checkSecureContext()) return;
    
    setIsCameraOpen(true);
    // Stop any existing stream first
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: mode }
        });
        setCameraStream(stream);
        setFacingMode(mode);
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    } catch (err) {
        console.error("Camera access failed:", err);
        alert("无法访问摄像头。请检查是否允许了浏览器权限，或确保使用了 HTTPS。");
        setIsCameraOpen(false);
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        if (context) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            // Compress straight from canvas
            const imageDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            
            if (view === AppView.SETTINGS) {
                 // Crop to square for avatar
                 const squareCanvas = document.createElement('canvas');
                 const sqCtx = squareCanvas.getContext('2d');
                 const size = Math.min(canvas.width, canvas.height);
                 squareCanvas.width = 200;
                 squareCanvas.height = 200;
                 if (sqCtx) {
                     const sx = (canvas.width - size) / 2;
                     const sy = (canvas.height - size) / 2;
                     sqCtx.drawImage(canvas, sx, sy, size, size, 0, 0, 200, 200);
                     setPendingAvatar(squareCanvas.toDataURL('image/jpeg', 0.8));
                 }
            } else {
                 setNewEntryAttachments(prev => [...prev, imageDataUrl]);
            }
            
            // Close camera
            setIsCameraOpen(false);
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
                setCameraStream(null);
            }
        }
    }
  };

  const switchCamera = () => {
      const newMode = facingMode === 'environment' ? 'user' : 'environment';
      startCamera(newMode);
  };

  const removeAttachment = (index: number) => {
      setNewEntryAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const filteredEntries = entries.filter(entry => {
    // Date Filter
    if (filterDate) {
        const entryISO = entry.date.split('T')[0];
        if (entryISO !== filterDate) return false;
    }
    
    // Keyword Filter
    if (searchKeyword) {
        const lowerKeyword = searchKeyword.toLowerCase();
        const matchesContent = entry.content.toLowerCase().includes(lowerKeyword);
        const matchesSummary = entry.summary.toLowerCase().includes(lowerKeyword);
        const matchesTags = entry.tags?.some(tag => tag.toLowerCase().includes(lowerKeyword));
        return matchesContent || matchesSummary || matchesTags;
    }

    return true;
  });

  // Main Container Logic:
  // Root must be 100dvh + overflow-hidden to contain the app in viewport
  // Scrolling is handled by the <main> element
  const mainContainerClasses = "h-[100dvh] w-full bg-slate-50 text-slate-900 font-sans overflow-hidden relative flex flex-col md:flex-row";
  const isChatView = view === AppView.CHAT;

  const isEmojiAvatar = (avatar: string) => {
      return !avatar.startsWith('data:image') && !avatar.startsWith('http');
  };

  const AvatarDisplay = ({ avatar, size = "md", className = "" }: { avatar: string, size?: "sm"|"md"|"lg"|"xl", className?: string }) => {
    const sizeClasses = {
        sm: "w-8 h-8 text-sm",
        md: "w-11 h-11 text-xl",
        lg: "w-16 h-16 text-3xl",
        xl: "w-32 h-32 text-6xl"
    };
    return (
        <div className={`${sizeClasses[size]} rounded-full flex items-center justify-center overflow-hidden shadow-sm border border-slate-100 ${className} ${isEmojiAvatar(avatar) ? 'bg-gradient-to-tr from-primary to-primary/50 text-white' : 'bg-white'}`}>
            {isEmojiAvatar(avatar) ? avatar : <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />}
        </div>
    );
  };

  // Safe Top Spacer Component for Views
  const SafeTopSpacer = () => <div className="w-full h-12 flex-shrink-0" />;

  // Calendar Components
  const CalendarWidget = () => {
    const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const days = new Date(year, month + 1, 0).getDate();
      const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
      const firstDayAdjusted = firstDay === 0 ? 6 : firstDay - 1; 
      return { days, firstDay: firstDayAdjusted };
    };

    const { days, firstDay } = getDaysInMonth(calendarMonth);
    const today = new Date();
    const isCurrentMonth = today.getMonth() === calendarMonth.getMonth() && today.getFullYear() === calendarMonth.getFullYear();

    const changeMonth = (delta: number) => {
        const newDate = new Date(calendarMonth);
        newDate.setMonth(newDate.getMonth() + delta);
        setCalendarMonth(newDate);
    };

    const hasEntry = (day: number) => {
        const year = calendarMonth.getFullYear();
        const month = String(calendarMonth.getMonth() + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayStr}`;
        return entries.some(e => e.date.startsWith(dateStr));
    };

    const isSelected = (day: number) => {
        if (!filterDate) return false;
        const year = calendarMonth.getFullYear();
        const month = String(calendarMonth.getMonth() + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        return filterDate === `${year}-${month}-${dayStr}`;
    };

    const handleDateClick = (day: number) => {
        const year = calendarMonth.getFullYear();
        const month = String(calendarMonth.getMonth() + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayStr}`;
        
        if (filterDate === dateStr) {
            setFilterDate('');
            setShowDateFilter(false);
        } else {
            setFilterDate(dateStr);
            setShowDateFilter(true);
        }
    };

    return (
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
             {/* Header */}
             <div className="flex justify-between items-center mb-2">
                 <h3 className="text-sm font-bold text-slate-700">
                    {calendarMonth.getFullYear()}年 {calendarMonth.getMonth() + 1}月
                 </h3>
                 <div className="flex gap-1">
                     <button onClick={() => changeMonth(-1)} className="p-1 rounded-full hover:bg-slate-100 text-slate-400">
                         <ChevronLeft size={16} />
                     </button>
                     <button onClick={() => changeMonth(1)} className="p-1 rounded-full hover:bg-slate-100 text-slate-400">
                         <ChevronRight size={16} />
                     </button>
                 </div>
             </div>

             {/* Grid */}
             <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
                 {['一', '二', '三', '四', '五', '六', '日'].map(d => (
                     <div key={d} className="text-[10px] text-slate-400 font-bold py-1">{d}</div>
                 ))}
             </div>
             <div className="grid grid-cols-7 gap-0.5">
                 {Array.from({ length: firstDay }).map((_, i) => (
                     <div key={`empty-${i}`} />
                 ))}
                 {Array.from({ length: days }).map((_, i) => {
                     const day = i + 1;
                     const isToday = isCurrentMonth && today.getDate() === day;
                     const marked = hasEntry(day);
                     const selected = isSelected(day);

                     return (
                         <div key={day} className="flex flex-col items-center justify-center aspect-square">
                             <button 
                                onClick={() => handleDateClick(day)}
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium transition-all relative
                                    ${selected 
                                        ? 'bg-primary text-white shadow-md shadow-primary/30' 
                                        : isToday 
                                            ? 'bg-primary/10 text-primary font-bold' 
                                            : 'text-slate-600 hover:bg-slate-50'
                                    }
                                `}
                             >
                                 {day}
                                 {marked && !selected && (
                                     <div className="absolute bottom-1 w-1 h-1 bg-accent rounded-full"></div>
                                 )}
                             </button>
                         </div>
                     );
                 })}
             </div>
        </div>
    );
  };

  return (
    <div className={mainContainerClasses}>

      {/* Cute Decorative Background */}
      {!isChatView && (
        <>
            <Cloud className="absolute top-10 right-[-20px] text-primary opacity-10 w-24 h-24 rotate-12 pointer-events-none" />
            <Cloud className="absolute top-40 left-[-20px] text-secondary opacity-10 w-16 h-16 -rotate-6 pointer-events-none" />
            <Sparkles className="absolute bottom-32 left-10 text-accent opacity-10 w-12 h-12 pointer-events-none" />
            <Heart className="absolute top-1/4 right-10 text-primary opacity-5 w-8 h-8 pointer-events-none" />
            <Star className="absolute top-10 left-10 text-yellow-400 opacity-20 w-6 h-6 animate-pulse pointer-events-none" />
        </>
      )}

      {/* Live Session Overlay */}
      {view === AppView.LIVE_SESSION && (
        <LiveSession onClose={() => setView(AppView.CHAT)} />
      )}

      {/* Camera Overlay */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-fadeIn">
            {/* Top Area: Safe Area + Spacer to push UI down */}
            <div className="safe-area-top bg-black"></div>
            <div className="h-12 bg-black flex-shrink-0"></div>

            {/* Camera Controls Top - Aligned with other page headers */}
            <div className="flex justify-between items-center px-4 pb-2 z-10 bg-black">
                <button onClick={() => setIsCameraOpen(false)} className="text-white p-2 rounded-full hover:bg-white/10">
                    <X size={28} />
                </button>
                <div className="text-white font-medium bg-white/10 px-4 py-1.5 rounded-full text-xs backdrop-blur-md">
                    {view === AppView.SETTINGS ? '拍摄头像' : '拍摄照片'}
                </div>
                <div className="w-10"></div> {/* Spacer for balance */}
            </div>

            {/* Viewfinder */}
            <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
                 <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover"
                 />
                 <canvas ref={canvasRef} className="hidden" />
                 
                 {/* Square Guide for Avatar */}
                 {view === AppView.SETTINGS && (
                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                         <div className="w-64 h-64 border-2 border-white/50 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
                     </div>
                 )}
            </div>

            {/* Camera Controls Bottom */}
            <div className="p-8 pb-12 flex justify-between items-center bg-black/80 backdrop-blur-md safe-area-bottom">
                <div className="w-12"></div> {/* Spacer */}
                
                <button 
                    onClick={takePhoto}
                    className="w-20 h-20 rounded-full bg-white border-4 border-slate-300 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-white/20"
                >
                    <div className="w-16 h-16 rounded-full bg-white border-2 border-black/10"></div>
                </button>

                <button onClick={switchCamera} className="p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors">
                    <RefreshCcw size={24} />
                </button>
            </div>
        </div>
      )}

      {/* Avatar Confirmation Modal - Centered Popup - Static - Mobile Optimized */}
      {pendingAvatar && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn safe-area-top safe-area-bottom">
            <div className="bg-white p-6 rounded-[2rem] w-full max-w-[280px] shadow-2xl flex flex-col items-center gap-5">
                <h3 className="text-lg font-bold text-slate-800">确认头像</h3>
                
                <div className="w-24 h-24 rounded-full overflow-hidden shadow-xl border-4 border-slate-50 ring-2 ring-primary/20 shrink-0">
                    <img src={pendingAvatar} alt="New Avatar Preview" className="w-full h-full object-cover" />
                </div>
                
                <div className="grid grid-cols-2 gap-3 w-full mt-2">
                     <button 
                        onClick={cancelAvatarUpload} 
                        className="py-2.5 px-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors text-xs"
                     >
                        取消
                     </button>
                     <button 
                        onClick={confirmAvatarUpload} 
                        className="py-2.5 px-3 rounded-xl bg-primary text-white font-bold hover:brightness-110 shadow-lg shadow-primary/30 transition-all text-xs"
                     >
                        确认
                     </button>
                </div>
            </div>
        </div>
      )}

      {/* Diary Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center md:p-6 animate-fadeIn">
            <div className="bg-slate-50 w-full md:max-w-xl h-[85vh] md:h-[80vh] md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-slideUp">
                
                {/* Modal Header */}
                <div className="bg-white px-6 py-4 flex justify-between items-center border-b border-slate-100 sticky top-0 z-10">
                    <div>
                         <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                             {new Date(selectedEntry.date).toLocaleDateString('zh-CN', { weekday: 'long' })}
                         </p>
                         <h3 className="text-xl font-bold text-slate-800">
                             {new Date(selectedEntry.date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
                         </h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 ${getMoodColor(selectedEntry.moodScore)}`}>
                            <Smile size={14} />
                            <span>{selectedEntry.moodScore}</span>
                        </div>
                        <button 
                            onClick={() => setSelectedEntry(null)} 
                            className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors text-slate-500"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Modal Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    
                    {/* Tags */}
                    {selectedEntry.tags && selectedEntry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {selectedEntry.tags.map(tag => (
                                <span key={tag} className="px-3 py-1 bg-white border border-slate-100 rounded-lg text-xs text-slate-500 flex items-center gap-1">
                                    <Tag size={12} />
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Text Content */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                         <p className="text-slate-700 text-base leading-relaxed whitespace-pre-wrap font-medium">
                             {selectedEntry.content}
                         </p>
                    </div>

                    {/* Attachments (Moved Below Text) */}
                    {selectedEntry.attachments && selectedEntry.attachments.length > 0 && (
                        <div className={`grid gap-3 ${selectedEntry.attachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                            {selectedEntry.attachments.map((att, idx) => (
                                <div key={idx} className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
                                    {att.startsWith('data:video') ? (
                                        <video src={att} controls className="w-full h-full object-cover max-h-64" />
                                    ) : (
                                        <img src={att} alt="Attachment" className="w-full h-auto object-cover" />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* AI Analysis */}
                    <div className="bg-gradient-to-br from-primary/5 to-secondary/5 p-5 rounded-3xl border border-primary/10">
                         <div className="flex items-center gap-2 mb-3 text-primary font-bold">
                             <BrainCircuit size={18} />
                             <span>AI 洞察</span>
                         </div>
                         <div className="space-y-3">
                             <div>
                                 <span className="text-xs font-bold text-slate-400 uppercase">总结</span>
                                 <p className="text-sm text-slate-600 italic">"{selectedEntry.summary}"</p>
                             </div>
                             <div className="h-px bg-primary/10 w-full my-2"></div>
                             <div>
                                 <span className="text-xs font-bold text-slate-400 uppercase">建议</span>
                                 <p className="text-sm text-slate-700 font-bold">✨ {selectedEntry.advice}</p>
                             </div>
                         </div>
                    </div>
                    
                    <div className="h-8"></div> {/* Bottom Spacer within scroll */}
                </div>

                {/* Footer with Delete Confirmation */}
                <div className="p-4 border-t border-slate-100 bg-white safe-area-bottom">
                     {isDeleteConfirming ? (
                         <div className="flex gap-3 animate-fadeIn">
                             <button 
                                onClick={() => setIsDeleteConfirming(false)}
                                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors text-sm"
                             >
                                 取消
                             </button>
                             <button 
                                onClick={() => handleDeleteEntry(selectedEntry.id)}
                                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30 text-sm"
                             >
                                 确认删除
                             </button>
                         </div>
                     ) : (
                         <button 
                            onClick={() => setIsDeleteConfirming(true)}
                            className="w-full py-3 rounded-xl border border-red-100 text-red-500 font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2 text-sm"
                         >
                             <Trash2 size={16} />
                             删除这篇日记
                         </button>
                     )}
                </div>
            </div>
        </div>
      )}

      {/* Clear Data Modal */}
      {clearDataStep > 0 && (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
              <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col items-center text-center gap-4">
                  <div className={`p-4 rounded-full ${clearDataStep === 1 ? 'bg-orange-100 text-orange-500' : 'bg-red-100 text-red-500'}`}>
                      <AlertTriangle size={32} />
                  </div>
                  
                  <h3 className="text-xl font-bold text-slate-800">
                      {clearDataStep === 1 ? '确定要清除数据吗？' : '最后的警告!'}
                  </h3>
                  
                  <p className="text-slate-500 text-sm leading-relaxed">
                      {clearDataStep === 1 
                          ? '这将删除您所有的日记、设置和个人信息。清除后无法恢复。' 
                          : '这是不可逆的操作。所有数据将永久丢失。您真的确定吗？'}
                  </p>
                  
                  <div className="flex flex-col w-full gap-3 mt-4">
                      <button 
                          onClick={() => {
                              if (clearDataStep === 1) setClearDataStep(2);
                              else handleClearData();
                          }}
                          className={`w-full py-3 rounded-xl text-white font-bold shadow-lg transition-all ${
                              clearDataStep === 1 
                                ? 'bg-orange-500 shadow-orange-500/30 hover:bg-orange-600' 
                                : 'bg-red-500 shadow-red-500/30 hover:bg-red-600'
                          }`}
                      >
                          {clearDataStep === 1 ? '继续' : '确认清除所有数据'}
                      </button>
                      <button 
                          onClick={() => setClearDataStep(0)} 
                          className="w-full py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors"
                      >
                          取消
                      </button>
                  </div>
              </div>
          </div>
      )}

{/* Navigation */}
<nav className={`fixed bottom-0 left-0 w-full md:w-20 md:h-full transition-all duration-300 z-50 
  flex md:flex-col justify-around md:justify-start md:pt-8 md:gap-8 items-center h-16 md:h-full safe-area-bottom 
  ${isChatView ? 'border-t-0 shadow-none bg-white' : 'bg-white/90 backdrop-blur-lg border-t md:border-t-0 md:border-r border-slate-200 shadow-[0_-5px_20px_rgba(0,0,0,0.03)] md:shadow-none'}`}>

  {/* 用户头像 - 仅桌面显示 */}
  <div className="hidden md:flex flex-col items-center mb-4 cursor-pointer hover:scale-105 transition-transform" onClick={() => setView(AppView.SETTINGS)}>
    <AvatarDisplay avatar={userProfile.avatar} size="md" className="shadow-primary/30" />
  </div>

  {/* 日记 */}
  <button 
    onClick={() => setView(AppView.DASHBOARD)} 
    className={`px-3 py-2 rounded-xl transition-all duration-200 flex flex-col md:block items-center gap-1 
      ${view === AppView.DASHBOARD 
        ? 'bg-primary/85 text-white shadow-lg shadow-primary/40 scale-103' 
        : 'text-slate-400 hover:bg-slate-100'}`}
  >
    <BookHeart size={22} />
    <span className="text-[10px] font-medium md:hidden">日记</span>
  </button>

  {/* 记录 */}
  <button 
    onClick={() => setView(AppView.NEW_ENTRY)} 
    className={`px-3 py-2 rounded-xl transition-all duration-200 flex flex-col md:block items-center gap-1 
      ${view === AppView.NEW_ENTRY 
        ? 'bg-primary/85 text-white shadow-lg shadow-primary/40 scale-103' 
        : 'text-slate-400 hover:bg-slate-100'}`}
  >
    <Plus size={22} />
    <span className="text-[10px] font-medium md:hidden">记录</span>
  </button>

  {/* 助手 */}
  <button 
    onClick={() => setView(AppView.CHAT)} 
    className={`px-3 py-2 rounded-xl transition-all duration-200 flex flex-col md:block items-center gap-1 
      ${(view === AppView.CHAT || view === AppView.LIVE_SESSION) 
        ? 'bg-primary/85 text-white shadow-lg shadow-primary/40 scale-103' 
        : 'text-slate-400 hover:bg-slate-100'}`}
  >
    <MessageCircle size={22} />
    <span className="text-[10px] font-medium md:hidden">助手</span>
  </button>
</nav>

      {/* Main Content Area */}
      {/* Scrollable logic moved here */}
      <main className={`flex-1 ${isChatView ? 'h-full md:pl-20 overflow-hidden' : 'h-full overflow-y-auto md:pl-20'}`}>
        
        {/* Container inside scrollable area */}
        <div className={!isChatView ? 'max-w-4xl mx-auto p-4 md:p-8 pb-32 md:pb-8' : ''}>

        {/* Dashboard Header */}
        {!isChatView && view !== AppView.SETTINGS && (
            <>
            <SafeTopSpacer />
            <header className="flex justify-between items-center mb-6 relative z-10">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                        <span className="mr-2 inline-block animate-bounce delay-1000">👋</span>
                        {getGreeting()}，{userProfile.name}
                    </h1>
                </div>
                <div 
                    className="cursor-pointer hover:rotate-12 transition-transform md:hidden"
                    onClick={() => setView(AppView.SETTINGS)}
                >
                    <AvatarDisplay avatar={userProfile.avatar} size="md" />
                </div>
            </header>
            </>
        )}

        {view === AppView.DASHBOARD && (
          <div className="space-y-5 animate-fadeIn">
            {/* Daily Joke Widget - Compacted UI */}
            <div className="relative bg-white rounded-3xl p-4 shadow-sm border border-slate-100 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-100 rounded-full -mr-16 -mt-16 blur-3xl opacity-50"></div>
                
                <div className="relative z-10 flex flex-col gap-2">
                     <div className="flex items-center gap-2">
                         <div className="bg-yellow-100 text-yellow-600 p-1 rounded-lg">
                             <Smile size={14} />
                         </div>
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">每日一笑</span>
                     </div>
                     <div 
                        className="bg-slate-50/50 rounded-xl p-3 border border-slate-100/50 flex items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => fetchDailyJoke().then(c => setDailyJoke({...dailyJoke!, content: c}))}
                    >
                        <p className="text-slate-700 text-xs font-medium leading-relaxed">
                            {dailyJoke?.content || "正在加载快乐..."}
                        </p>
                     </div>
                </div>
            </div>

            {/* Calendar Widget (Conditionally Rendered) */}
            {userProfile.showCalendar && (
                <section>
                    <CalendarWidget />
                </section>
            )}

            {/* Mood Chart (Conditionally Rendered) */}
            {userProfile.showMoodChart && (
                <section>
                    <MoodChart entries={entries} />
                </section>
            )}

            <section>
              <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <BookHeart className="w-5 h-5 text-primary" />
                    近期日记
                  </h2>
                  <div className="flex items-center gap-2">
                      
                      {/* Search Bar */}
                      <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="搜索..." 
                                value={searchKeyword}
                                onChange={(e) => setSearchKeyword(e.target.value)}
                                className="pl-8 pr-3 py-1.5 w-24 focus:w-40 bg-white border border-slate-200 rounded-full text-xs transition-all focus:ring-2 focus:ring-primary/20 focus:outline-none placeholder-slate-400"
                            />
                      </div>

                      <div className="w-px h-4 bg-slate-200 mx-1"></div>

                      <button 
                        onClick={() => setShowDateFilter(!showDateFilter)} 
                        className={`p-2 rounded-full transition-all ${showDateFilter || filterDate ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-white'}`}
                      >
                          <Calendar size={18} />
                      </button>
                  </div>
              </div>
              
              {/* Date Filter Input (Expandable) */}
              {showDateFilter && (
                <div className="mb-4 flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 animate-fadeIn shadow-sm">
                    <span className="text-xs text-slate-500 font-bold px-2">按日期筛选:</span>
                    <input 
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="text-xs bg-slate-50 border-none rounded-lg py-1 px-2 focus:ring-0 text-slate-600 outline-none"
                    />
                    {filterDate && (
                        <button onClick={() => setFilterDate('')} className="p-1 hover:bg-slate-100 rounded-full text-slate-400">
                            <X size={14} />
                        </button>
                    )}
                </div>
              )}
              
              <div className="grid gap-4">
                {filteredEntries.length === 0 ? (
                    <div className="text-center py-16 bg-white/50 rounded-3xl border border-slate-100 border-dashed">
                        <div className="text-4xl mb-3 grayscale opacity-50">🍃</div>
                        <p className="text-slate-400 text-sm mb-4">
                            {searchKeyword || filterDate ? "没有找到匹配的日记" : (entries.length === 0 ? "这里还空空的，写下第一篇日记吧~" : "这一天好像在偷懒哦~")}
                        </p>
                        {entries.length === 0 && !searchKeyword && !filterDate && (
                            <button onClick={() => setView(AppView.NEW_ENTRY)} className="px-6 py-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-all text-sm font-bold">
                                开始记录
                            </button>
                        )}
                    </div>
                ) : (
                    filteredEntries.map(entry => (
                    <div 
                        key={entry.id} 
                        onClick={() => setSelectedEntry(entry)}
                        className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-pointer relative"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getMoodColor(entry.moodScore)}`}>
                                    MOOD {entry.moodScore}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium bg-slate-50 px-2 py-1 rounded-full">
                                    {new Date(entry.date).toLocaleDateString('zh-CN')}
                                </span>
                            </div>
                            <Maximize2 size={16} className="text-slate-300 group-hover:text-primary transition-colors" />
                        </div>
                        <p className="text-slate-600 mb-4 text-sm leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all duration-300 whitespace-pre-wrap">
                            {entry.content}
                        </p>
                        
                        {/* Attachments Preview in List */}
                        {entry.attachments && entry.attachments.length > 0 && (
                             <div className="flex gap-2 overflow-x-auto mb-4 pb-2 scrollbar-none">
                                {entry.attachments.map((att, idx) => (
                                    <div key={idx} className="h-16 w-16 rounded-xl overflow-hidden shrink-0 border border-slate-100">
                                        {att.startsWith('data:video') ? (
                                             <video src={att} className="h-full w-full object-cover" />
                                        ) : (
                                             <img src={att} alt="attachment" className="h-full w-full object-cover" />
                                        )}
                                    </div>
                                ))}
                             </div>
                        )}
                        
                        <div className="bg-slate-50/80 p-3 rounded-2xl flex items-start gap-3">
                            <BrainCircuit className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                            <div>
                                <p className="text-xs text-slate-500 italic mb-1.5">"{entry.summary}"</p>
                                <p className="text-xs text-primary font-bold">✨ {entry.advice}</p>
                            </div>
                        </div>
                    </div>
                    ))
                )}
              </div>
            </section>
          </div>
        )}

        {view === AppView.NEW_ENTRY && (
          <div className="max-w-2xl mx-auto animate-fadeIn">
            <SafeTopSpacer />
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-6 bg-primary rounded-full"></div>
                    记录美好此刻
                </div>
                {filterDate && (
                    <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold flex items-center gap-1">
                        <Calendar size={12} />
                        补写: {filterDate}
                        <button onClick={() => { setFilterDate(''); }} className="ml-1 hover:bg-primary/20 rounded-full p-0.5"><X size={10} /></button>
                    </div>
                )}
            </h2>
            <div className="bg-white p-2 rounded-[2rem] shadow-sm border border-slate-100">
                <div className="relative bg-slate-50 rounded-[1.5rem] border border-slate-100/50 transition-colors focus-within:bg-white focus-within:border-primary/20 focus-within:ring-4 focus-within:ring-primary/5">
                    <textarea
                        className="w-full h-64 p-6 text-lg text-slate-700 placeholder-slate-300 border-none focus:outline-none focus:ring-0 resize-none font-medium leading-relaxed bg-transparent"
                        placeholder="今天发生了什么有趣的事？..."
                        value={newEntryText}
                        onChange={(e) => setNewEntryText(e.target.value)}
                        autoFocus={!isRecording}
                    />
                    
                    {/* Attachments Preview Area */}
                    {newEntryAttachments.length > 0 && (
                        <div className="px-6 pb-6 flex gap-3 overflow-x-auto">
                            {newEntryAttachments.map((att, index) => (
                                <div key={index} className="relative w-20 h-20 shrink-0 group">
                                    {att.startsWith('data:video') ? (
                                        <div className="w-full h-full rounded-xl bg-black flex items-center justify-center">
                                            <Video className="text-white w-8 h-8 opacity-50" />
                                        </div>
                                    ) : (
                                        <img src={att} alt="upload" className="w-full h-full object-cover rounded-xl border border-slate-200" />
                                    )}
                                    <button 
                                        onClick={() => removeAttachment(index)}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {isTranscribing && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center rounded-[1.5rem] z-10">
                             <div className="bg-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 text-primary font-bold animate-pulse">
                                <Loader2 className="animate-spin" />
                                正在听你说...
                             </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center p-4 gap-4">
                    {/* Toolbar */}
                    <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
                        {/* Hidden Inputs */}
                        <input type="file" ref={mediaInputRef} accept="image/*,video/*" multiple className="hidden" onChange={handleMediaUpload} />
                        
                        <button 
                            onClick={() => mediaInputRef.current?.click()}
                            className="p-3 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
                            title="上传图片/视频"
                        >
                            <ImageIcon size={20} />
                        </button>
                         <button 
                            onClick={() => startCamera()}
                            className="p-3 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
                            title="拍摄"
                        >
                            <Camera size={20} />
                        </button>
                        
                        <div className="h-8 w-px bg-slate-200 mx-1"></div>

                        <button 
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
                                isRecording 
                                ? 'bg-red-50 text-red-500 ring-2 ring-red-100' 
                                : 'hover:bg-slate-100 text-slate-500'
                            }`}
                        >
                            {isRecording ? <StopCircle size={20} className="animate-pulse" /> : <Mic size={20} />}
                            <span className="text-sm font-medium whitespace-nowrap">{isRecording ? "停止录音" : "语音输入"}</span>
                        </button>
                    </div>

                    <button 
                        onClick={handleSaveEntry}
                        disabled={isAnalyzing || (!newEntryText.trim() && newEntryAttachments.length === 0) || isRecording || isTranscribing}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-primary text-white rounded-full hover:brightness-110 disabled:opacity-50 disabled:grayscale transition-all shadow-lg shadow-primary/30 font-bold"
                    >
                        {isAnalyzing ? (
                            <>
                                <Loader2 className="animate-spin w-5 h-5" />
                                <span>分析中...</span>
                            </>
                        ) : (
                            <>
                                <span>保存日记</span>
                                <ChevronRight size={18} />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
        )}

        {view === AppView.SETTINGS && (
            <div className="max-w-md mx-auto animate-fadeIn">
                 <SafeTopSpacer />
                 <div className="flex items-center gap-4 mb-6">
                     <button onClick={() => setView(AppView.DASHBOARD)} className="p-2 -ml-2 rounded-full hover:bg-white/50 text-slate-500">
                         <ChevronRight className="rotate-180" size={24} />
                     </button>
                     <h2 className="text-xl font-bold text-slate-800">设置</h2>
                 </div>
                
                <div className="space-y-4">
                    {/* Personal Info */}
                    <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 relative z-10">
                            <User size={16} className="text-primary" />
                            个人档案
                        </h3>
                        
                        <div className="space-y-4 relative z-10">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">头像</label>
                                
                                {/* Updated Avatar Section - Removed inline confirm */}
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="relative">
                                        <AvatarDisplay avatar={userProfile.avatar} size="lg" className="ring-2 ring-slate-50" />
                                    </div>
                                    <div className="flex-1">
                                         <div className="grid grid-cols-6 gap-1">
                                             {AVATARS.slice(0, 6).map(avatar => (
                                                 <button 
                                                     key={avatar}
                                                     onClick={() => setUserProfile({...userProfile, avatar})}
                                                     className={`aspect-square flex items-center justify-center text-base rounded-lg transition-all ${userProfile.avatar === avatar ? 'bg-primary/10 ring-1 ring-primary scale-110' : 'bg-slate-50 hover:bg-slate-100'}`}
                                                 >
                                                     {avatar}
                                                 </button>
                                             ))}
                                         </div>
                                    </div>
                                </div>
                                
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    ref={fileInputRef} 
                                    onChange={handleAvatarUpload} 
                                    className="hidden" 
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-slate-200 rounded-xl text-slate-500 hover:border-primary hover:text-primary transition-colors text-xs font-bold"
                                    >
                                        <Upload size={14} />
                                        <span>上传图片</span>
                                    </button>
                                    <button 
                                        onClick={() => startCamera('user')}
                                        className="flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-slate-200 rounded-xl text-slate-500 hover:border-primary hover:text-primary transition-colors text-xs font-bold"
                                    >
                                        <Camera size={14} />
                                        <span>拍摄头像</span>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">昵称</label>
                                <input 
                                    type="text"
                                    value={userProfile.name}
                                    onChange={(e) => setUserProfile({...userProfile, name: e.target.value})}
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-primary/20 text-slate-700 text-sm font-medium"
                                    placeholder="输入你的昵称"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Appearance */}
                    <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent/5 rounded-full -ml-10 -mb-10 blur-2xl"></div>
                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 relative z-10">
                            <Palette size={16} className="text-primary" />
                            主题与功能
                        </h3>
                        
                        <div className="grid grid-cols-5 gap-3 relative z-10 mb-6">
                            {PRESET_COLORS.map((color) => (
                                <button
                                    key={color.hex}
                                    onClick={() => setUserProfile({...userProfile, themeColor: color.hex})}
                                    className={`flex flex-col items-center gap-1.5 p-1.5 rounded-xl border-2 transition-all ${
                                        userProfile.themeColor === color.hex
                                        ? 'border-primary bg-primary/5 scale-105' 
                                        : 'border-transparent hover:bg-slate-50'
                                    }`}
                                >
                                    <div 
                                        className="w-8 h-8 rounded-full shadow-sm" 
                                        style={{ backgroundColor: color.hex }}
                                    />
                                    <span className={`text-[9px] font-bold ${userProfile.themeColor === color.hex ? 'text-primary' : 'text-slate-400'}`}>
                                        {color.name}
                                    </span>
                                </button>
                            ))}
                            {/* Custom Color Picker Button */}
                            <label className={`flex flex-col items-center gap-1.5 p-1.5 rounded-xl border-2 transition-all cursor-pointer ${
                                !PRESET_COLORS.some(c => c.hex === userProfile.themeColor)
                                ? 'border-primary bg-primary/5 scale-105' 
                                : 'border-transparent hover:bg-slate-50'
                            }`}>
                                <div className="w-8 h-8 rounded-full shadow-sm bg-gradient-to-br from-red-400 via-green-400 to-blue-400 flex items-center justify-center text-white">
                                    <Pipette size={14} />
                                </div>
                                <span className={`text-[9px] font-bold ${!PRESET_COLORS.some(c => c.hex === userProfile.themeColor) ? 'text-primary' : 'text-slate-400'}`}>
                                    自定义
                                </span>
                                <input 
                                    type="color" 
                                    className="sr-only"
                                    value={userProfile.themeColor}
                                    onChange={(e) => setUserProfile({...userProfile, themeColor: e.target.value})}
                                />
                            </label>
                        </div>

                         <div className="space-y-4 border-t border-slate-100 pt-4 relative z-10">
                             <div className="flex items-center justify-between">
                                 <div>
                                     <h4 className="text-xs font-bold text-slate-700">显示心情趋势</h4>
                                     <p className="text-[10px] text-slate-400">在首页展示心情变化曲线</p>
                                 </div>
                                 <button 
                                    onClick={() => setUserProfile(p => ({ ...p, showMoodChart: !p.showMoodChart }))}
                                    className={`w-10 h-5 rounded-full p-1 transition-colors ${userProfile.showMoodChart ? 'bg-primary' : 'bg-slate-200'}`}
                                 >
                                     <div className={`w-3 h-3 bg-white rounded-full transition-transform ${userProfile.showMoodChart ? 'translate-x-5' : 'translate-x-0'}`} />
                                 </button>
                             </div>
                             
                             <div className="flex items-center justify-between">
                                 <div>
                                     <h4 className="text-xs font-bold text-slate-700">显示日历视图</h4>
                                     <p className="text-[10px] text-slate-400">在首页展示月度记录日历</p>
                                 </div>
                                 <button 
                                    onClick={() => setUserProfile(p => ({ ...p, showCalendar: !p.showCalendar }))}
                                    className={`w-10 h-5 rounded-full p-1 transition-colors ${userProfile.showCalendar ? 'bg-primary' : 'bg-slate-200'}`}
                                 >
                                     <div className={`w-3 h-3 bg-white rounded-full transition-transform ${userProfile.showCalendar ? 'translate-x-5' : 'translate-x-0'}`} />
                                 </button>
                             </div>
                         </div>
                    </div>

                    <div className="text-center pt-2">
                         <button 
                            onClick={() => setClearDataStep(1)}
                            className="text-red-400 text-[10px] hover:text-red-500 underline"
                         >
                             清除所有数据
                         </button>
                    </div>
                    
                    <div className="text-center text-slate-300 text-[10px] pb-2">
                        Mindful Moments v1.6 &bull; Made with 💖 & Gemini
                    </div>
                </div>
            </div>
        )}
        
        </div> {/* End of scrollable inner container */}
      </main>

      {/* Chat View Rendering - already handled above, but ensuring logic flow */}
      {view === AppView.CHAT && (
            <div className="h-full w-full animate-fadeIn md:p-6 md:pb-6 pb-24 md:h-screen flex flex-col box-border absolute top-0 left-0 bg-white">
                 <ChatAssistant entries={entries} onStartLiveSession={() => setView(AppView.LIVE_SESSION)} />
            </div>
        )}

    </div>
  );
};