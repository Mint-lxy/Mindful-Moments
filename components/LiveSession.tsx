
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { LiveServerMessage, Modality } from '@google/genai';
import { getLiveClient } from '../services/geminiService';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../services/audioUtils';
import { Mic, MicOff, X } from 'lucide-react';

interface LiveSessionProps {
  onClose: () => void;
}

export const LiveSession: React.FC<LiveSessionProps> = ({ onClose }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visualizerData, setVisualizerData] = useState<number[]>(new Array(5).fill(10));
  
  // Audio Context Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<Promise<any> | null>(null); 
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Visualization Loop
  const requestRef = useRef<number | null>(null);

  const cleanupAudio = useCallback(() => {
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
        sourcesRef.current.forEach(source => {
            try { source.stop(); } catch(e) {}
        });
        sourcesRef.current.clear();
        outputAudioContextRef.current.close();
        outputAudioContextRef.current = null;
    }
    if (sessionRef.current) {
        sessionRef.current.then(session => session.close()).catch(() => {});
        sessionRef.current = null;
    }
    if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
    }
  }, []);

  const connectToLive = async () => {
    try {
      setError(null);
      const InputContext = window.AudioContext || (window as any).webkitAudioContext;
      const OutputContext = window.AudioContext || (window as any).webkitAudioContext;
      
      inputAudioContextRef.current = new InputContext({ sampleRate: 16000 });
      outputAudioContextRef.current = new OutputContext({ sampleRate: 24000 });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const liveClient = getLiveClient();

      const sessionPromise = liveClient.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "你是一位温暖、富有同理心的心理咨询师和倾听者。请用中文进行对话。保持回答简洁、像朋友一样自然且支持性强。使用舒缓的语气。",
          speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          }
        },
        callbacks: {
          onopen: () => {
            console.log("Live Session Connected");
            setIsConnected(true);
            
            if (!inputAudioContextRef.current || !streamRef.current) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
            sourceNodeRef.current = source;
            
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              if (isMuted) return;
              
              const inputData = e.inputBuffer.getChannelData(0);
              // Calculate volume for visualizer
              let sum = 0;
              for(let i=0; i<inputData.length; i+=100) sum += Math.abs(inputData[i]);
              const avg = sum / (inputData.length/100);
              
              if (Math.random() > 0.8) {
                 setVisualizerData(prev => [...prev.slice(1), avg * 50 + 10]);
              }

              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(session => {
                  session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(processor);
            processor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
             const interrupted = message.serverContent?.interrupted;
             if (interrupted) {
                console.log("Interrupted");
                sourcesRef.current.forEach(source => {
                    try { source.stop(); } catch(e) {}
                });
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                return;
             }

             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio && outputAudioContextRef.current) {
                const ctx = outputAudioContextRef.current;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                
                try {
                    const audioBuffer = await decodeAudioData(
                        base64ToUint8Array(base64Audio),
                        ctx,
                        24000,
                        1
                    );
                    
                    const source = ctx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(ctx.destination);
                    source.onended = () => sourcesRef.current.delete(source);
                    
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += audioBuffer.duration;
                    sourcesRef.current.add(source);

                    setVisualizerData(prev => [...prev.slice(1), 40 + Math.random() * 20]);
                } catch (e) {
                    console.error("Audio decode error", e);
                }
             }
          },
          onclose: () => {
            console.log("Live Session Closed");
            setIsConnected(false);
          },
          onerror: (err) => {
            console.error("Live Session Error", err);
            setError("连接错误，请重试。");
            setIsConnected(false);
          }
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (err) {
      console.error("Setup failed", err);
      setError("无法访问麦克风或连接失败。");
    }
  };

  useEffect(() => {
    connectToLive();
    return cleanupAudio;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-indigo-900 to-purple-900 text-white animate-fadeIn safe-area-bottom">
      {/* Top Bar with Safe Area and Spacer for consistent alignment */}
      <div className="w-full flex flex-col">
          <div className="safe-area-top"></div>
          <div className="h-12 w-full flex-shrink-0"></div> {/* Spacer to match other pages */}
          
          <div className="px-6 flex justify-end">
              <button 
                onClick={onClose} 
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
              >
                <X size={24} />
              </button>
          </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center space-y-12 px-4 -mt-20">
        <div className="text-center space-y-2">
            <h2 className="text-3xl font-light tracking-wide">实时疗愈通话</h2>
            <p className="text-white/60">{isConnected ? "正在聆听..." : "正在连接..."}</p>
        </div>

        {/* Dynamic Visualizer */}
        <div className="relative h-64 w-64 flex items-center justify-center">
            <div className={`absolute top-0 left-0 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob ${!isConnected ? 'paused' : ''}`}></div>
            <div className={`absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-2xl opacity-30 animate-blob animation-delay-2000 ${!isConnected ? 'paused' : ''}`}></div>
            
            <div className="relative z-10 flex items-center justify-center space-x-2">
                {visualizerData.map((h, i) => (
                    <div 
                        key={i} 
                        className="w-4 bg-white rounded-full transition-all duration-100 ease-in-out shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                        style={{ height: `${Math.max(10, h)}px` }}
                    />
                ))}
            </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-6 w-full">
            <button 
                onClick={toggleMute}
                className={`p-6 rounded-full transition-all duration-300 shadow-xl ${isMuted ? 'bg-red-500 text-white' : 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm'}`}
            >
                {isMuted ? <MicOff size={32} /> : <Mic size={32} />}
            </button>
            <span className="text-sm text-white/50">{isMuted ? "已静音" : "点击麦克风静音"}</span>
            
            {error && (
                <div className="bg-red-500/80 px-4 py-2 rounded-lg text-sm backdrop-blur-md">
                    {error}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
