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
  PanelRightOpen, Keyboard
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
const APP_PASSWORD = "SGC2025"; // Change this to your desired password

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

// ─── Deepgram Voice Mapping ─────────────────────────────────────────────────

// Maps persona voiceId to Deepgram Aura-2 voice model
const DEEPGRAM_VOICE_MAP: Record<string, string> = {
  "aura-2-cora-en": "aura-2-cora-en",       // Female - warm, professional
  "aura-2-amalthea-en": "aura-2-amalthea-en", // Female - clear, composed
  "aura-2-orion-en": "aura-2-orion-en",       // Male - deep, authoritative
  "aura-2-apollo-en": "aura-2-apollo-en",     // Male - confident
  "aura-2-arcas-en": "aura-2-arcas-en",       // Male - measured
  "aura-2-luna-en": "aura-2-luna-en",         // Female - calm
  "aura-2-helios-en": "aura-2-helios-en",     // Male - friendly
  "aura-2-atlas-en": "aura-2-atlas-en",       // Male - direct
};

function getDeepgramVoice(persona: Persona): string {
  return DEEPGRAM_VOICE_MAP[persona.voiceId] || "aura-2-cora-en";
}

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
      <Image src={src} alt={alt} width={s.img} height={s.img} className="w-full h-full object-cover" />
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
  const [inputMode, setInputMode] = useState<"text" | "voice">("text"); // Controls which input is active within roleplay
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

  // ─── TTS Playback ───────────────────────────────────────────────────────────

  const playTTS = useCallback(async (text: string, messageIdx: number) => {
    if (playingMessageIdx === messageIdx) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingMessageIdx(null);
      return;
    }

    audioRef.current?.pause();
    setTtsLoading(messageIdx);

    try {
      const voice = selectedPersona ? getDeepgramVoice(selectedPersona) : "aura-2-cora-en";
      const res = await fetch("/api/roleplay/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 2000), voice }),
      });

      if (!res.ok) throw new Error("TTS failed");

      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setPlayingMessageIdx(null);
        setIsAudioPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      setPlayingMessageIdx(messageIdx);
      setIsAudioPlaying(true);
      setTtsLoading(null);
      await audio.play();
    } catch (err) {
      console.error("TTS playback error:", err);
      setTtsLoading(null);
      setIsAudioPlaying(false);
    }
  }, [playingMessageIdx, selectedPersona]);

  // ─── Microphone Recording ───────────────────────────────────────────────────

  const sendChatMessageWithText = useCallback(async (text: string) => {
    if (!text.trim() || !selectedPersona || isChatLoading || isRecording) return; // Block if recording
    const userMsg = text.trim();
    setInputMode("text"); // Switch to text mode when sending text
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
        // Update conversation stage from API response
        if (data.stage) {
          setConversationStage(data.stage);
        }
        setChatMessages(prev => {
          const newMessages = [...prev, { role: "assistant", content: data.response, timestamp: Date.now() }];
          if (autoVoice) {
            const idx = newMessages.length - 1;
            setTimeout(() => playTTS(data.response, idx), 100);
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

  const SILENCE_THRESHOLD = 6; // RMS threshold for silence detection (0-128 range) — lowered for better sensitivity
  const SILENCE_DURATION = 3500; // ms of silence before auto-stop — increased to prevent premature cut-off
  const MIN_RECORDING_DURATION = 1200; // ms minimum recording before allowing stop
  const MAX_RECORDING_DURATION = 120000; // ms maximum recording (120 seconds)
  const SPEECH_DETECTION_INTERVAL = 150; // ms between VAD checks — slightly slower for stability

  const cleanupRecording = useCallback(() => {
    // Stop VAD interval
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    // Stop recording timer
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { audioContextRef.current.close(); } catch { /* ignore */ }
    }
    audioContextRef.current = null;
    analyserRef.current = null;
  }, []);

  const processRecordedAudio = useCallback(async () => {
    if (isStoppingRef.current) return; // Prevent double-processing
    isStoppingRef.current = true;

    const chunks = [...audioChunksRef.current];
    audioChunksRef.current = [];

    // Release mic stream
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }

    cleanupRecording();

    // Check minimum duration
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

      // Check blob size (too small = probably no speech)
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
      mediaRecorderRef.current.stop(); // Triggers ondataavailable then onstop
    } else {
      setIsRecording(false);
      setRecordingDuration(0);
      cleanupRecording();
    }
  }, [cleanupRecording]);

  const startRecording = useCallback(async () => {
    // Don't start if TTS is playing (prevent echo/feedback)
    if (isAudioPlaying || playingMessageIdx !== null) return;
    // Don't start if already recording
    if (isRecording || isStoppingRef.current) return;
    // Don't start if chat is loading
    if (isChatLoading) return;
    // Don't start if text input has content (prevent conflict)
    if (chatInput.trim()) return;
    // Switch to voice input mode when recording
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

      // Check supported MIME type
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

      // Collect data with timeslice for reliability
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
        // Process the recorded audio
        processRecordedAudio();
      };

      // Set up Voice Activity Detection
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

          // Calculate RMS volume
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const val = (dataArray[i] - 128) / 128;
            sum += val * val;
          }
          const rms = Math.sqrt(sum / dataArray.length) * 128;

          const now = Date.now();
          const elapsed = now - recordingStartRef.current;

          // Detect speech
          if (rms > SILENCE_THRESHOLD) {
            hasDetectedSpeech = true;
            silenceStartRef.current = 0; // Reset silence timer
          } else if (hasDetectedSpeech && silenceStartRef.current === 0) {
            // Speech was detected, now silence started
            silenceStartRef.current = now;
          }

          // Auto-stop after prolonged silence (only after speech was detected)
          if (hasDetectedSpeech && silenceStartRef.current > 0 && (now - silenceStartRef.current) > SILENCE_DURATION) {
            // Only auto-stop if minimum duration met
            if (elapsed > MIN_RECORDING_DURATION) {
              stopRecording();
            }
          }

          // Force stop at max duration
          if (elapsed > MAX_RECORDING_DURATION) {
            stopRecording();
          }
        }, SPEECH_DETECTION_INTERVAL);
      } catch (vadErr) {
        console.warn("VAD setup failed, using timer-only mode:", vadErr);
        // Fallback: just use a max duration timer
        setTimeout(() => {
          if (mediaRecorderRef.current?.state === "recording") {
            stopRecording();
          }
        }, MAX_RECORDING_DURATION);
      }

      // Start recording with timeslice for reliable data collection
      mediaRecorder.start(250); // Collect data every 250ms
      recordingStartRef.current = Date.now();
      setIsRecording(true);
      setRecordingDuration(0);

      // Update recording duration timer
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
    if (autoVoice) {
      setTimeout(() => playTTS(persona.openingLine, 1), 300);
    }
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
    setAutoVoice(true); // Auto-voice always on in voice mode
    const sid = `voice-${persona.id}-${Date.now()}`;
    setChatSessionId(sid);
    setSessionId(sid);
    setConversationStage("guarded");
    const openingMsg = { role: "assistant" as const, content: persona.openingLine, timestamp: Date.now() };
    setChatMessages([
      { role: "system", content: `Voice call with ${persona.name}. Speak naturally — ask great questions to discover their pain points. Your words are transcribed and the persona responds with voice.`, timestamp: Date.now() },
      openingMsg,
    ]);
    // Auto-play TTS for opening line
    setTimeout(() => playTTS(persona.openingLine, 1), 300);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !selectedPersona || isChatLoading || isRecording) return; // Block if recording
    const userMsg = chatInput.trim();
    setChatInput("");
    await sendChatMessageWithText(userMsg);
    if (!isMobile) chatInputRef.current?.focus();
  };

  const endRoleplay = async (outcome?: string) => {
    // Stop any TTS playback
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingMessageIdx(null);
    setTtsLoading(null);
    setIsAudioPlaying(false);

    // Stop recording if active
    if (isRecording) {
      stopRecording();
    }
    // Cleanup recording resources
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
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-400 flex items-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" /> {authError}
                  </motion.p>
                )}
              </div>
              <Button
                onClick={handleLogin}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                size="lg"
              >
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
    <div className="space-y-8">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 md:p-12">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L2c+PC9zdmc+')] opacity-50" />
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <Image src="/sgc-tech-logo.png" alt="SGC TECH" width={56} height={56} className="rounded-lg drop-shadow-lg" />
            <div className="flex flex-col">
              <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/20 border-white/20 w-fit mb-1">AI-Powered</Badge>
              <span className="text-white/60 text-xs tracking-widest uppercase">Sales Roleplay Arena</span>
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">SGC TECH <span className="text-white/60 font-normal">Roleplay Arena</span></h1>
          <p className="text-slate-300 text-lg max-w-2xl mb-6">
            Practice your sales pitch against AI-powered buyer personas. Choose text chat with voice playback or immersive voice calls powered by Deepgram.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={() => setView("select")} className="bg-white text-slate-900 hover:bg-slate-100 gap-2">
              <Play className="w-5 h-5" /> Start Roleplay
            </Button>
            <Button size="lg" variant="outline" onClick={() => setView("history")} className="border-white/20 text-white hover:bg-white/10 gap-2">
              <BarChart3 className="w-5 h-5" /> Session History
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Available Personas", value: PERSONAS.length, icon: Users, color: "text-slate-700" },
          { label: "Sessions", value: sessions.length, icon: CheckCircle2, color: "text-emerald-600" },
          { label: "Wins", value: sessions.filter(s => s.outcome === "won").length, icon: Award, color: "text-amber-600" },
          { label: "Win Rate", value: sessions.filter(s => s.status === "completed").length > 0
            ? `${Math.round(sessions.filter(s => s.outcome === "won").length / sessions.filter(s => s.status === "completed").length * 100)}%`
            : "0%", icon: TrendingUp, color: "text-rose-600" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i, duration: 0.4 }}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Start */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Quick Start</h2>
          <Button variant="ghost" size="sm" onClick={() => setView("select")} className="gap-1">View All <ChevronRight className="w-4 h-4" /></Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PERSONAS.slice(0, 3).map((persona, i) => (
            <motion.div key={persona.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * i, duration: 0.4 }}>
              <Card className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 group" onClick={() => startTextRoleplay(persona)}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <PersonaAvatar src={persona.avatar} alt={persona.name} size="lg" />
                      <div>
                        <CardTitle className="text-base group-hover:text-primary transition-colors">{persona.name}</CardTitle>
                        <CardDescription className="text-xs">{persona.title}</CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      {getDiffBadge(persona.difficulty)}
                      {getPersonaTypeBadge(persona.id)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
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
                    <span className="text-xs text-muted-foreground italic line-clamp-1">&ldquo;{persona.openingLine}&rdquo;</span>
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
        <h2 className="text-xl font-semibold mb-4">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { step: "1", title: "Choose Persona", desc: "Pick a buyer persona — decision-maker, gatekeeper, or influencer", icon: Users },
            { step: "2", title: "Start Session", desc: "Text chat with voice playback or immersive voice call", icon: MessageCircle },
            { step: "3", title: "Navigate Objections", desc: "Handle real objections and negotiation tactics", icon: Shield },
            { step: "4", title: "Get Feedback", desc: "Rate your performance and track improvement", icon: TrendingUp },
          ].map((item, i) => (
            <motion.div key={item.step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + 0.1 * i, duration: 0.4 }}>
              <Card className="h-full"><CardContent className="p-4 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3"><item.icon className="w-5 h-5 text-slate-700" /></div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Step {item.step}</div>
                <div className="font-semibold text-sm mb-1">{item.title}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
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
                <div className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-600" /><CardTitle className="text-base text-amber-800">Pro Tips</CardTitle></div>
                <Button variant="ghost" size="sm" onClick={() => setShowTips(false)}><VolumeX className="w-4 h-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <ul className="space-y-2 text-sm text-amber-800">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> Listen carefully to the persona&apos;s tone and concerns before pitching</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> Ask open-ended questions to uncover hidden pain points</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> Use Voice Call mode for an immersive conversation experience</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> Gatekeepers require a different approach — respect their role and be specific</li>
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
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-2xl font-bold">Choose Your Persona</h2>
            <p className="text-muted-foreground">Select a buyer persona to practice with</p>
          </div>
          <Button variant="ghost" onClick={() => setView("dashboard")}>Back to Dashboard</Button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground self-center mr-1">Difficulty:</span>
            {["all", "easy", "medium", "hard"].map(diff => (
              <Button key={diff} variant={difficultyFilter === diff ? "default" : "outline"} size="sm" onClick={() => setDifficultyFilter(diff)} className="gap-1">
                {diff === "all" ? "All" : DIFFICULTY_CONFIG[diff as "easy" | "medium" | "hard"].label}
                {diff !== "all" && <span className="ml-1 text-xs opacity-70">({PERSONAS.filter(p => p.difficulty === diff).length})</span>}
              </Button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground self-center mr-1">Type:</span>
            {["all", "decision-maker", "gatekeeper", "influencer"].map(type => (
              <Button key={type} variant={typeFilter === type ? "default" : "outline"} size="sm" onClick={() => setTypeFilter(type)} className="gap-1">
                {type === "all" ? "All Types" : `${PERSONA_TYPE_CONFIG[type as keyof typeof PERSONA_TYPE_CONFIG].icon} ${PERSONA_TYPE_CONFIG[type as keyof typeof PERSONA_TYPE_CONFIG].label}`}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((persona, i) => (
              <motion.div key={persona.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: 0.05 * i, duration: 0.3 }}>
                <Card className="h-full hover:shadow-lg transition-all group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <PersonaAvatar src={persona.avatar} alt={persona.name} size="lg" />
                        <div>
                          <CardTitle className="text-base group-hover:text-primary transition-colors">{persona.name}</CardTitle>
                          <CardDescription className="text-xs">{persona.title}</CardDescription>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        {getDiffBadge(persona.difficulty)}
                        {getPersonaTypeBadge(persona.id)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3 space-y-3">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{persona.company}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{persona.location}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{persona.personality}</p>
                    <div className="flex flex-wrap gap-1">{persona.tags.slice(0, 3).map(tag => <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>)}</div>
                    <Separator />
                    <div>
                      <div className="text-xs font-medium mb-1.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-500" /> Key Objections</div>
                      <ul className="space-y-1">{persona.objections.slice(0, 2).map((obj, idx) => (
                        <li key={idx} className="text-xs text-muted-foreground line-clamp-1 flex items-start gap-1"><XCircle className="w-3 h-3 mt-0.5 shrink-0 text-red-400" />{obj}</li>
                      ))}</ul>
                    </div>
                    <div>
                      <div className="text-xs font-medium mb-1.5 flex items-center gap-1"><Target className="w-3 h-3 text-emerald-500" /> How to Win</div>
                      <ul className="space-y-1">{persona.winConditions.slice(0, 2).map((cond, idx) => (
                        <li key={idx} className="text-xs text-muted-foreground line-clamp-1 flex items-start gap-1"><CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-emerald-400" />{cond}</li>
                      ))}</ul>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0 gap-2">
                    <Button size="sm" className="flex-1 gap-1" onClick={() => startTextRoleplay(persona)}>
                      <MessageCircle className="w-3 h-3" /> Chat
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => startVoiceRoleplay(persona)}>
                      <Phone className="w-3 h-3" /> Voice Call
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
            <p className="text-sm text-muted-foreground">No personas match your filters. Try adjusting the difficulty or type filters.</p>
          </CardContent></Card>
        )}
      </div>
    );
  };

  // ─── RENDER: Chat Area (shared by both text and voice modes) ────────────────

  const renderChatArea = () => {
    // Determine effective input mode - on mobile voice mode, always voice
    const effectiveInputMode = isMobile && mode === "voice" ? "voice" : inputMode;

    return (
      <div className="space-y-3 flex flex-col" style={{ height: isMobile ? "calc(100dvh - 140px)" : "auto" }}>
        {/* Voice/Call Status Indicator - shown when in voice input mode or voice call mode */}
        {(mode === "voice" || effectiveInputMode === "voice") && (
          <div className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border transition-colors ${
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
                <div className="flex gap-0.5 items-end">
                  {[1, 2, 3, 4].map(bar => (
                    <motion.div
                      key={bar}
                      animate={{ height: [4, 12 + Math.random() * 8, 4] }}
                      transition={{ duration: 0.5 + Math.random() * 0.3, repeat: Infinity, delay: bar * 0.1 }}
                      className="w-1 bg-emerald-500 rounded-full"
                      style={{ height: 4 }}
                    />
                  ))}
                </div>
              </>
            ) : isChatLoading ? (
              <>
                <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
                <span className="text-xs font-medium text-slate-500">
                  {selectedPersona?.name} is thinking...
                </span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-medium text-slate-600">
                  Tap the mic button to speak
                </span>
              </>
            )}
          </div>
        )}

        {/* Chat Messages */}
        <ScrollArea className={`flex-1 rounded-lg border bg-white p-3 sm:p-4 ${
          isMobile
            ? "max-h-[calc(100dvh-280px)]"
            : "min-h-[400px] max-h-[calc(100vh-360px)]"
        }`}>
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
                  <div className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">{msg.content}</div>
                ) : (
                  <div className={`max-w-[85%] sm:max-w-[80%] ${msg.role === "user" ? "order-1" : ""}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {msg.role === "assistant" && (
                        <div className="flex items-center gap-1.5">
                          <PersonaAvatar src={selectedPersona?.avatar || "/avatars/p1_faisal.png"} alt={selectedPersona?.name || "Persona"} size="sm" />
                          <span className="text-xs font-medium text-muted-foreground">{selectedPersona?.name}</span>
                        </div>
                      )}
                      {msg.role === "user" && (
                        <div className="flex items-center gap-1.5 justify-end w-full">
                          <span className="text-xs font-medium text-muted-foreground">You</span>
                          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-sm text-white">🎤</div>
                        </div>
                      )}
                    </div>
                    {msg.role === "assistant" ? (
                      <div className="rounded-2xl px-3 sm:px-4 py-2.5 text-sm whitespace-pre-wrap bg-slate-100 text-slate-900 rounded-bl-md relative group">
                        {msg.content}
                        <button
                          onClick={() => playTTS(msg.content, i)}
                          className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-slate-50 active:bg-slate-100"
                          title={playingMessageIdx === i ? "Stop voice" : "Play voice"}
                        >
                          {ttsLoading === i ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : playingMessageIdx === i ? (
                            <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-2xl px-3 sm:px-4 py-2.5 text-sm whitespace-pre-wrap bg-primary text-primary-foreground rounded-br-md">
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
        </ScrollArea>

        {/* ── Input Mode Toggle (mobile only) ── */}
        {isMobile && roleplayStatus === "active" && (
          <div className="flex items-center justify-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => { setInputMode("text"); if (isRecording) stopRecording(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                effectiveInputMode === "text"
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" /> Type
            </button>
            <button
              onClick={() => { setInputMode("voice"); setChatInput(""); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                effectiveInputMode === "voice"
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Mic className="w-3.5 h-3.5" /> Voice
            </button>
          </div>
        )}

        {/* ── Chat Input Bar ── */}
        <div className="flex gap-2 items-center">
          {/* Mic button - always visible, but size varies by mode */}
          <Button
            variant={isRecording ? "destructive" : effectiveInputMode === "voice" ? "default" : "outline"}
            size={effectiveInputMode === "voice" ? "default" : "icon"}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={!isRecording && (isAudioPlaying || playingMessageIdx !== null || isChatLoading || effectiveInputMode === "text")}
            className={`shrink-0 relative ${effectiveInputMode === "voice" ? "w-12 h-12" : "w-9 h-9"}`}
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

          {/* Text Input - hidden in voice input mode on mobile, always shown on desktop */}
          {(!isMobile || effectiveInputMode === "text") && (
            <div className="flex-1 relative">
              <Input
                ref={chatInputRef}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                placeholder={
                  isRecording
                    ? "Listening..."
                    : isMobile
                      ? "Type your message..."
                      : "Type your sales pitch..."
                }
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
          )}

          {/* Voice mode: show send area spacer */}
          {isMobile && effectiveInputMode === "voice" && (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-xs text-muted-foreground">
                {isRecording
                  ? `Recording · ${recordingDuration}s`
                  : isAudioPlaying
                    ? "Listening..."
                    : "Tap mic to speak"
                }
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

  // ─── RENDER: Roleplay Session ───────────────────────────────────────────────

  // ─── Sidebar content (shared between desktop & mobile sheet) ─────────────────
  const renderSidebarContent = () => (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Persona Profile</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="text-center">
            <PersonaAvatar src={selectedPersona?.avatar || "/avatars/p1_faisal.png"} alt={selectedPersona?.name || "Persona"} size="md" />
            <div className="font-semibold">{selectedPersona?.name}</div>
            <div className="text-xs text-muted-foreground">{selectedPersona?.nationality} · Age {selectedPersona?.age}</div>
            {selectedPersona && (
              <div className="mt-2">{getPersonaTypeBadge(selectedPersona.id)}</div>
            )}
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
                    isActive ? "text-sky-500" :
                    isComplete ? "text-emerald-500" :
                    "text-slate-400"
                  }`} />
                  <div>
                    <div className={`font-medium ${
                      isActive ? "text-sky-700" :
                      isComplete ? "text-emerald-700 line-through" :
                      "text-slate-500"
                    }`}>{s.label}</div>
                    <div className={`${
                      isActive ? "text-sky-600" :
                      isComplete ? "text-emerald-600" :
                      "text-slate-400"
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
          <ScrollArea className="max-h-32">
            <ul className="space-y-1.5">
              {selectedPersona?.objections.map((obj, i) => (
                <li key={i} className="text-xs flex items-start gap-2 p-1.5 rounded bg-amber-50">
                  <span className="font-bold text-amber-600">{i + 1}</span><span className="text-amber-800">{obj}</span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Target className="w-4 h-4 text-emerald-500" /> How to Win</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="max-h-32">
            <ul className="space-y-1.5">
              {selectedPersona?.winConditions.map((cond, i) => (
                <li key={i} className="text-xs flex items-start gap-2 p-1.5 rounded bg-emerald-50">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" /><span className="text-emerald-800">{cond}</span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><XCircle className="w-4 h-4 text-red-500" /> How to Lose</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="max-h-32">
            <ul className="space-y-1.5">
              {selectedPersona?.loseConditions.map((cond, i) => (
                <li key={i} className="text-xs flex items-start gap-2 p-1.5 rounded bg-red-50">
                  <XCircle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" /><span className="text-red-800">{cond}</span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  const renderRoleplay = () => (
    <div className={isMobile ? "space-y-2" : "space-y-6"}>
      {/* Header - compact on mobile */}
      <div className={`flex ${isMobile ? "flex-col gap-2" : "flex-col sm:flex-row sm:items-center justify-between gap-3"}`}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => {
            if (roleplayStatus === "active") {
              if (confirm("End the current session?")) handleEndSession();
            }
            setView("dashboard"); setRoleplayStatus("idle");
          }} className="shrink-0">
            {isMobile ? "←" : "Back"}
          </Button>
          {selectedPersona && (
            <div className="flex items-center gap-2 min-w-0">
              <PersonaAvatar src={selectedPersona.avatar} alt={selectedPersona.name} size={isMobile ? "sm" : "md"} />
              <div className="min-w-0">
                <div className={`font-semibold truncate ${isMobile ? "text-sm" : ""}`}>{selectedPersona.name}</div>
                {!isMobile && <div className="text-xs text-muted-foreground">{selectedPersona.title} · {selectedPersona.company}</div>}
              </div>
            </div>
          )}
          {!isMobile && (
            <div className="hidden sm:flex items-center gap-1.5 ml-2 px-2 py-1 rounded-md bg-slate-50 border border-slate-200">
              <Image src="/sgc-tech-logo.png" alt="SGC TECH" width={16} height={16} className="rounded-sm" />
              <span className="text-[10px] font-semibold text-slate-500 tracking-wide">SGC TECH</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {getDiffBadge(selectedPersona?.difficulty || "medium")}
          {selectedPersona && getPersonaTypeBadge(selectedPersona.id)}
          <Badge variant={mode === "text" ? "default" : "outline"} className="gap-1">
            {mode === "text" ? <><Type className="w-3 h-3" /> Chat</> : <><Phone className="w-3 h-3" /> Voice</>}
          </Badge>
          {roleplayStatus === "active" && (
            <div className="flex items-center gap-1 text-sm font-mono text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />{formatTime(callTimer)}
            </div>
          )}
          {/* Conversation Stage Indicator */}
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
                <cfg.icon className="w-2.5 h-2.5" />
                {cfg.label}
              </span>
            );
          })()}
          {/* Auto-Voice Toggle - only show in text chat mode, desktop only */}
          {mode === "text" && roleplayStatus === "active" && !isMobile && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <Volume2 className="w-3.5 h-3.5" />
                Auto-Voice
                <Switch
                  checked={autoVoice}
                  onCheckedChange={setAutoVoice}
                  className="scale-75"
                />
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
              <SheetContent side="right" className="w-[300px] overflow-y-auto p-4">
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
      <div className={`grid grid-cols-1 ${isMobile ? "" : "lg:grid-cols-3"} ${isMobile ? "gap-2" : "gap-6"}`}>
        <div className={isMobile ? "" : "lg:col-span-2"}>
          {renderChatArea()}
        </div>

        {/* Sidebar: Desktop only */}
        {!isMobile && (
          <div className="space-y-4">
            {renderSidebarContent()}
          </div>
        )}
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
                  { key: "won" as const, label: "Won", icon: CheckCircle2, color: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100", activeColor: "border-emerald-500 bg-emerald-100 text-emerald-800 ring-2 ring-emerald-500" },
                  { key: "partial" as const, label: "Partial", icon: Pause, color: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100", activeColor: "border-amber-500 bg-amber-100 text-amber-800 ring-2 ring-amber-500" },
                  { key: "lost" as const, label: "Lost", icon: XCircle, color: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100", activeColor: "border-red-500 bg-red-100 text-red-800 ring-2 ring-red-500" },
                ]).map(outcome => (
                  <button
                    key={outcome.key}
                    onClick={() => setEndOutcome(outcome.key)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                      endOutcome === outcome.key ? outcome.activeColor : outcome.color
                    }`}
                  >
                    <outcome.icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{outcome.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Notes (optional)</label>
              <Textarea
                placeholder="What went well? What could you improve?"
                value={endNotes}
                onChange={e => setEndNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowEndDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveEndSession} className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Save & Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // ─── RENDER: Session History ────────────────────────────────────────────────

  const renderHistory = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold">Session History</h2><p className="text-muted-foreground">Track your roleplay performance</p></div>
        <Button variant="ghost" onClick={() => setView("dashboard")}>Back to Dashboard</Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Sessions", value: sessions.length, icon: BarChart3 },
          { label: "Wins", value: sessions.filter(s => s.outcome === "won").length, icon: Award },
          { label: "Avg Duration", value: sessions.length > 0 ? formatTime(Math.round(sessions.reduce((a, s) => a + (s.duration || 0), 0) / sessions.length)) : "00:00", icon: Clock },
          { label: "Win Rate", value: sessions.filter(s => s.status === "completed").length > 0 ? `${Math.round(sessions.filter(s => s.outcome === "won").length / sessions.filter(s => s.status === "completed").length * 100)}%` : "0%", icon: TrendingUp },
        ].map(stat => (
          <Card key={stat.label}><CardContent className="p-4">
            <stat.icon className="w-5 h-5 text-muted-foreground mb-2" />
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </CardContent></Card>
        ))}
      </div>
      {sessions.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-lg mb-1">No sessions yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Start your first roleplay session</p>
          <Button onClick={() => setView("select")} className="gap-2"><Play className="w-4 h-4" /> Start Roleplay</Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">{sessions.map(session => {
          const persona = PERSONAS.find(p => p.id === session.personaId);
          return (
            <Card key={session.id}><CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {persona && <PersonaAvatar src={persona.avatar} alt={persona.name} size="md" />}
                <div>
                  <div className="font-medium text-sm">{persona?.name || session.personaId}</div>
                  <div className="text-xs text-muted-foreground">{new Date(session.createdAt).toLocaleDateString()} · {formatTime(session.duration || 0)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {persona && getPersonaTypeBadge(persona.id)}
                {session.outcome === "won" && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Won</Badge>}
                {session.outcome === "lost" && <Badge className="bg-red-100 text-red-700 border-red-200">Lost</Badge>}
                {session.outcome === "partial" && <Badge className="bg-amber-100 text-amber-700 border-amber-200">Partial</Badge>}
                {!session.outcome && <Badge variant="secondary">{session.status}</Badge>}
              </div>
            </CardContent></Card>
          );
        })}</div>
      )}
    </div>
  );

  // ─── Main Layout ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => { setView("dashboard"); setRoleplayStatus("idle"); }}>
              <Image src="/sgc-tech-logo.png" alt="SGC TECH" width={32} height={32} className="rounded" />
              <div className="flex flex-col leading-tight">
                <span className="font-bold text-sm tracking-wide">SGC TECH</span>
                <span className="text-[10px] text-muted-foreground -mt-0.5">Sales Roleplay Arena</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {[
                { key: "dashboard", label: "Dashboard", icon: BarChart3 },
                { key: "select", label: "Personas", icon: Users },
                { key: "history", label: "History", icon: Clock },
              ].map(item => (
                <Button key={item.key} variant={view === item.key ? "secondary" : "ghost"} size="sm" onClick={() => { setView(item.key as AppView); if (item.key !== "roleplay") setRoleplayStatus("idle"); }} className="gap-1.5">
                  <item.icon className="w-4 h-4" /><span className="hidden sm:inline">{item.label}</span>
                </Button>
              ))}
              <Separator orientation="vertical" className="h-6 mx-1" />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 text-muted-foreground hover:text-foreground">
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Logout</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </header>

      <main className={`flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full ${isMobile && view === "roleplay" ? "py-2" : "py-6"}`}>
        <AnimatePresence mode="wait">
          <motion.div key={view} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
            {view === "dashboard" && renderDashboard()}
            {view === "select" && renderPersonaSelection()}
            {view === "roleplay" && renderRoleplay()}
            {view === "history" && renderHistory()}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="mt-auto border-t bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Image src="/sgc-tech-logo.png" alt="SGC TECH" width={24} height={24} className="rounded" />
              <div className="flex flex-col leading-tight">
                <span className="font-semibold text-white">SGC TECH</span>
                <span className="text-slate-400">Sales Roleplay Arena — AI + Deepgram Voice</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-slate-400">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{PERSONAS.length} Personas</span>
              <span className="flex items-center gap-1"><Volume2 className="w-3 h-3" />Deepgram Voice</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Session End Dialog */}
      {renderEndDialog()}
    </div>
  );
}
