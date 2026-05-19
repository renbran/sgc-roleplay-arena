'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, Phone, PhoneOff, BarChart3, Users, Target,
  ChevronRight, Star, Clock, TrendingUp, AlertTriangle,
  CheckCircle2, XCircle, Zap, Shield, Building2, MapPin,
  ArrowRight, RefreshCw, Volume2, VolumeX,
  Info, Sparkles, Headphones, MessageSquare, Award,
  BookOpen, Play, StopCircle, Pause, Send, Type,
  MessageCircle, Bot, CornerDownLeft, Lock, Eye, EyeOff, LogOut,
  PanelRightOpen, Keyboard, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PERSONAS, DIFFICULTY_CONFIG, type Persona } from "@/lib/personas";
import { useIsMobile } from "@/hooks/use-mobile";

// ─── Auth Config ────────────────────────────────────────────────────────────

const AUTH_STORAGE_KEY = "sgc-roleplay-auth";
const APP_PASSWORD = "SGC2025";

// ─── Persona Type Mapping ────────────────────────────────────────────────────

const PERSONA_TYPES: Record<string, "decision-maker" | "gatekeeper" | "influencer"> = {
  p1_faisal: "decision-maker",
  p2_noura: "decision-maker",
  p3_omar: "influencer",
  p4_rajesh: "decision-maker",
  p5_imran: "influencer",
  p6_vikram: "influencer",
  p7_sarah: "decision-maker",
  p8_michael: "influencer",
  p9_andrew: "decision-maker",
  p10_maricel: "gatekeeper",
  p11_dana: "gatekeeper",
  p12_tariq: "influencer",
  p13_fatima: "gatekeeper",
};

const PERSONA_TYPE_CONFIG = {
  "decision-maker": { label: "Decision Maker", color: "bg-slate-100 text-slate-700 border-slate-200", icon: "👑" },
  "gatekeeper": { label: "Gatekeeper", color: "bg-amber-100 text-amber-700 border-amber-200", icon: "🛡️" },
  "influencer": { label: "Influencer", color: "bg-sky-100 text-sky-700 border-sky-200", icon: "🎯" },
} as const;

// ─── Avatar Component ────────────────────────────────────────────────────────

function PersonaAvatar({ src, alt, size = "md" }: { src: string; alt: string; size?: "xs" | "sm" | "md" | "lg" | "xl" }) {
  const sizeMap = {
    xs: { container: "w-5 h-5", img: 20 },
    sm: { container: "w-6 h-6", img: 24 },
    md: { container: "w-10 h-10", img: 40 },
    lg: { container: "w-12 h-12", img: 48 },
    xl: { container: "w-28 h-28", img: 112 },
  };
  const s = sizeMap[size];
  return (
    <div className={`${s.container} rounded-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 shrink-0`}>
      <Image src={src} alt={alt} width={s.img} height={s.img} className="w-full h-full object-cover" unoptimized />
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

type AppView = "dashboard" | "select" | "roleplay" | "history";
type RoleplayMode = "text" | "voice";
type RoleplayStatus = "idle" | "active" | "ended" | "error";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

interface SessionRecord {
  id: string;
  personaId: string;
  roomName: string;
  status: string;
  duration: number;
  rating?: number;
  outcome?: string;
  feedback?: string;
  createdAt: string;
}

// ─── Main App ────────────────────────────────────────────────────────────────

export default function Home() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [view, setView] = useState<AppView>("dashboard");
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [mode, setMode] = useState<RoleplayMode>("text");
  const [roleplayStatus, setRoleplayStatus] = useState<RoleplayStatus>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showTips, setShowTips] = useState(true);
  const [sessionNotes, setSessionNotes] = useState("");
  const [callTimer, setCallTimer] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const isMobile = useIsMobile();
  const [inputMode, setInputMode] = useState<"text" | "voice">("text");
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Text chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string>("");
  const [conversationStage, setConversationStage] = useState<string>("guarded");

  // TTS state
  const [playingMessageIdx, setPlayingMessageIdx] = useState<number | null>(null);
  const [ttsLoading, setTtsLoading] = useState<number | null>(null);
  const [autoVoice, setAutoVoice] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsWarmedUp = useRef(false);
  const audioUnlockedRef = useRef(false);
  const currentAudioUrlRef = useRef<string | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);

  // Microphone recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const silenceStartRef = useRef<number>(0);
  const recordingStartRef = useRef<number>(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isStoppingRef = useRef(false);

  // Session end state
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [endOutcome, setEndOutcome] = useState<"won" | "partial" | "lost">("partial");
  const [endNotes, setEndNotes] = useState("");
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);

  // ─── Auth Check ────────────────────────────────────────────────────────────

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    if (authPassword === APP_PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem(AUTH_STORAGE_KEY, "true");
      setAuthError("");
    } else {
      setAuthError("Invalid password. Please try again.");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthPassword("");
  };

  // ─── Audio Unlock (for mobile browsers) ──────────────────────────────────
  // Mobile browsers require a user gesture before audio can play.
  // We unlock audio on the first tap/click anywhere on the page.
  useEffect(() => {
    const unlock = () => {
      if (audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;
      // Create and immediately play/pause a silent audio to unlock the audio pipeline
      const audio = new Audio();
      audio.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAgAAAbAAkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQ//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYgFssGAAAAAAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAgAAAbAAkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQ//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYgFssGAAAAAAAAAAAAAAAAAAAA';
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        console.log('[audio] Audio pipeline unlocked');
      }).catch(() => { /* unlock failed, will try again on next interaction */ });
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('click', unlock, { once: false });
    document.addEventListener('touchstart', unlock, { once: false });
    document.addEventListener('keydown', unlock, { once: false });
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  // ─── TTS Warmup ──────────────────────────────────────────────────────────

  // Pre-warm the TTS service when authenticated so first call is fast
  useEffect(() => {
    if (isAuthenticated && !ttsWarmedUp.current) {
      ttsWarmedUp.current = true;
      fetch("/api/roleplay/tts", { method: "GET" })
        .then(res => res.json())
        .then(data => console.log("[tts] warmup:", data.warmup ? "success" : "failed"))
        .catch(() => { /* warmup failure is non-critical */ });
    }
  }, [isAuthenticated]);

  // ─── Stop current TTS ───────────────────────────────────────────────────────

  const stopTTS = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }
    setPlayingMessageIdx(null);
    setIsAudioPlaying(false);
    setTtsLoading(null);
  }, []);

  // ─── TTS Playback ───────────────────────────────────────────────────────────

  const playTTS = useCallback(async (text: string, messageIdx: number) => {
    // If clicking the same message that's playing, stop it
    if (playingMessageIdx === messageIdx) {
      stopTTS();
      return;
    }

    // Stop any current audio
    stopTTS();
    setTtsLoading(messageIdx);
    setTtsError(null);

    try {
      console.log(`[tts] Requesting TTS for message ${messageIdx}, text length: ${text.length}`);

      const res = await fetch("/api/roleplay/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 1024), voice: "kazi" }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error || `HTTP ${res.status}`;
        console.warn("[tts] TTS request failed:", errMsg);
        setTtsLoading(null);
        setTtsError(errMsg);
        return;
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('audio') && !contentType.includes('mpeg')) {
        console.warn("[tts] Unexpected content type:", contentType);
        setTtsLoading(null);
        setTtsError('Invalid audio response');
        return;
      }

      const audioBlob = await res.blob();
      if (audioBlob.size < 100) {
        console.warn("[tts] TTS returned empty audio, size:", audioBlob.size);
        setTtsLoading(null);
        setTtsError('Empty audio response');
        return;
      }

      console.log(`[tts] Got audio blob: ${audioBlob.size} bytes, type: ${audioBlob.type}`);

      const audioUrl = URL.createObjectURL(audioBlob);
      currentAudioUrlRef.current = audioUrl;

      const audio = new Audio();
      audio.preload = 'auto';
      audio.volume = 1.0;
      audio.src = audioUrl;
      audioRef.current = audio;

      // Set up event handlers before playing
      audio.oncanplaythrough = () => {
        console.log('[tts] Audio can play through');
      };

      audio.onended = () => {
        console.log('[tts] Audio playback ended');
        setPlayingMessageIdx(null);
        setIsAudioPlaying(false);
        if (currentAudioUrlRef.current) {
          URL.revokeObjectURL(currentAudioUrlRef.current);
          currentAudioUrlRef.current = null;
        }
      };

      audio.onerror = (e) => {
        console.error('[tts] Audio playback error:', e, 'src:', audio.src?.substring(0, 50));
        stopTTS();
        setTtsError('Audio playback failed');
      };

      setPlayingMessageIdx(messageIdx);
      setIsAudioPlaying(true);
      setTtsLoading(null);

      // Attempt to play - handle autoplay restrictions
      try {
        await audio.play();
        console.log('[tts] Audio playing successfully');
      } catch (playErr: any) {
        const errName = playErr?.name || '';
        if (errName === 'NotAllowedError') {
          console.warn('[tts] Autoplay blocked - user interaction required');
          // Don't fully stop - let user click again to retry
          setPlayingMessageIdx(null);
          setIsAudioPlaying(false);
          setTtsError('Tap again to play audio');
        } else {
          console.error('[tts] Play error:', playErr);
          stopTTS();
          setTtsError('Audio playback error');
        }
      }
    } catch (err) {
      console.error('[tts] TTS error:', err);
      stopTTS();
      setTtsError('Voice unavailable');
    }
  }, [playingMessageIdx, stopTTS]);

  // ─── Microphone Recording ───────────────────────────────────────────────────

  const sendChatMessageWithText = useCallback(async (text: string) => {
    if (!text.trim() || !selectedPersona || isChatLoading || isRecording) return;
    const userMsg = text.trim();
    setInputMode("text");
    setChatMessages(prev => [...prev, { role: "user", content: userMsg, timestamp: Date.now() }]);
    setIsChatLoading(true);

    try {
      const res = await fetch("/api/roleplay/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: chatSessionId, message: userMsg, personaId: selectedPersona.id }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.stage) {
          setConversationStage(data.stage);
        }
        setChatMessages(prev => {
          const newMessages = [...prev, { role: "assistant", content: data.response, timestamp: Date.now() }];
          if (autoVoice && audioUnlockedRef.current) {
            const idx = newMessages.length - 1;
            // Short delay to ensure DOM update and audio pipeline is ready
            setTimeout(() => playTTS(data.response, idx), 300);
          }
          return newMessages;
        });
      } else {
        setChatMessages(prev => [...prev, { role: "system", content: `Error: ${data.error}`, timestamp: Date.now() }]);
      }
    } catch {
      setChatMessages(prev => [...prev, { role: "system", content: "Connection error. Please try again.", timestamp: Date.now() }]);
    }
    setIsChatLoading(false);
  }, [selectedPersona, isChatLoading, chatSessionId, autoVoice, playTTS, isRecording]);

  // ─── Voice Activity Detection (VAD) ─────────────────────────────────────────

  const SILENCE_THRESHOLD = 6;
  const SILENCE_DURATION = 3500;
  const MIN_RECORDING_DURATION = 1200;
  const MAX_RECORDING_DURATION = 120000;
  const SPEECH_DETECTION_INTERVAL = 150;

  const cleanupRecording = useCallback(() => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { audioContextRef.current.close(); } catch { /* ignore */ }
    }
    audioContextRef.current = null;
    analyserRef.current = null;
  }, []);

  const processRecordedAudio = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    const chunks = [...audioChunksRef.current];
    audioChunksRef.current = [];

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }

    cleanupRecording();

    const duration = Date.now() - recordingStartRef.current;
    if (duration < MIN_RECORDING_DURATION || chunks.length === 0) {
      setIsRecording(false);
      setRecordingDuration(0);
      isStoppingRef.current = false;
      return;
    }

    setIsRecording(false);
    setRecordingDuration(0);

    try {
      const audioBlob = new Blob(chunks, { type: "audio/webm" });

      if (audioBlob.size < 1000) {
        isStoppingRef.current = false;
        return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(",")[1];
        if (!base64Audio) {
          isStoppingRef.current = false;
          return;
        }

        try {
          const res = await fetch("/api/roleplay/asr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audio: base64Audio }),
          });
          const data = await res.json();
          if (data.success && data.text && data.text.trim()) {
            sendChatMessageWithText(data.text.trim());
          }
        } catch (err) {
          console.error("ASR error:", err);
        } finally {
          isStoppingRef.current = false;
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (err) {
      console.error("Audio processing error:", err);
      isStoppingRef.current = false;
    }
  }, [cleanupRecording, sendChatMessageWithText]);

  const stopRecording = useCallback(() => {
    if (isStoppingRef.current) return;
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    } else {
      setIsRecording(false);
      setRecordingDuration(0);
      cleanupRecording();
    }
  }, [cleanupRecording]);

  const startRecording = useCallback(async () => {
    if (isAudioPlaying || playingMessageIdx !== null) return;
    if (isRecording || isStoppingRef.current) return;
    if (isChatLoading) return;
    if (chatInput.trim()) return;
    setInputMode("voice");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      micStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      isStoppingRef.current = false;
      silenceStartRef.current = 0;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = () => {
        console.error("MediaRecorder error");
        stopRecording();
      };

      mediaRecorder.onstop = () => {
        processRecordedAudio();
      };

      try {
        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.fftSize);
        let hasDetectedSpeech = false;

        vadIntervalRef.current = setInterval(() => {
          if (!analyserRef.current || isStoppingRef.current) {
            if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
            return;
          }

          analyserRef.current.getByteTimeDomainData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const val = (dataArray[i] - 128) / 128;
            sum += val * val;
          }
          const rms = Math.sqrt(sum / dataArray.length) * 128;

          const now = Date.now();
          const elapsed = now - recordingStartRef.current;

          if (rms > SILENCE_THRESHOLD) {
            hasDetectedSpeech = true;
            silenceStartRef.current = 0;
          } else if (hasDetectedSpeech && silenceStartRef.current === 0) {
            silenceStartRef.current = now;
          }

          if (hasDetectedSpeech && silenceStartRef.current > 0 && (now - silenceStartRef.current) > SILENCE_DURATION) {
            if (elapsed > MIN_RECORDING_DURATION) {
              stopRecording();
            }
          }

          if (elapsed > MAX_RECORDING_DURATION) {
            stopRecording();
          }
        }, SPEECH_DETECTION_INTERVAL);
      } catch (vadErr) {
        console.warn("VAD setup failed, using timer-only mode:", vadErr);
        setTimeout(() => {
          if (mediaRecorderRef.current?.state === "recording") {
            stopRecording();
          }
        }, MAX_RECORDING_DURATION);
      }

      mediaRecorder.start(250);
      recordingStartRef.current = Date.now();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(Math.round((Date.now() - recordingStartRef.current) / 1000));
      }, 500);

    } catch (err) {
      console.error("Microphone access error:", err);
      setIsRecording(false);
    }
  }, [isAudioPlaying, playingMessageIdx, isRecording, isChatLoading, chatInput, stopRecording, processRecordedAudio]);

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      if (data.sessions) setSessions(data.sessions);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchSessions();
  }, [fetchSessions, isAuthenticated]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Cleanup recording resources on unmount or view change
  useEffect(() => {
    return () => {
      cleanupRecording();
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [cleanupRecording]);

  // Timer for active calls
  useEffect(() => {
    if (roleplayStatus === "active") {
      timerRef.current = setInterval(() => {
        setCallTimer(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [roleplayStatus]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ─── Roleplay Actions ───────────────────────────────────────────────────────

  const startTextRoleplay = (persona: Persona) => {
    setSelectedPersona(persona);
    setMode("text");
    setInputMode("text");
    setView("roleplay");
    setRoleplayStatus("active");
    setCallTimer(0);
    setError(null);
    setSessionNotes("");
    setSessionStartTime(Date.now());
    setShowEndDialog(false);
    const sid = `chat-${persona.id}-${Date.now()}`;
    setChatSessionId(sid);
    setConversationStage("guarded");
    const openingMsg = { role: "assistant" as const, content: persona.openingLine, timestamp: Date.now() };
    setChatMessages([
      { role: "system", content: `You are now in a sales roleplay with ${persona.name}. Ask great questions to discover their pain points.`, timestamp: Date.now() },
      openingMsg,
    ]);
    // Don't auto-play TTS on start - let user click the speaker button
    setTimeout(() => chatInputRef.current?.focus(), 300);
  };

  const startVoiceRoleplay = (persona: Persona) => {
    setSelectedPersona(persona);
    setMode("voice");
    setInputMode("voice");
    setView("roleplay");
    setRoleplayStatus("active");
    setCallTimer(0);
    setError(null);
    setSessionNotes("");
    setSessionStartTime(Date.now());
    setShowEndDialog(false);
    setAutoVoice(true);
    const sid = `voice-${persona.id}-${Date.now()}`;
    setChatSessionId(sid);
    setSessionId(sid);
    setConversationStage("guarded");
    const openingMsg = { role: "assistant" as const, content: persona.openingLine, timestamp: Date.now() };
    setChatMessages([
      { role: "system", content: `Voice call with ${persona.name}. Tap the mic button to speak, or type your message.`, timestamp: Date.now() },
      openingMsg,
    ]);
    // Don't auto-play TTS on start - warmup may not be complete
    // User can click the speaker button on the opening message
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !selectedPersona || isChatLoading || isRecording) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    await sendChatMessageWithText(userMsg);
    if (!isMobile) chatInputRef.current?.focus();
  };

  const endRoleplay = async (outcome?: string) => {
    stopTTS();

    if (isRecording) {
      stopRecording();
    }
    cleanupRecording();

    if (sessionId) {
      try {
        await fetch("/api/sessions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, status: "completed", duration: callTimer, outcome: outcome || "partial", notes: sessionNotes }),
        });
      } catch { /* ignore */ }
    }

    setRoleplayStatus("ended");
    fetchSessions();
  };

  const handleEndSession = () => {
    setShowEndDialog(true);
  };

  const handleSaveEndSession = async () => {
    await endRoleplay(endOutcome);
    setShowEndDialog(false);
    setView("dashboard");
    setRoleplayStatus("idle");
  };

  const getDiffBadge = (difficulty: "easy" | "medium" | "hard") => {
    const config = DIFFICULTY_CONFIG[difficulty];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor} ${config.borderColor} border`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.color}`} />
        {config.label}
      </span>
    );
  };

  const getPersonaTypeBadge = (personaId: string) => {
    const type = PERSONA_TYPES[personaId] || "influencer";
    const config = PERSONA_TYPE_CONFIG[type];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
        <span>{config.icon}</span>
        {config.label}
      </span>
    );
  };

  // ─── RENDER: Login Gate ────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L2c+PC9zdmc+')] opacity-50" />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md relative z-10"
        >
          <Card className="border-slate-700 bg-slate-800/80 backdrop-blur-sm shadow-2xl">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-xl bg-white/10 p-2 flex items-center justify-center">
                  <Image src="/sgc-tech-logo.png" alt="SGC TECH" width={48} height={48} className="rounded-lg" />
                </div>
              </div>
              <CardTitle className="text-xl text-white">SGC TECH Roleplay Arena</CardTitle>
              <CardDescription className="text-slate-400">
                Enter your access password to continue
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={authPassword}
                    onChange={e => { setAuthPassword(e.target.value); setAuthError(""); }}
                    onKeyDown={e => { if (e.key === "Enter") handleLogin(); }}
                    className="pl-10 pr-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500"
                    autoFocus
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {authError && (
                  <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-red-400 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> {authError}
                  </motion.p>
                )}
              </div>
              <Button onClick={handleLogin} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2" size="lg">
                <Shield className="w-4 h-4" /> Access Arena
              </Button>
            </CardContent>
            <CardFooter className="justify-center pb-4">
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Secured access — authorized personnel only
              </p>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ─── RENDER: Dashboard ─────────────────────────────────────────────────────

  const renderDashboard = () => (
    <div className="space-y-6 md:space-y-8">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-12">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L2c+PC9zdmc+')] opacity-50" />
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <Image src="/sgc-tech-logo.png" alt="SGC TECH" width={48} height={48} className="rounded-lg drop-shadow-lg md:w-14 md:h-14" />
            <div className="flex flex-col">
              <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/20 border-white/20 w-fit mb-1">AI-Powered</Badge>
              <span className="text-white/60 text-xs tracking-widest uppercase">Sales Roleplay Arena</span>
            </div>
          </div>
          <h1 className="text-2xl md:text-4xl font-bold text-white mb-3">SGC TECH <span className="text-white/60 font-normal">Roleplay Arena</span></h1>
          <p className="text-slate-300 text-base md:text-lg max-w-2xl mb-6">
            Practice your sales pitch against AI-powered buyer personas. Text chat with voice playback or immersive voice calls.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={() => setView("select")} className="bg-white text-slate-900 hover:bg-slate-100 gap-2">
              <Play className="w-5 h-5" /> Start Roleplay
            </Button>
            <Button size="lg" variant="outline" onClick={() => setView("history")} className="border-white/20 text-white hover:bg-white/10 gap-2">
              <BarChart3 className="w-5 h-5" /> History
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: "Personas", value: PERSONAS.length, icon: Users, color: "text-slate-700" },
          { label: "Sessions", value: sessions.length, icon: CheckCircle2, color: "text-emerald-600" },
          { label: "Wins", value: sessions.filter(s => s.outcome === "won").length, icon: Award, color: "text-amber-600" },
          { label: "Win Rate", value: sessions.filter(s => s.status === "completed").length > 0
            ? `${Math.round(sessions.filter(s => s.outcome === "won").length / sessions.filter(s => s.status === "completed").length * 100)}%`
            : "0%", icon: TrendingUp, color: "text-rose-600" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i, duration: 0.4 }}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-3 md:p-4">
                <stat.icon className={`w-4 h-4 md:w-5 md:h-5 ${stat.color} mb-1.5`} />
                <div className="text-xl md:text-2xl font-bold">{stat.value}</div>
                <div className="text-[11px] md:text-xs text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Start */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg md:text-xl font-semibold">Quick Start</h2>
          <Button variant="ghost" size="sm" onClick={() => setView("select")} className="gap-1">View All <ChevronRight className="w-4 h-4" /></Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {PERSONAS.slice(0, 3).map((persona, i) => (
            <motion.div key={persona.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * i, duration: 0.4 }}>
              <Card className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5 group" onClick={() => startTextRoleplay(persona)}>
                <CardHeader className="pb-2 md:pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 md:gap-3">
                      <PersonaAvatar src={persona.avatar} alt={persona.name} size="md" />
                      <div className="min-w-0">
                        <CardTitle className="text-sm md:text-base group-hover:text-primary transition-colors truncate">{persona.name}</CardTitle>
                        <CardDescription className="text-[11px] md:text-xs truncate">{persona.title}</CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 items-end shrink-0">
                      {getDiffBadge(persona.difficulty)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-2 md:pb-3">
                  <div className="flex items-center gap-2 text-[11px] md:text-xs text-muted-foreground mb-2">
                    <Building2 className="w-3 h-3" />{persona.company}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {persona.tags.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <div className="w-full flex items-center justify-between">
                    <span className="text-[11px] md:text-xs text-muted-foreground italic line-clamp-1">&ldquo;{persona.openingLine}&rdquo;</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform shrink-0" />
                  </div>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div>
        <h2 className="text-lg md:text-xl font-semibold mb-4">How It Works</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            { step: "1", title: "Choose", desc: "Pick a buyer persona", icon: Users },
            { step: "2", title: "Start", desc: "Text chat or voice call", icon: MessageCircle },
            { step: "3", title: "Navigate", desc: "Handle real objections", icon: Shield },
            { step: "4", title: "Improve", desc: "Track your performance", icon: TrendingUp },
          ].map((item, i) => (
            <motion.div key={item.step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + 0.1 * i, duration: 0.4 }}>
              <Card className="h-full"><CardContent className="p-3 md:p-4 text-center">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 md:mb-3"><item.icon className="w-4 h-4 md:w-5 md:h-5 text-slate-700" /></div>
                <div className="text-[10px] md:text-xs font-medium text-muted-foreground mb-0.5">Step {item.step}</div>
                <div className="font-semibold text-xs md:text-sm mb-0.5">{item.title}</div>
                <div className="text-[10px] md:text-xs text-muted-foreground">{item.desc}</div>
              </CardContent></Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Pro Tips */}
      {showTips && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 md:w-5 md:h-5 text-amber-600" /><CardTitle className="text-sm md:text-base text-amber-800">Pro Tips</CardTitle></div>
                <Button variant="ghost" size="sm" onClick={() => setShowTips(false)}><VolumeX className="w-4 h-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm text-amber-800">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 mt-0.5 shrink-0" /> Listen to the persona&apos;s tone before pitching</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 mt-0.5 shrink-0" /> Ask open-ended questions to uncover pain points</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 mt-0.5 shrink-0" /> Gatekeepers need a different approach — be specific</li>
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );

  // ─── RENDER: Persona Selection ──────────────────────────────────────────────

  const renderPersonaSelection = () => {
    let filtered = difficultyFilter === "all" ? PERSONAS : PERSONAS.filter(p => p.difficulty === difficultyFilter);
    if (typeFilter !== "all") {
      filtered = filtered.filter(p => PERSONA_TYPES[p.id] === typeFilter);
    }

    return (
      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-xl md:text-2xl font-bold">Choose Your Persona</h2>
            <p className="text-xs md:text-sm text-muted-foreground">Select a buyer persona to practice with</p>
          </div>
          <Button variant="ghost" onClick={() => setView("dashboard")}>Back</Button>
        </div>

        <div className="flex flex-col gap-2 md:gap-3">
          <div className="flex gap-1.5 md:gap-2 flex-wrap">
            <span className="text-[10px] md:text-xs font-medium text-muted-foreground self-center mr-1">Difficulty:</span>
            {["all", "easy", "medium", "hard"].map(diff => (
              <Button key={diff} variant={difficultyFilter === diff ? "default" : "outline"} size="sm" onClick={() => setDifficultyFilter(diff)} className="gap-1 text-xs">
                {diff === "all" ? "All" : DIFFICULTY_CONFIG[diff as "easy" | "medium" | "hard"].label}
                {diff !== "all" && <span className="ml-1 text-[10px] opacity-70">({PERSONAS.filter(p => p.difficulty === diff).length})</span>}
              </Button>
            ))}
          </div>
          <div className="flex gap-1.5 md:gap-2 flex-wrap">
            <span className="text-[10px] md:text-xs font-medium text-muted-foreground self-center mr-1">Type:</span>
            {["all", "decision-maker", "gatekeeper", "influencer"].map(type => (
              <Button key={type} variant={typeFilter === type ? "default" : "outline"} size="sm" onClick={() => setTypeFilter(type)} className="gap-1 text-xs">
                {type === "all" ? "All Types" : `${PERSONA_TYPE_CONFIG[type as keyof typeof PERSONA_TYPE_CONFIG].icon} ${PERSONA_TYPE_CONFIG[type as keyof typeof PERSONA_TYPE_CONFIG].label}`}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <AnimatePresence>
            {filtered.map((persona, i) => (
              <motion.div key={persona.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: 0.03 * i, duration: 0.3 }}>
                <Card className="h-full hover:shadow-lg transition-all group">
                  <CardHeader className="pb-2 md:pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 md:gap-3">
                        <PersonaAvatar src={persona.avatar} alt={persona.name} size="md" />
                        <div className="min-w-0">
                          <CardTitle className="text-sm md:text-base group-hover:text-primary transition-colors truncate">{persona.name}</CardTitle>
                          <CardDescription className="text-[11px] md:text-xs truncate">{persona.title}</CardDescription>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 items-end shrink-0">
                        {getDiffBadge(persona.difficulty)}
                        {getPersonaTypeBadge(persona.id)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-2 md:pb-3 space-y-2 md:space-y-3">
                    <div className="flex items-center gap-3 md:gap-4 text-[11px] md:text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{persona.company}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{persona.location}</span>
                    </div>
                    <p className="text-[11px] md:text-xs text-muted-foreground line-clamp-2">{persona.personality}</p>
                    <div className="flex flex-wrap gap-1">{persona.tags.slice(0, 3).map(tag => <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>)}</div>
                    <Separator />
                    <div>
                      <div className="text-[10px] md:text-xs font-medium mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-500" /> Key Objections</div>
                      <ul className="space-y-0.5 md:space-y-1">{persona.objections.slice(0, 2).map((obj, idx) => (
                        <li key={idx} className="text-[10px] md:text-xs text-muted-foreground line-clamp-1 flex items-start gap-1"><XCircle className="w-3 h-3 mt-0.5 shrink-0 text-red-400" />{obj}</li>
                      ))}</ul>
                    </div>
                    <div>
                      <div className="text-[10px] md:text-xs font-medium mb-1 flex items-center gap-1"><Target className="w-3 h-3 text-emerald-500" /> How to Win</div>
                      <ul className="space-y-0.5 md:space-y-1">{persona.winConditions.slice(0, 2).map((cond, idx) => (
                        <li key={idx} className="text-[10px] md:text-xs text-muted-foreground line-clamp-1 flex items-start gap-1"><CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-emerald-400" />{cond}</li>
                      ))}</ul>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0 gap-2">
                    <Button size="sm" className="flex-1 gap-1 text-xs" onClick={() => startTextRoleplay(persona)}>
                      <MessageCircle className="w-3 h-3" /> Chat
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs" onClick={() => startVoiceRoleplay(persona)}>
                      <Phone className="w-3 h-3" /> Voice
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filtered.length === 0 && (
          <Card><CardContent className="py-8 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No personas match your filters.</p>
          </CardContent></Card>
        )}
      </div>
    );
  };

  // ─── RENDER: Chat Area ────────────────────────────────────────────────────

  const renderChatArea = () => {
    const effectiveInputMode = isMobile && mode === "voice" ? "voice" : inputMode;

    return (
      <div className="flex flex-col" style={{ height: isMobile ? 'calc(100dvh - 130px)' : 'auto', minHeight: isMobile ? '400px' : '500px' }}>
        {/* Voice/Call Status Indicator */}
        {(mode === "voice" || effectiveInputMode === "voice") && (
          <div className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border mb-2 transition-colors shrink-0 ${
            isRecording
              ? "bg-red-50 border-red-300"
              : isAudioPlaying
                ? "bg-emerald-50 border-emerald-200"
                : "bg-slate-50 border-slate-200"
          }`}>
            {isRecording ? (
              <>
                <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                </motion.div>
                <span className="text-xs font-medium text-red-700">
                  Recording{recordingDuration > 0 ? ` · ${recordingDuration}s` : ""} — Speak now
                </span>
              </>
            ) : isAudioPlaying ? (
              <>
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                  <Volume2 className="w-4 h-4 text-emerald-600" />
                </motion.div>
                <span className="text-xs font-medium text-emerald-700">
                  {selectedPersona?.name} is speaking...
                </span>
              </>
            ) : isChatLoading ? (
              <>
                <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
                <span className="text-xs font-medium text-slate-500">Thinking...</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-medium text-slate-600">Tap mic to speak</span>
              </>
            )}
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto rounded-lg border bg-white p-3 mb-2" style={{ minHeight: '200px' }}>
          <div className="space-y-3">
            {chatMessages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${msg.role === "user" ? "justify-end" : msg.role === "system" ? "justify-center" : "justify-start"}`}
              >
                {msg.role === "system" ? (
                  <div className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full max-w-[90%]">{msg.content}</div>
                ) : (
                  <div className={`max-w-[85%] ${msg.role === "user" ? "" : ""}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      {msg.role === "assistant" && (
                        <>
                          <PersonaAvatar src={selectedPersona?.avatar || "/avatars/p1_faisal.png"} alt={selectedPersona?.name || "Persona"} size="sm" />
                          <span className="text-[11px] font-medium text-muted-foreground">{selectedPersona?.name}</span>
                        </>
                      )}
                      {msg.role === "user" && (
                        <div className="flex items-center gap-1.5 ml-auto">
                          <span className="text-[11px] font-medium text-muted-foreground">You</span>
                          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-sm text-white">🎤</div>
                        </div>
                      )}
                    </div>
                    {msg.role === "assistant" ? (
                      <div className="rounded-2xl px-3 py-2.5 text-sm whitespace-pre-wrap bg-slate-100 text-slate-900 rounded-bl-md relative group">
                        {msg.content}
                        <div className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5">
                          <button
                            onClick={() => playTTS(msg.content, i)}
                            className={`w-7 h-7 rounded-full shadow-md flex items-center justify-center transition-all active:scale-95 ${
                              playingMessageIdx === i
                                ? "bg-emerald-500 hover:bg-emerald-600"
                                : ttsError && ttsLoading === null
                                  ? "bg-amber-100 hover:bg-amber-200"
                                  : "bg-white hover:bg-slate-50"
                            }`}
                            title={playingMessageIdx === i ? "Stop voice" : ttsError ? "Retry voice" : "Play voice"}
                            disabled={ttsLoading !== null && ttsLoading !== i}
                          >
                            {ttsLoading === i ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
                            ) : playingMessageIdx === i ? (
                              <Volume2 className="w-3.5 h-3.5 text-white" />
                            ) : ttsError ? (
                              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                            ) : (
                              <Volume2 className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                        {playingMessageIdx === i && (
                          <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-slate-200/60">
                            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.8, repeat: Infinity }} className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-[10px] text-emerald-600 font-medium">Speaking...</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-2xl px-3 py-2.5 text-sm whitespace-pre-wrap bg-primary text-primary-foreground rounded-br-md">
                        {msg.content}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2">
                  <PersonaAvatar src={selectedPersona?.avatar || "/avatars/p1_faisal.png"} alt={selectedPersona?.name || "Persona"} size="sm" />
                  <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0 }} className="w-2 h-2 bg-slate-400 rounded-full" />
                      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }} className="w-2 h-2 bg-slate-400 rounded-full" />
                      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }} className="w-2 h-2 bg-slate-400 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Input Mode Toggle (mobile) */}
        {isMobile && roleplayStatus === "active" && (
          <div className="flex items-center justify-center gap-1 p-1 bg-slate-100 rounded-lg mb-2 shrink-0">
            <button
              onClick={() => { setInputMode("text"); if (isRecording) stopRecording(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                effectiveInputMode === "text"
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500"
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" /> Type
            </button>
            <button
              onClick={() => { setInputMode("voice"); setChatInput(""); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                effectiveInputMode === "voice"
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500"
              }`}
            >
              <Mic className="w-3.5 h-3.5" /> Voice
            </button>
          </div>
        )}

        {/* Chat Input Bar */}
        <div className="flex gap-2 items-center shrink-0">
          <Button
            variant={isRecording ? "destructive" : effectiveInputMode === "voice" ? "default" : "outline"}
            size={effectiveInputMode === "voice" ? "default" : "icon"}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={!isRecording && (isAudioPlaying || playingMessageIdx !== null || isChatLoading || effectiveInputMode === "text")}
            className={`shrink-0 relative ${effectiveInputMode === "voice" ? "w-11 h-11" : "w-9 h-9"}`}
          >
            {isRecording ? (
              <>
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                  <MicOff className={effectiveInputMode === "voice" ? "w-5 h-5" : "w-4 h-4"} />
                </motion.div>
                {recordingDuration > 0 && effectiveInputMode === "voice" && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center">
                    {recordingDuration}
                  </span>
                )}
              </>
            ) : (
              <Mic className={effectiveInputMode === "voice" ? "w-5 h-5" : "w-4 h-4"} />
            )}
          </Button>

          <div className={`flex-1 relative ${isMobile && effectiveInputMode === "voice" ? "hidden" : ""}`}>
            <Input
              ref={chatInputRef}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
              placeholder={isRecording ? "Listening..." : "Type your message..."}
              disabled={isChatLoading || isRecording || effectiveInputMode === "voice"}
              className="pr-10 h-10"
              autoComplete="off"
            />
            <Button
              size="sm"
              onClick={sendChatMessage}
              disabled={!chatInput.trim() || isChatLoading || isRecording}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>

          {isMobile && effectiveInputMode === "voice" && (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-xs text-muted-foreground">
                {isRecording ? `Recording · ${recordingDuration}s` : isAudioPlaying ? "Listening..." : "Tap mic to speak"}
              </span>
            </div>
          )}

          <Button
            variant="destructive"
            size={isMobile ? "default" : "icon"}
            onClick={handleEndSession}
            title="End session"
            className="shrink-0"
          >
            <PhoneOff className={isMobile ? "w-4 h-4 mr-1.5" : "w-4 h-4"} />
            {isMobile && <span className="text-xs">End</span>}
          </Button>
        </div>
      </div>
    );
  };

  // ─── Sidebar content ──────────────────────────────────────────────────────

  const renderSidebarContent = () => (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Persona Profile</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="text-center">
            <PersonaAvatar src={selectedPersona?.avatar || "/avatars/p1_faisal.png"} alt={selectedPersona?.name || "Persona"} size="md" />
            <div className="font-semibold text-sm">{selectedPersona?.name}</div>
            <div className="text-xs text-muted-foreground">{selectedPersona?.nationality} · Age {selectedPersona?.age}</div>
            {selectedPersona && <div className="mt-2">{getPersonaTypeBadge(selectedPersona.id)}</div>}
          </div>
          <Separator />
          <div>
            <div className="text-xs font-medium mb-1 flex items-center gap-1"><Info className="w-3 h-3" /> Situation</div>
            <p className="text-xs text-muted-foreground">{selectedPersona?.currentSituation}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><TrendingUp className="w-4 h-4 text-sky-500" /> Conversation Flow</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { key: "guarded", label: "1. Guarded", desc: "Build rapport, ask smart questions", icon: Shield },
              { key: "warming", label: "2. Warming", desc: "Show industry understanding", icon: MessageSquare },
              { key: "discovery", label: "3. Discovery", desc: "Probe specific pain points", icon: Target },
              { key: "consideration", label: "4. Open", desc: "Discuss solutions & next steps", icon: CheckCircle2 },
            ].map((s, i) => {
              const stages = ["guarded", "warming", "discovery", "consideration"];
              const currentIdx = stages.indexOf(conversationStage);
              const thisIdx = i;
              const isActive = conversationStage === s.key;
              const isComplete = currentIdx > thisIdx;
              return (
                <div
                  key={s.key}
                  className={`flex items-start gap-2 p-2 rounded text-xs transition-all ${
                    isActive ? "bg-sky-50 border border-sky-200" :
                    isComplete ? "bg-emerald-50 border border-emerald-100 opacity-70" :
                    "bg-slate-50 border border-slate-100 opacity-50"
                  }`}
                >
                  <s.icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                    isActive ? "text-sky-500" : isComplete ? "text-emerald-500" : "text-slate-400"
                  }`} />
                  <div>
                    <div className={`font-medium ${
                      isActive ? "text-sky-700" : isComplete ? "text-emerald-700 line-through" : "text-slate-500"
                    }`}>{s.label}</div>
                    <div className={`${
                      isActive ? "text-sky-600" : isComplete ? "text-emerald-600" : "text-slate-400"
                    }`}>{s.desc}</div>
                  </div>
                  {isComplete && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 ml-auto" />}
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse shrink-0 ml-auto mt-1" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Shield className="w-4 h-4 text-amber-500" /> Objections</CardTitle></CardHeader>
        <CardContent>
          <div className="max-h-32 overflow-y-auto">
            <ul className="space-y-1.5">
              {selectedPersona?.objections.map((obj, i) => (
                <li key={i} className="text-xs flex items-start gap-2 p-1.5 rounded bg-amber-50">
                  <span className="font-bold text-amber-600">{i + 1}</span><span className="text-amber-800">{obj}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Target className="w-4 h-4 text-emerald-500" /> How to Win</CardTitle></CardHeader>
        <CardContent>
          <div className="max-h-32 overflow-y-auto">
            <ul className="space-y-1.5">
              {selectedPersona?.winConditions.map((cond, i) => (
                <li key={i} className="text-xs flex items-start gap-2 p-1.5 rounded bg-emerald-50">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" /><span className="text-emerald-800">{cond}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><XCircle className="w-4 h-4 text-red-500" /> How to Lose</CardTitle></CardHeader>
        <CardContent>
          <div className="max-h-32 overflow-y-auto">
            <ul className="space-y-1.5">
              {selectedPersona?.loseConditions.map((cond, i) => (
                <li key={i} className="text-xs flex items-start gap-2 p-1.5 rounded bg-red-50">
                  <XCircle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" /><span className="text-red-800">{cond}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ─── RENDER: Roleplay Session ───────────────────────────────────────────────

  const renderRoleplay = () => (
    <div className="space-y-2 lg:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => {
            if (roleplayStatus === "active") {
              if (confirm("End the current session?")) handleEndSession();
            }
            setView("dashboard"); setRoleplayStatus("idle");
          }} className="shrink-0 px-2">
            <span className="lg:hidden">←</span><span className="hidden lg:inline">Back</span>
          </Button>
          {selectedPersona && (
            <div className="flex items-center gap-2 min-w-0">
              <PersonaAvatar src={selectedPersona.avatar} alt={selectedPersona.name} size="sm" />
              <div className="min-w-0">
                <div className="font-semibold truncate text-sm">{selectedPersona.name}</div>
                <div className="text-[11px] text-muted-foreground hidden sm:block truncate">{selectedPersona.title} · {selectedPersona.company}</div>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {getDiffBadge(selectedPersona?.difficulty || "medium")}
          <Badge variant={mode === "text" ? "default" : "outline"} className="gap-1 text-[11px]">
            {mode === "text" ? <><Type className="w-3 h-3" /> Chat</> : <><Phone className="w-3 h-3" /> Voice</>}
          </Badge>
          {roleplayStatus === "active" && (
            <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
              <Clock className="w-3 h-3" />{formatTime(callTimer)}
            </div>
          )}
          {/* Conversation Stage */}
          {roleplayStatus === "active" && (() => {
            const stageConfig: Record<string, { label: string; color: string; icon: typeof Target }> = {
              guarded: { label: "Guarded", color: "bg-slate-100 text-slate-600 border-slate-200", icon: Shield },
              warming: { label: "Warming", color: "bg-amber-50 text-amber-600 border-amber-200", icon: MessageSquare },
              discovery: { label: "Discovery", color: "bg-sky-50 text-sky-600 border-sky-200", icon: Target },
              consideration: { label: "Open", color: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: CheckCircle2 },
            };
            const cfg = stageConfig[conversationStage] || stageConfig.guarded;
            return (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${cfg.color}`}>
                <cfg.icon className="w-2.5 h-2.5" />{cfg.label}
              </span>
            );
          })()}
          {/* Auto-Voice Toggle */}
          {roleplayStatus === "active" && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <Volume2 className="w-3.5 h-3.5" /> {!isMobile && "Auto-Voice"}
                <Switch checked={autoVoice} onCheckedChange={setAutoVoice} className="scale-75" />
              </label>
            </div>
          )}
          {/* Mobile sidebar toggle */}
          {isMobile && (
            <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <PanelRightOpen className="w-3.5 h-3.5" />
                  <span className="text-[10px]">Info</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] overflow-y-auto p-4">
                <SheetHeader className="p-0 pb-2">
                  <SheetTitle className="text-sm">Session Info</SheetTitle>
                </SheetHeader>
                {renderSidebarContent()}
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>

      {/* Main Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 lg:gap-6">
        <div className="lg:col-span-2">
          {renderChatArea()}
        </div>
        <div className="hidden lg:block">
          <div className="space-y-4">
            {renderSidebarContent()}
          </div>
        </div>
      </div>
    </div>
  );

  // ─── RENDER: Session End Dialog ─────────────────────────────────────────────

  const renderEndDialog = () => {
    const duration = sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 1000) : callTimer;
    const messageCount = chatMessages.filter(m => m.role === "user" || m.role === "assistant").length;

    return (
      <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Session Complete
            </DialogTitle>
            <DialogDescription>
              Rate your performance in this roleplay session
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <Clock className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                <div className="text-lg font-bold">{formatTime(duration)}</div>
                <div className="text-xs text-muted-foreground">Duration</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-center">
                <MessageCircle className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                <div className="text-lg font-bold">{messageCount}</div>
                <div className="text-xs text-muted-foreground">Messages</div>
              </div>
            </div>

            {selectedPersona && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                <PersonaAvatar src={selectedPersona.avatar} alt={selectedPersona.name} size="md" />
                <div>
                  <div className="font-medium text-sm">{selectedPersona.name}</div>
                  <div className="text-xs text-muted-foreground">{selectedPersona.title} · {selectedPersona.company}</div>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">Outcome</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: "won" as const, label: "Won", icon: CheckCircle2, activeColor: "border-emerald-500 bg-emerald-100 text-emerald-800 ring-2 ring-emerald-500" },
                  { key: "partial" as const, label: "Partial", icon: Pause, activeColor: "border-amber-500 bg-amber-100 text-amber-800 ring-2 ring-amber-500" },
                  { key: "lost" as const, label: "Lost", icon: XCircle, activeColor: "border-red-500 bg-red-100 text-red-800 ring-2 ring-red-500" },
                ]).map(({ key, label, icon: Icon, activeColor }) => (
                  <button
                    key={key}
                    onClick={() => setEndOutcome(key)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                      endOutcome === key ? activeColor : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Notes</label>
              <Textarea
                value={endNotes}
                onChange={e => setEndNotes(e.target.value)}
                placeholder="What went well? What could you improve?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowEndDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveEndSession} className="gap-1">
              <CheckCircle2 className="w-4 h-4" /> Save & Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // ─── RENDER: History ────────────────────────────────────────────────────────

  const renderHistory = () => (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold">Session History</h2>
          <p className="text-xs md:text-sm text-muted-foreground">Your past roleplay sessions</p>
        </div>
        <Button variant="ghost" onClick={() => setView("dashboard")}>Back</Button>
      </div>
      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-1">No sessions yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Start your first roleplay session to see history here.</p>
            <Button onClick={() => setView("select")} className="gap-2"><Play className="w-4 h-4" /> Start Roleplay</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((session, i) => (
            <motion.div key={session.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        session.outcome === "won" ? "bg-emerald-100" :
                        session.outcome === "lost" ? "bg-red-100" : "bg-amber-100"
                      }`}>
                        {session.outcome === "won" ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> :
                         session.outcome === "lost" ? <XCircle className="w-5 h-5 text-red-600" /> :
                         <Pause className="w-5 h-5 text-amber-600" />}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{session.personaId}</div>
                        <div className="text-xs text-muted-foreground">{new Date(session.createdAt).toLocaleDateString()} · {formatTime(session.duration)}</div>
                      </div>
                    </div>
                    <Badge variant={session.status === "completed" ? "default" : "secondary"}>
                      {session.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  // ─── RENDER: Main Layout ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {view !== "dashboard" && view !== "roleplay" && (
              <Button variant="ghost" size="sm" onClick={() => setView("dashboard")} className="px-2">
                ←
              </Button>
            )}
            <Image src="/sgc-tech-logo.png" alt="SGC TECH" width={28} height={28} className="rounded-md" />
            <div>
              <h1 className="text-sm font-bold leading-tight">SGC TECH</h1>
              <span className="text-[10px] text-muted-foreground leading-tight">Roleplay Arena</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view === "dashboard" && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setView("select")} className="gap-1 text-xs">
                  <Play className="w-3.5 h-3.5" /> Start
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setView("history")} className="gap-1 text-xs">
                  <BarChart3 className="w-3.5 h-3.5" /> History
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1 text-xs text-muted-foreground">
              <LogOut className="w-3.5 h-3.5" /> Exit
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 md:py-6">
        {view === "dashboard" && renderDashboard()}
        {view === "select" && renderPersonaSelection()}
        {view === "roleplay" && renderRoleplay()}
        {view === "history" && renderHistory()}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/sgc-tech-logo.png" alt="SGC TECH" width={16} height={16} className="rounded-sm" />
            <span className="text-[10px] text-muted-foreground">SGC TECH AI · Sales Roleplay Arena</span>
          </div>
          <span className="text-[10px] text-muted-foreground">v1.0</span>
        </div>
      </footer>

      {/* End Session Dialog */}
      {renderEndDialog()}
    </div>
  );
}
