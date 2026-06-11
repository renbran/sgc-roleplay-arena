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
  PanelRightOpen, Keyboard, AlertCircle, Trophy,
  Medal, Filter, ArrowUpDown, Search
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

const AUTH_STORAGE_KEY = "sgc-roleplay-auth-v2";
const USER_NAME_STORAGE_KEY = "sgc-roleplay-username-v2";
const SCORES_STORAGE_KEY = "sgc-roleplay-scores-v2";
const PENDING_SCORE_KEY = "sgc-roleplay-pending-score-v2";
const ACTIVE_SESSION_KEY = "sgc-roleplay-active-session-v2";
const APP_PASSWORD = process.env.NEXT_PUBLIC_APP_PASSWORD || "SGC2025";

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

type AppView = "dashboard" | "select" | "roleplay" | "history" | "leaderboard";
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

interface ScoreRecord {
  id: string;
  userName: string;
  personaId: string;
  personaName: string;
  date: string;
  duration: number;
  rapport: number;
  discovery: number;
  objectionHandling: number;
  closing: number;
  overall: number;
  grade: "A" | "B" | "C" | "D" | "F";
  outcome: "booked" | "partial" | "lost";
  summary: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGradeColor(grade: string) {
  if (grade === "A") return "bg-emerald-100 text-emerald-700 border-emerald-300";
  if (grade === "B") return "bg-sky-100 text-sky-700 border-sky-300";
  if (grade === "C") return "bg-amber-100 text-amber-700 border-amber-300";
  if (grade === "D") return "bg-orange-100 text-orange-700 border-orange-300";
  return "bg-red-100 text-red-700 border-red-300";
}

// ─── Main App ────────────────────────────────────────────────────────────────

export default function Home() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNameStep, setShowNameStep] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState("");
  const [userName, setUserName] = useState<string>("");

  const [view, setView] = useState<AppView>("dashboard");
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [mode, setMode] = useState<RoleplayMode>("text");
  const [roleplayStatus, setRoleplayStatus] = useState<RoleplayStatus>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [savedScores, setSavedScores] = useState<ScoreRecord[]>([]);
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showTips, setShowTips] = useState(true);
  const [sessionNotes, setSessionNotes] = useState("");
  const [callTimer, setCallTimer] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const isMobile = useIsMobile();
  const [inputMode, setInputMode] = useState<"text" | "voice">("text");
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Leaderboard state
  const [leaderboardScores, setLeaderboardScores] = useState<Array<{
    id: string; rank: number; userName: string; personaName: string;
    personaId: string; overall: number; grade: string; outcome: string;
    duration: number; createdAt: string; rapport: number; discovery: number;
    objectionHandling: number; closing: number; difficulty: string;
  }>>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [lbTimeframe, setLbTimeframe] = useState<"all" | "month" | "week" | "today">("all");
  const [lbPersonaFilter, setLbPersonaFilter] = useState("all");

  // Text chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string>("");
  const [conversationStage, setConversationStage] = useState<string>("guarded");

  // Booking + auto-score state
  const [sessionBooked, setSessionBooked] = useState(false);
  interface AutoScore {
    rapport: number; discovery: number; objectionHandling: number; closing: number;
    overall: number; grade: "A" | "B" | "C" | "D" | "F";
    summary: string; strengths: string[]; improvements: string[];
    outcome: "booked" | "partial" | "lost";
  }
  const [autoScore, setAutoScore] = useState<AutoScore | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [scoreFailed, setScoreFailed] = useState(false);

  // Lead capture form state (shown after booking)
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadFormSubmitted, setLeadFormSubmitted] = useState(false);
  const [leadFormData, setLeadFormData] = useState({ fullName: "", email: "", mobile: "" });
  const [leadFormLoading, setLeadFormLoading] = useState(false);
  const [leadFormError, setLeadFormError] = useState<string | null>(null);
  const [bookingToken, setBookingToken] = useState<string>("");
  const [pendingScoreRecovery, setPendingScoreRecovery] = useState<{
    score: AutoScore; personaId: string; personaName: string;
    userName: string; duration: number; date: string;
  } | null>(null);

  // TTS state
  const [playingMessageIdx, setPlayingMessageIdx] = useState<number | null>(null);
  const [ttsLoading, setTtsLoading] = useState<number | null>(null);
  const [autoVoice, setAutoVoice] = useState(false);
  const ttsWarmedUp = useRef(false);
  const audioUnlockedRef = useRef(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const ttsAudioContextRef = useRef<AudioContext | null>(null);
  const ttsSourceRef = useRef<AudioBufferSourceNode | null>(null);
  // Ref for latest playTTS to avoid stale closures in setTimeout
  const playTTSRef = useRef<((text: string, messageIdx: number) => Promise<void>) | undefined>(undefined);
  const startRecordingRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const shouldResumeRecordingAfterTTSRef = useRef(false);
  // Refs for recording guard conditions to avoid stale closures
  const isAudioPlayingRef = useRef(false);
  const playingMessageIdxRef = useRef<number | null>(null);
  const isChatLoadingRef = useRef(false);

  // Microphone recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [voiceStatus, setVoiceStatus] = useState<string>("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartRef = useRef<number>(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isStoppingRef = useRef(false);
  const recordingMimeTypeRef = useRef<string>("audio/webm");

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
    let storedName = "";
    if (stored === "true") {
      setIsAuthenticated(true);
      storedName = localStorage.getItem(USER_NAME_STORAGE_KEY) || "";
      if (storedName) setUserName(storedName);
    }
    try {
      const storedScores = localStorage.getItem(SCORES_STORAGE_KEY);
      if (storedScores) setSavedScores(JSON.parse(storedScores));
    } catch { /* corrupt data — ignore */ }
    // Recover any score that was computed but never saved (e.g. tab closed mid-dialog)
    try {
      const pending = localStorage.getItem(PENDING_SCORE_KEY);
      if (pending) {
        const ps = JSON.parse(pending);
        if (ps.userName && ps.score && ps.personaName) {
          setPendingScoreRecovery(ps);
        }
      }
    } catch { /* corrupt data — ignore */ }
  }, []);

  const handleLogin = async () => {
    // Try server-side verification first
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: authPassword }),
      });
      const data = await res.json();
      if (data.verified) {
        localStorage.setItem(AUTH_STORAGE_KEY, "true");
        setAuthError("");
        const storedName = localStorage.getItem(USER_NAME_STORAGE_KEY);
        if (storedName) {
          setUserName(storedName);
          setIsAuthenticated(true);
        } else {
          setShowNameStep(true);
        }
        return;
      }
    } catch {
      // API unreachable — fall back to client-side check (dev/offline)
    }

    // Fallback: client-side check against env var
    if (authPassword === APP_PASSWORD) {
      localStorage.setItem(AUTH_STORAGE_KEY, "true");
      setAuthError("");
      const storedName = localStorage.getItem(USER_NAME_STORAGE_KEY);
      if (storedName) {
        setUserName(storedName);
        setIsAuthenticated(true);
      } else {
        setShowNameStep(true);
      }
    } else {
      setAuthError("Invalid password. Please try again.");
    }
  };

  const handleNameSubmit = () => {
    const name = nameInput.trim();
    if (!name) { setNameError("Please enter your name."); return; }
    localStorage.setItem(USER_NAME_STORAGE_KEY, name);
    setUserName(name);
    setIsAuthenticated(true);
    setShowNameStep(false);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthPassword("");
  };

  // ─── Audio Unlock (for mobile browsers) ──────────────────────────────────
  // Mobile browsers require a user gesture before audio can play.
  // Keep listener active on every gesture so the AudioContext gets re-resumed
  // if the browser suspends it between conversations.
  useEffect(() => {
    const unlock = () => {
      audioUnlockedRef.current = true;
      // Resume AudioContext on every user gesture — browser may suspend it between sessions
      try {
        if (!ttsAudioContextRef.current || ttsAudioContextRef.current.state === 'closed') {
          ttsAudioContextRef.current = new AudioContext();
        }
        if (ttsAudioContextRef.current.state === 'suspended') {
          ttsAudioContextRef.current.resume().catch(() => {});
        }
      } catch { /* AudioContext not supported */ }
    };
    document.addEventListener('click', unlock);
    document.addEventListener('touchstart', unlock);
    document.addEventListener('keydown', unlock);
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
      // Warm up the TTS backend (Deepgram + ZAI)
      fetch("/api/roleplay/tts", { method: "GET" })
        .then(res => res.json())
        .catch(() => { /* warmup failure is non-critical */ });
    }
  }, [isAuthenticated]);

  // ─── Stop current TTS ───────────────────────────────────────────────────────

  const stopTTS = useCallback(() => {
    // Cancel Web Audio API playback
    if (ttsSourceRef.current) {
      try { ttsSourceRef.current.stop(); } catch { /* already stopped */ }
      ttsSourceRef.current = null;
    }
    setPlayingMessageIdx(null);
    setIsAudioPlaying(false);
    playingMessageIdxRef.current = null;
    isAudioPlayingRef.current = false;
    shouldResumeRecordingAfterTTSRef.current = false;
    setTtsLoading(null);
  }, []);

  // ─── TTS Playback ───────────────────────────────────────────────────────────
  // Uses Deepgram Aura-2 voices via backend API — 11 distinct English voices
  // with different tone/pitch for each persona. Falls back to ZAI TTS if
  // Deepgram is unavailable.

  const playTTS = useCallback(async (text: string, messageIdx: number) => {
    // If clicking the same message that's playing, stop it
    if (playingMessageIdx === messageIdx) {
      stopTTS();
      return;
    }

    // Stop any current audio, but preserve pending auto-listen intent for this playback
    const resumeAfterPlayback = shouldResumeRecordingAfterTTSRef.current;
    stopTTS();
    shouldResumeRecordingAfterTTSRef.current = resumeAfterPlayback;
    setTtsLoading(messageIdx);
    setTtsError(null);

    // Resume AudioContext NOW, inside the user-gesture window, before any async work.
    // If called after a fetch (which takes seconds), the gesture window has expired
    // and resume() throws NotAllowedError on the second+ call.
    let audioContext = ttsAudioContextRef.current;
    try {
      if (!audioContext || audioContext.state === 'closed') {
        audioContext = new AudioContext();
        ttsAudioContextRef.current = audioContext;
      }
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
    } catch { /* will retry resume after fetch if needed */ }

    try {
      // Call backend TTS API — now routes through Deepgram Aura-2 voices
      // with persona-specific voice mapping (11 distinct voices)
      const res = await fetch("/api/roleplay/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.slice(0, 2000),
          voice: selectedPersona?.voiceId || "aura-2-asteria-en",
          personaId: selectedPersona?.id || "",
        }),
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
      if (!contentType.includes('audio') && !contentType.includes('wav') && !contentType.includes('mpeg')) {
        console.warn("[tts] Unexpected content type:", contentType);
        setTtsLoading(null);
        setTtsError('Invalid audio response');
        return;
      }

      const provider = res.headers.get('X-TTS-Provider') || 'unknown';

      // Get audio data as ArrayBuffer for Web Audio API
      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength < 100) {
        setTtsLoading(null);
        setTtsError('Empty audio response');
        return;
      }

      // Reuse the already-running AudioContext (created/resumed before the fetch above)
      if (!audioContext || audioContext.state === 'closed') {
        audioContext = new AudioContext();
        ttsAudioContextRef.current = audioContext;
      }
      // Second resume attempt — handles edge cases where context was suspended between calls
      if (audioContext.state === 'suspended') {
        try { await audioContext.resume(); } catch { /* ignore */ }
      }

      // Decode the WAV audio data
      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      } catch (decodeErr) {
        console.error('[tts] Audio decode error:', decodeErr);
        setTtsLoading(null);
        setTtsError('Audio format not supported');
        return;
      }

      // Create and play the audio source
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      ttsSourceRef.current = source;

      setPlayingMessageIdx(messageIdx);
      setIsAudioPlaying(true);
      playingMessageIdxRef.current = messageIdx;
      isAudioPlayingRef.current = true;
      setTtsLoading(null);

      const finishPlayback = () => {
        setPlayingMessageIdx(null);
        setIsAudioPlaying(false);
        playingMessageIdxRef.current = null;
        isAudioPlayingRef.current = false;
        ttsSourceRef.current = null;

        if (shouldResumeRecordingAfterTTSRef.current) {
          shouldResumeRecordingAfterTTSRef.current = false;
          setTimeout(() => {
            if (startRecordingRef.current) {
              startRecordingRef.current();
            }
          }, 250);
        }
      };

      // Safety timeout: ensure refs get reset even if onended doesn't fire
      const audioDuration = audioBuffer.duration * 1000 + 500;
      const safetyTimer = setTimeout(() => {
        if (playingMessageIdxRef.current === messageIdx) {
          finishPlayback();
        }
      }, audioDuration);

      source.onended = () => {
        clearTimeout(safetyTimer);
        finishPlayback();
      };

      source.start(0);

    } catch (err: unknown) {
      stopTTS();
      const errName = err instanceof Error ? err.name : '';
      if (errName === 'NotAllowedError') {
        setTtsError('Tap again to play audio');
      } else {
        setTtsError('Voice unavailable');
      }

      if (shouldResumeRecordingAfterTTSRef.current) {
        shouldResumeRecordingAfterTTSRef.current = false;
        setTimeout(() => {
          if (startRecordingRef.current) {
            startRecordingRef.current();
          }
        }, 250);
      }
    }
  }, [playingMessageIdx, stopTTS, selectedPersona]);

  // Keep ref updated to avoid stale closures in setTimeout/auto-voice
  useEffect(() => {
    playTTSRef.current = playTTS;
  }, [playTTS]);

  // Sync state → refs for reliable guard condition checks
  useEffect(() => {
    isAudioPlayingRef.current = isAudioPlaying;
  }, [isAudioPlaying]);
  useEffect(() => {
    playingMessageIdxRef.current = playingMessageIdx;
  }, [playingMessageIdx]);
  useEffect(() => {
    isChatLoadingRef.current = isChatLoading;
  }, [isChatLoading]);

  // ─── Microphone Recording ───────────────────────────────────────────────────

  const sendChatMessageWithText = useCallback(async (text: string, fromVoice = false) => {
    if (!text.trim() || !selectedPersona || isChatLoadingRef.current) return;
    const userMsg = text.trim();
    if (!fromVoice && mode !== "voice") setInputMode("text");
    setChatMessages(prev => [...prev, { role: "user", content: userMsg, timestamp: Date.now() }]);
    setIsChatLoading(true);
    isChatLoadingRef.current = true;

    try {
      const res = await fetch("/api/roleplay/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: chatSessionId, message: userMsg, personaId: selectedPersona.id, userName }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.stage) {
          setConversationStage(data.stage);
        }
        if (data.booked) {
          setBookingToken(data.bookingToken || "");
          if (!leadFormSubmitted) {
            setShowLeadForm(true);
          } else {
            setSessionBooked(true);
            setEndOutcome("won");
          }
        }

        const shouldContinueVoiceTurn = mode === "voice" && !data.booked;
        let autoPlayIdx: number | null = null;
        setChatMessages(prev => {
          const newMessages: ChatMessage[] = [...prev, { role: "assistant" as const, content: String(data.response), timestamp: Date.now() }];
          if (autoVoice && audioUnlockedRef.current) {
            autoPlayIdx = newMessages.length - 1;
          }
          return newMessages;
        });

        if (shouldContinueVoiceTurn) {
          shouldResumeRecordingAfterTTSRef.current = true;
        }

        // Fire auto-voice outside the updater to avoid double-invoke in React Strict Mode
        if (autoPlayIdx !== null) {
          const idx = autoPlayIdx;
          setTimeout(() => {
            if (playTTSRef.current) {
              playTTSRef.current(data.response, idx);
            }
          }, 300);
        } else if (shouldContinueVoiceTurn) {
          // If autoplay is blocked/unavailable, continue turn-taking by listening again.
          shouldResumeRecordingAfterTTSRef.current = false;
          setTimeout(() => {
            if (startRecordingRef.current) {
              startRecordingRef.current();
            }
          }, 300);
        }
      } else {
        setChatMessages(prev => [...prev, { role: "system", content: `Error: ${data.error}`, timestamp: Date.now() }]);
      }
    } catch {
      setChatMessages(prev => [...prev, { role: "system", content: "Connection error. Please try again.", timestamp: Date.now() }]);
    }
    setIsChatLoading(false);
    isChatLoadingRef.current = false;
  }, [selectedPersona, chatSessionId, autoVoice, userName, mode]);

  // ─── Lead form submission (post-booking Odoo provisioning) ──────────────────

  const submitLeadForm = useCallback(async () => {
    if (!leadFormData.fullName.trim() || !leadFormData.email.trim() || !leadFormData.mobile.trim()) {
      setLeadFormError("All fields are required.");
      return;
    }
    setLeadFormLoading(true);
    setLeadFormError(null);
    try {
      const res = await fetch("/api/booking/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: leadFormData.fullName,
          email: leadFormData.email,
          mobile: leadFormData.mobile,
          personaId: selectedPersona?.id,
          sessionId: chatSessionId,
          bookingToken,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        setLeadFormError(result.error || "Something went wrong. Please try again.");
      } else {
        setLeadFormSubmitted(true);
        setShowLeadForm(false);
        setSessionBooked(true);
        setEndOutcome("won");
      }
    } catch {
      setLeadFormError("Network error. Please try again.");
    } finally {
      setLeadFormLoading(false);
    }
  }, [leadFormData, selectedPersona, chatSessionId, bookingToken]);

  // ─── Voice Recording (manual stop) ──────────────────────────────────────────

  const MIN_RECORDING_DURATION = 800;

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
      setVoiceStatus("No speech detected. Please speak closer to the mic and try again.");
      setIsRecording(false);
      setRecordingDuration(0);
      isStoppingRef.current = false;
      return;
    }

    setIsRecording(false);
    setRecordingDuration(0);

    try {
      const recordedMimeType = recordingMimeTypeRef.current || "audio/webm";
      const audioBlob = new Blob(chunks, { type: recordedMimeType });

      if (audioBlob.size < 1000) {
        setVoiceStatus("Audio was too quiet. Try again with a louder voice.");
        isStoppingRef.current = false;
        return;
      }

      const base64Audio = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = (reader.result as string).split(",")[1];
          resolve(result || null);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(audioBlob);
      });

      if (!base64Audio) {
        setVoiceStatus("Could not process recorded audio. Please retry.");
        isStoppingRef.current = false;
        return;
      }

      try {
        const res = await fetch("/api/roleplay/asr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: base64Audio, mimeType: recordedMimeType }),
        });
        const data = await res.json();
        if (data.success && data.text && data.text.trim()) {
          setVoiceStatus("");
          await sendChatMessageWithText(data.text.trim(), true);
        } else {
          setVoiceStatus("Could not transcribe clearly. Please retry.");
        }
      } catch (err) {
        console.error("ASR error:", err);
        setVoiceStatus("Speech service is temporarily unavailable. Please retry.");
      } finally {
        isStoppingRef.current = false;
      }
    } catch (err) {
      console.error("Audio processing error:", err);
      setVoiceStatus("Audio processing failed. Please retry.");
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
    // Use refs for guard checks to avoid stale closure issues
    if (isAudioPlayingRef.current || playingMessageIdxRef.current !== null) {
      setVoiceStatus("Stop voice playback before recording.");
      return;
    }
    if (isRecording || isStoppingRef.current) {
      setVoiceStatus("Recording is already in progress.");
      return;
    }
    if (isChatLoadingRef.current) {
      setVoiceStatus("Please wait for the assistant response before recording.");
      return;
    }
    setVoiceStatus("");
    setChatInput("");
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

      recordingMimeTypeRef.current = mimeType;
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      isStoppingRef.current = false;

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


      mediaRecorder.start(250);
      recordingStartRef.current = Date.now();
      setIsRecording(true);
      setRecordingDuration(0);
      setVoiceStatus("Recording live. Tap the mic again to stop and transcribe.");

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(Math.round((Date.now() - recordingStartRef.current) / 1000));
      }, 500);

    } catch (err) {
      console.error("Microphone access error:", err);
      setVoiceStatus("Microphone access was blocked. Allow mic permission and retry.");
      setIsRecording(false);
    }
  }, [isRecording, stopRecording, processRecordedAudio]);

  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      if (data.sessions) setSessions(data.sessions);
    } catch { /* ignore */ }
  }, []);

  const fetchLeaderboard = useCallback(async (timeframe = lbTimeframe, personaId = lbPersonaFilter) => {
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (timeframe !== "all") params.set("timeframe", timeframe);
      if (personaId !== "all") params.set("personaId", personaId);
      const res = await fetch(`/api/scores?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setLeaderboardScores(data.scores || []);
      } else {
        setLeaderboardError(data.error || "Failed to load leaderboard");
      }
    } catch {
      setLeaderboardError("Network error loading leaderboard");
    }
    setLeaderboardLoading(false);
  }, [lbTimeframe, lbPersonaFilter]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSessions();
      fetchLeaderboard();
    }
  }, [fetchSessions, isAuthenticated, fetchLeaderboard]);

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

  // Warn browser before tab close/refresh during active session
  useEffect(() => {
    if (roleplayStatus !== "active") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [roleplayStatus]);

  // Checkpoint active session to localStorage so it survives accidental refresh
  useEffect(() => {
    if (roleplayStatus !== "active" || !selectedPersona) return;
    const userMsgs = chatMessages.filter(m => m.role !== "system");
    if (userMsgs.length === 0) return;
    try {
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({
        personaId: selectedPersona.id,
        personaName: selectedPersona.name,
        userName,
        messageCount: userMsgs.length,
        lastMessage: userMsgs[userMsgs.length - 1]?.content?.slice(0, 120) ?? "",
        callTimer,
        timestamp: Date.now(),
      }));
    } catch { /* storage full */ }
  }, [chatMessages, roleplayStatus, selectedPersona, userName, callTimer]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ─── Roleplay Actions ───────────────────────────────────────────────────────

  const startTextRoleplay = (persona: Persona) => {
    stopTTS();
    setTtsError(null);
    isStoppingRef.current = false;
    setSessionBooked(false);
    setAutoScore(null);
    setIsScoring(false);
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
      { role: "system", content: `You are now in a sales roleplay with ${persona.name}${userName ? ` — rep: ${userName}` : ""}. Ask great questions to discover their pain points.`, timestamp: Date.now() },
      openingMsg,
    ]);
    // Don't auto-play TTS on start - let user click the speaker button
    setTimeout(() => chatInputRef.current?.focus(), 300);
  };

  const startVoiceRoleplay = (persona: Persona) => {
    stopTTS();
    setTtsError(null);
    isStoppingRef.current = false;
    setSessionBooked(false);
    setAutoScore(null);
    setIsScoring(false);
    // Re-resume AudioContext here — we're inside a click handler (user gesture)
    try {
      if (!ttsAudioContextRef.current || ttsAudioContextRef.current.state === 'closed') {
        ttsAudioContextRef.current = new AudioContext();
      }
      if (ttsAudioContextRef.current.state === 'suspended') {
        ttsAudioContextRef.current.resume().catch(() => {});
      }
    } catch { /* AudioContext not supported */ }
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
    audioUnlockedRef.current = true;
    const sid = `voice-${persona.id}-${Date.now()}`;
    setChatSessionId(sid);
    setSessionId(sid);
    setConversationStage("guarded");
    const openingMsg = { role: "assistant" as const, content: persona.openingLine, timestamp: Date.now() };
    setChatMessages([
      { role: "system", content: `Voice call with ${persona.name}${userName ? ` — rep: ${userName}` : ""}. Tap the mic button to speak, or type your message.`, timestamp: Date.now() },
      openingMsg,
    ]);
    // Auto-play opening line and then automatically open mic for continuous turn-taking.
    shouldResumeRecordingAfterTTSRef.current = true;
    setTimeout(() => {
      if (playTTSRef.current) {
        playTTSRef.current(openingMsg.content, 1);
      }
    }, 400);
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

    shouldResumeRecordingAfterTTSRef.current = false;
    setRoleplayStatus("ended");
    fetchSessions();
  };

  const triggerAutoScore = useCallback(async () => {
    if (!selectedPersona || isScoring || autoScore) return;
    const scorableMessages = chatMessages.filter(m => m.role === "user" || m.role === "assistant");
    if (scorableMessages.length < 4) return;
    setIsScoring(true);
    setScoreFailed(false);
    try {
      const res = await fetch("/api/roleplay/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: scorableMessages, personaId: selectedPersona.id, userName }),
      });
      if (!res.ok) { setScoreFailed(true); setIsScoring(false); return; }
      const data = await res.json();
      if (data.success && data.score) {
        setAutoScore(data.score);
        // Backup score immediately — survives dialog close or tab crash
        try {
          localStorage.setItem(PENDING_SCORE_KEY, JSON.stringify({
            score: data.score,
            personaId: selectedPersona.id,
            personaName: selectedPersona.name,
            userName,
            duration: callTimer,
            date: new Date().toISOString(),
          }));
        } catch { /* storage full */ }
        if (!sessionBooked) {
          setEndOutcome(data.score.outcome === "booked" ? "won" : data.score.outcome === "lost" ? "lost" : "partial");
        }
      } else {
        setScoreFailed(true);
      }
    } catch {
      setScoreFailed(true);
    }
    setIsScoring(false);
  }, [selectedPersona, isScoring, autoScore, chatMessages, sessionBooked, userName, callTimer]);

  const handleEndSession = () => {
    setShowEndDialog(true);
    triggerAutoScore();
  };

  const persistScore = useCallback((score: AutoScore) => {
    if (!selectedPersona || !userName) return;
    const record: ScoreRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userName,
      personaId: selectedPersona.id,
      personaName: selectedPersona.name,
      date: new Date().toISOString(),
      duration: callTimer,
      rapport: score.rapport,
      discovery: score.discovery,
      objectionHandling: score.objectionHandling,
      closing: score.closing,
      overall: score.overall,
      grade: score.grade,
      outcome: score.outcome,
      summary: score.summary,
    };
    setSavedScores(prev => {
      const updated = [record, ...prev].slice(0, 200);
      try {
        localStorage.setItem(SCORES_STORAGE_KEY, JSON.stringify(updated));
        localStorage.removeItem(PENDING_SCORE_KEY);
        localStorage.removeItem(ACTIVE_SESSION_KEY);
      } catch { /* storage full */ }
      return updated;
    });
    fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName,
        personaId: selectedPersona.id,
        personaName: selectedPersona.name,
        difficulty: selectedPersona.difficulty,
        rapport: score.rapport,
        discovery: score.discovery,
        objectionHandling: score.objectionHandling,
        closing: score.closing,
        overall: score.overall,
        grade: score.grade,
        outcome: score.outcome,
        summary: score.summary,
        strengths: score.strengths,
        improvements: score.improvements,
        duration: callTimer,
      }),
    }).catch(() => {});
  }, [selectedPersona, userName, callTimer]);

  const handleSaveEndSession = async () => {
    if (autoScore) persistScore(autoScore);
    try { localStorage.removeItem(ACTIVE_SESSION_KEY); } catch { /* ignore */ }
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
                {showNameStep ? "One more step — tell us your name" : "Enter your access password to continue"}
              </CardDescription>
            </CardHeader>
            {!showNameStep ? (
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
            ) : (
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-slate-400 text-center">
                    Your name will appear in scorecard feedback and is used by the AI persona during the call.
                  </p>
                  <Input
                    placeholder="Your full name"
                    value={nameInput}
                    onChange={e => { setNameInput(e.target.value); setNameError(""); }}
                    onKeyDown={e => { if (e.key === "Enter") handleNameSubmit(); }}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500"
                    autoFocus
                  />
                  {nameError && (
                    <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-red-400 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> {nameError}
                    </motion.p>
                  )}
                </div>
                <Button onClick={handleNameSubmit} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2" size="lg">
                  <ArrowRight className="w-4 h-4" /> Enter Arena
                </Button>
              </CardContent>
            )}
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

  // ─── RENDER: Name Registration (returning users with no stored name) ────────

  if (isAuthenticated && !userName) {
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
              <CardTitle className="text-xl text-white">Welcome to the Arena</CardTitle>
              <CardDescription className="text-slate-400">What should the AI call you during your roleplays?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="Your full name"
                  value={nameInput}
                  onChange={e => { setNameInput(e.target.value); setNameError(""); }}
                  onKeyDown={e => { if (e.key === "Enter") handleNameSubmit(); }}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500"
                  autoFocus
                />
                {nameError && (
                  <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-red-400 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> {nameError}
                  </motion.p>
                )}
              </div>
              <Button onClick={handleNameSubmit} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2" size="lg">
                <ArrowRight className="w-4 h-4" /> Enter Arena
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ─── RENDER: Dashboard ─────────────────────────────────────────────────────

  const renderDashboard = () => (
    <div className="space-y-6 md:space-y-8">
      {/* Pending score recovery banner */}
      {pendingScoreRecovery && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-amber-800 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
            <span>
              Unsaved score from your last session with <strong>{pendingScoreRecovery.personaName}</strong> — save it now?
            </span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto sm:shrink-0">
            <Button size="sm" variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100 h-7 text-xs" onClick={() => {
              setPendingScoreRecovery(null);
              try { localStorage.removeItem(PENDING_SCORE_KEY); } catch { /* ignore */ }
            }}>Dismiss</Button>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 h-7 text-xs gap-1" onClick={() => {
              const ps = pendingScoreRecovery;
              const record: ScoreRecord = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                userName: ps.userName,
                personaId: ps.personaId,
                personaName: ps.personaName,
                date: ps.date,
                duration: ps.duration,
                rapport: ps.score.rapport,
                discovery: ps.score.discovery,
                objectionHandling: ps.score.objectionHandling,
                closing: ps.score.closing,
                overall: ps.score.overall,
                grade: ps.score.grade,
                outcome: ps.score.outcome,
                summary: ps.score.summary,
              };
              setSavedScores(prev => {
                const updated = [record, ...prev].slice(0, 200);
                try {
                  localStorage.setItem(SCORES_STORAGE_KEY, JSON.stringify(updated));
                  localStorage.removeItem(PENDING_SCORE_KEY);
                } catch { /* storage full */ }
                return updated;
              });
              fetch("/api/scores", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userName: ps.userName,
                  personaId: ps.personaId,
                  personaName: ps.personaName,
                  rapport: ps.score.rapport,
                  discovery: ps.score.discovery,
                  objectionHandling: ps.score.objectionHandling,
                  closing: ps.score.closing,
                  overall: ps.score.overall,
                  grade: ps.score.grade,
                  outcome: ps.score.outcome,
                  summary: ps.score.summary,
                  strengths: ps.score.strengths,
                  improvements: ps.score.improvements,
                  duration: ps.duration,
                }),
              }).catch(() => {});
              setPendingScoreRecovery(null);
            }}>
              <CheckCircle2 className="w-3 h-3" /> Save Score
            </Button>
          </div>
        </div>
      )}
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

      {/* Leaderboard Preview */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.4 }}>
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <CardTitle className="text-lg">Leaderboard</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setView("leaderboard"); fetchLeaderboard(); }} className="gap-1 text-xs">
              View Full <ChevronRight className="w-3 h-3" />
            </Button>
          </CardHeader>
          <CardContent className="pb-4">
            {leaderboardScores.length > 0 ? (
              <div className="space-y-1.5">
                {leaderboardScores.slice(0, 5).map((entry, i) => (
                  <div key={entry.id} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                    i === 0 ? "bg-yellow-50 border border-yellow-200" :
                    i === 1 ? "bg-slate-50 border border-slate-200" :
                    i === 2 ? "bg-amber-50 border border-amber-200" :
                    "hover:bg-slate-50"
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-center font-bold text-xs">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                      </span>
                      <div>
                        <span className="font-medium text-sm">{entry.userName}</span>
                        <span className="text-xs text-muted-foreground ml-1.5">vs {entry.personaName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs px-1.5 py-0 ${getGradeColor(entry.grade)}`}>{entry.grade}</Badge>
                      <span className="font-bold text-sm w-8 text-right">{entry.overall}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : leaderboardLoading ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
              </div>
            ) : (
              <div className="text-center py-4">
                <Medal className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No scores yet — complete a session to rank!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

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
                <span className="text-xs font-medium text-slate-600">Tap mic to start, tap again to stop and transcribe</span>
              </>
            )}
          </div>
        )}

        {/* Meeting Booked Banner */}
        {sessionBooked && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-300 mb-2 shrink-0"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-emerald-800">Meeting Booked!</div>
                <div className="text-xs text-emerald-700">{selectedPersona?.name} agreed to a meeting. Great close!</div>
              </div>
            </div>
            <Button size="sm" variant="outline" className="border-emerald-400 text-emerald-700 hover:bg-emerald-100 shrink-0 text-xs"
              onClick={handleEndSession}>
              End Session
            </Button>
          </motion.div>
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
            disabled={!isRecording && (isAudioPlaying || playingMessageIdx !== null || isChatLoading)}
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
                {isRecording ? `Recording · ${recordingDuration}s` : voiceStatus || (isAudioPlaying ? "Listening..." : "Tap mic to start, tap again to stop and transcribe")}
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

        {voiceStatus && !isRecording && (
          <div className="mt-2 text-xs text-amber-600 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{voiceStatus}</span>
          </div>
        )}
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
              if (!confirm("End the current session?")) return;
              handleEndSession();
              return;
            }
            setView("dashboard");
            setRoleplayStatus("idle");
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
              closing: { label: "Closing", color: "bg-violet-50 text-violet-600 border-violet-200", icon: Sparkles },
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
    const tooShort = messageCount < 4 && !autoScore && !isScoring;

    return (
      <Dialog open={showEndDialog} onOpenChange={(open) => { if (!open && isScoring) return; setShowEndDialog(open); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Session Complete
            </DialogTitle>
            <DialogDescription>
              {isScoring ? "Analyzing your performance..." : autoScore ? "AI-scored performance breakdown" : tooShort ? "Session ended too early to score" : "AI scoring in progress"}
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

            {/* Too short — no scoring possible */}
            {tooShort && (
              <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-700">Not enough conversation to score</p>
                  <p className="text-xs text-muted-foreground">At least 4 messages are needed for AI scoring. This session will not be saved to history.</p>
                </div>
              </div>
            )}

            {/* Scoring in progress */}
            {isScoring && !autoScore && (
              <div className="flex items-center justify-center gap-2 py-4 rounded-lg bg-slate-50 border border-dashed">
                <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
                <span className="text-sm text-muted-foreground">Scoring your performance...</span>
              </div>
            )}

            {/* Score results */}
            {autoScore && (
              <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">AI Performance Score</span>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-bold ${
                    autoScore.grade === "A" ? "bg-emerald-100 text-emerald-700" :
                    autoScore.grade === "B" ? "bg-sky-100 text-sky-700" :
                    autoScore.grade === "C" ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-700"
                  }`}>
                    <span className="text-base">{autoScore.grade}</span>
                    <span className="text-xs font-normal">({autoScore.overall}/100)</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { label: "Rapport", value: autoScore.rapport },
                    { label: "Discovery", value: autoScore.discovery },
                    { label: "Objections", value: autoScore.objectionHandling },
                    { label: "Closing", value: autoScore.closing },
                  ]).map(({ label, value }) => (
                    <div key={label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${
                          value >= 75 ? "bg-emerald-500" : value >= 55 ? "bg-amber-500" : "bg-red-400"
                        }`} style={{ width: `${value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground italic">{autoScore.summary}</p>
                {autoScore.strengths.length > 0 && (
                  <div className="space-y-1">
                    {autoScore.strengths.map((s, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-emerald-800">{s}</span>
                      </div>
                    ))}
                  </div>
                )}
                {autoScore.improvements.length > 0 && (
                  <div className="space-y-1">
                    {autoScore.improvements.map((imp, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs">
                        <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                        <span className="text-amber-800">{imp}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Outcome + notes — only shown when there's enough to evaluate */}
            {!tooShort && (
              <>
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Outcome{autoScore && <span className="text-xs text-muted-foreground font-normal ml-1">(auto-detected — override if needed)</span>}
                  </label>
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
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {scoreFailed && !autoScore && !isScoring && !tooShort && (
              <Button variant="outline" onClick={triggerAutoScore} className="w-full gap-1 text-amber-700 border-amber-300 hover:bg-amber-50 sm:w-auto">
                <RefreshCw className="w-4 h-4" /> Retry Score
              </Button>
            )}
            {tooShort ? (
              <Button onClick={() => { setShowEndDialog(false); setView("dashboard"); setRoleplayStatus("idle"); }} className="w-full sm:w-auto">
                Close
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowEndDialog(false)} disabled={isScoring} className="w-full sm:w-auto">Cancel</Button>
                <Button onClick={handleSaveEndSession} className="w-full gap-1 sm:w-auto" disabled={isScoring}>
                  <CheckCircle2 className="w-4 h-4" /> Save & Close
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // ─── RENDER: History ────────────────────────────────────────────────────────

  const outcomeIcon = (outcome: string) => {
    if (outcome === "booked" || outcome === "won") return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    if (outcome === "lost") return <XCircle className="w-4 h-4 text-red-600" />;
    return <Pause className="w-4 h-4 text-amber-600" />;
  };

  const renderHistory = () => (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold">Score History</h2>
          <p className="text-xs md:text-sm text-muted-foreground">Performance records for all reps</p>
        </div>
        <Button variant="ghost" onClick={() => setView("dashboard")}>Back</Button>
      </div>

      {savedScores.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Award className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-1">No scores recorded yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Complete a roleplay session to see your score here.</p>
            <Button onClick={() => setView("select")} className="gap-2"><Play className="w-4 h-4" /> Start Roleplay</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {savedScores.map((record, i) => (
            <motion.div key={record.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Badge className={`text-lg font-bold px-3 py-1 border shrink-0 ${getGradeColor(record.grade)}`}>{record.grade}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <span className="font-semibold text-sm">{record.userName}</span>
                          <span className="text-muted-foreground text-xs mx-1">vs</span>
                          <span className="text-sm">{record.personaName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {outcomeIcon(record.outcome)}
                          <span className="capitalize">{record.outcome}</span>
                          <span>·</span>
                          <span>{new Date(record.date).toLocaleDateString()}</span>
                          {record.duration > 0 && <><span>·</span><span>{formatTime(record.duration)}</span></>}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {[
                          { label: "Rapport", val: record.rapport },
                          { label: "Discovery", val: record.discovery },
                          { label: "Objections", val: record.objectionHandling },
                          { label: "Closing", val: record.closing },
                        ].map(({ label, val }) => (
                          <div key={label} className="text-center">
                            <div className="text-xs text-muted-foreground">{label}</div>
                            <div className={`text-sm font-bold ${val >= 70 ? "text-emerald-600" : val >= 50 ? "text-amber-600" : "text-red-600"}`}>{val}</div>
                          </div>
                        ))}
                      </div>
                      {record.summary && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{record.summary}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  // Fetch leaderboard data when view changes to "leaderboard" or filters change
  useEffect(() => {
    if (view === "leaderboard") {
      fetchLeaderboard(lbTimeframe, lbPersonaFilter);
    }
  }, [view, fetchLeaderboard, lbTimeframe, lbPersonaFilter]);

  // ─── RENDER: Leaderboard ─────────────────────────────────────────────────────

  const renderLeaderboard = () => {
    const uniquePersonas = [...new Set(leaderboardScores.map(s => s.personaName))];

    const getOutcomeIcon = (outcome: string) => {
      if (outcome === "booked" || outcome === "won") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
      if (outcome === "lost") return <XCircle className="w-3.5 h-3.5 text-red-600" />;
      return <Pause className="w-3.5 h-3.5 text-amber-600" />;
    };

    const getRankDisplay = (rank: number) => {
      if (rank === 1) return <Trophy className="w-4 h-4 text-yellow-500" />;
      if (rank === 2) return <Medal className="w-4 h-4 text-slate-400" />;
      if (rank === 3) return <Medal className="w-4 h-4 text-amber-600" />;
      return <span className="text-xs font-mono text-muted-foreground w-4 text-center">{rank}</span>;
    };

    return (
      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Leaderboard
            </h2>
            <p className="text-xs md:text-sm text-muted-foreground">
              Top performers ranked by overall score
            </p>
          </div>
          <Button variant="ghost" onClick={() => setView("dashboard")}>Back</Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
            <Filter className="w-3 h-3" /> Period:
          </div>
          {(["all", "month", "week", "today"] as const).map(tf => (
            <Button
              key={tf}
              size="sm"
              variant={lbTimeframe === tf ? "default" : "outline"}
              className="text-xs"
              onClick={() => setLbTimeframe(tf)}
            >
              {tf === "all" ? "All Time" : tf === "month" ? "30 Days" : tf === "week" ? "7 Days" : "Today"}
            </Button>
          ))}
          {uniquePersonas.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground mx-1">|</span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
                <Search className="w-3 h-3" /> Persona:
              </div>
              <select
                value={lbPersonaFilter}
                onChange={e => setLbPersonaFilter(e.target.value)}
                className="text-xs border rounded-md px-2 py-1 bg-background"
              >
                <option value="all">All Personas</option>
                {uniquePersonas.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </>
          )}
        </div>

        {/* Loading state */}
        {leaderboardLoading && (
          <Card>
            <CardContent className="py-12 text-center">
              <RefreshCw className="w-8 h-8 text-muted-foreground mx-auto mb-3 animate-spin" />
              <p className="text-sm text-muted-foreground">Loading leaderboard...</p>
            </CardContent>
          </Card>
        )}

        {/* Error state */}
        {leaderboardError && !leaderboardLoading && (
          <Card>
            <CardContent className="py-8 text-center">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
              <p className="text-sm text-red-600 mb-2">{leaderboardError}</p>
              <Button size="sm" variant="outline" onClick={() => fetchLeaderboard()}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!leaderboardLoading && !leaderboardError && leaderboardScores.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Medal className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-1">No scores yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Complete a roleplay session to appear on the leaderboard.
              </p>
              <Button onClick={() => setView("select")} className="gap-2">
                <Play className="w-4 h-4" /> Start Roleplay
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Leaderboard Table */}
        {!leaderboardLoading && !leaderboardError && leaderboardScores.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            {/* Table header (desktop) */}
            <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-50 border-b text-xs font-medium text-muted-foreground">
              <div className="col-span-1">Rank</div>
              <div className="col-span-3">Name</div>
              <div className="col-span-2">Persona</div>
              <div className="col-span-1 text-center">Score</div>
              <div className="col-span-1 text-center">Grade</div>
              <div className="col-span-1 text-center">Outcome</div>
              <div className="col-span-1 text-center hidden lg:block">Difficulty</div>
              <div className="col-span-2 text-right">Date</div>
            </div>

            {/* Table rows */}
            <div className="divide-y">
              {leaderboardScores.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`grid grid-cols-1 md:grid-cols-12 gap-1 md:gap-2 px-4 py-3 items-center hover:bg-slate-50 transition-colors ${
                    entry.rank <= 3 ? "bg-amber-50/40" : ""
                  }`}
                >
                  {/* Mobile layout */}
                  <div className="md:hidden flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {getRankDisplay(entry.rank)}
                      <span className="font-semibold text-sm">{entry.userName}</span>
                      <Badge className={`text-xs px-1.5 py-0 ${getGradeColor(entry.grade)}`}>
                        {entry.grade}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      {getOutcomeIcon(entry.outcome)}
                      <span className="capitalize text-muted-foreground">{entry.outcome}</span>
                    </div>
                  </div>
                  <div className="md:hidden flex items-center justify-between text-xs text-muted-foreground">
                    <span>vs {entry.personaName} · Score: <strong>{entry.overall}</strong></span>
                    <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden md:flex items-center gap-2 col-span-1">
                    {getRankDisplay(entry.rank)}
                  </div>
                  <div className="hidden md:block col-span-3">
                    <span className="font-medium text-sm">{entry.userName}</span>
                  </div>
                  <div className="hidden md:block col-span-2 text-sm text-muted-foreground truncate" title={entry.personaName}>
                    {entry.personaName}
                  </div>
                  <div className="hidden md:block col-span-1 text-center">
                    <span className="font-bold text-sm">{entry.overall}</span>
                  </div>
                  <div className="hidden md:block col-span-1 text-center">
                    <Badge className={`text-xs px-1.5 py-0 ${getGradeColor(entry.grade)}`}>
                      {entry.grade}
                    </Badge>
                  </div>
                  <div className="hidden md:flex col-span-1 justify-center">
                    {getOutcomeIcon(entry.outcome)}
                  </div>
                  <div className="hidden lg:block col-span-1 text-center">
                    <Badge variant="outline" className="text-[10px] px-1.5 capitalize text-muted-foreground">
                      {entry.difficulty}
                    </Badge>
                  </div>
                  <div className="hidden md:block col-span-2 text-right text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric', year: 'numeric'
                    })}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Summary row */}
            <div className="px-4 py-2.5 bg-slate-50 border-t text-xs text-muted-foreground">
              Showing {leaderboardScores.length} score{leaderboardScores.length !== 1 ? "s" : ""}
              {lbTimeframe !== "all" ? ` (${lbTimeframe})` : ""}
            </div>
          </div>
        )}
      </div>
    );
  };

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
                <Button variant="ghost" size="sm" onClick={() => { setView("leaderboard"); fetchLeaderboard(); }} className="gap-1 text-xs">
                  <Trophy className="w-3.5 h-3.5" /> Leaderboard
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setView("history")} className="gap-1 text-xs">
                  <BarChart3 className="w-3.5 h-3.5" /> History
                </Button>
              </>
            )}
            {userName && (
              <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
                {userName}
              </span>
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
        {view === "leaderboard" && renderLeaderboard()}
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

      {/* Booking Lead Capture Form */}
      <Dialog
        open={showLeadForm}
        onOpenChange={(open) => {
          if (!open) {
            setShowLeadForm(false);
            setLeadFormSubmitted(true);
            setSessionBooked(true);
            setEndOutcome("won");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">🎉 Congratulations! Meeting Booked</DialogTitle>
            <DialogDescription>
              You&apos;ve successfully booked a meeting with{" "}
              <strong>{selectedPersona?.name}</strong>. Fill in your details to
              receive your SGC Tech account credentials.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Full Name</label>
              <Input
                placeholder="e.g. Renbran Madelo"
                value={leadFormData.fullName}
                onChange={(e) =>
                  setLeadFormData((prev) => ({ ...prev, fullName: e.target.value }))
                }
                disabled={leadFormLoading}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email Address</label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={leadFormData.email}
                onChange={(e) =>
                  setLeadFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                disabled={leadFormLoading}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mobile Number</label>
              <Input
                type="tel"
                placeholder="+971 50 123 4567"
                value={leadFormData.mobile}
                onChange={(e) =>
                  setLeadFormData((prev) => ({ ...prev, mobile: e.target.value }))
                }
                disabled={leadFormLoading}
              />
            </div>
            {leadFormError && (
              <p className="text-sm text-red-600">{leadFormError}</p>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground text-xs"
              onClick={() => {
                setShowLeadForm(false);
                setLeadFormSubmitted(true);
                setSessionBooked(true);
                setEndOutcome("won");
              }}
              disabled={leadFormLoading}
            >
              Skip for now
            </Button>
            <Button
              onClick={submitLeadForm}
              disabled={
                leadFormLoading ||
                !leadFormData.fullName ||
                !leadFormData.email ||
                !leadFormData.mobile
              }
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {leadFormLoading ? "Submitting..." : "Get My Credentials"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Session Dialog */}
      {renderEndDialog()}
    </div>
  );
}
