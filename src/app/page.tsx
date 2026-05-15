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
  MessageCircle, Bot, CornerDownLeft
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
import { PERSONAS, DIFFICULTY_CONFIG, type Persona } from "@/lib/personas";

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

// ─── TTS Voice Mapping ───────────────────────────────────────────────────────

const TTS_VOICE_MAP: Record<string, string> = {
  "aura-2-cora-en": "kazi",
  "aura-2-amalthea-en": "kazi",
  "aura-2-orion-en": "jam",
  "aura-2-apollo-en": "jam",
  "aura-2-arcas-en": "kazi",
  "aura-2-luna-en": "tongtong",
  "aura-2-helios-en": "jam",
  "aura-2-atlas-en": "jam",
};

function getTTSVoice(persona: Persona): string {
  return TTS_VOICE_MAP[persona.voiceId] || "kazi";
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
type RoleplayStatus = "idle" | "connecting" | "connected" | "active" | "ended" | "error";

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
  const [view, setView] = useState<AppView>("dashboard");
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [mode, setMode] = useState<RoleplayMode>("text");
  const [roleplayStatus, setRoleplayStatus] = useState<RoleplayStatus>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [identity, setId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showTips, setShowTips] = useState(true);
  const [sessionNotes, setSessionNotes] = useState("");
  const [callTimer, setCallTimer] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [connectionStep, setConnectionStep] = useState(0);

  // Text chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string>("");

  // TTS state
  const [playingMessageIdx, setPlayingMessageIdx] = useState<number | null>(null);
  const [ttsLoading, setTtsLoading] = useState<number | null>(null);
  const [autoVoice, setAutoVoice] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Microphone recording state
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Session end state
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [endOutcome, setEndOutcome] = useState<"won" | "partial" | "lost">("partial");
  const [endNotes, setEndNotes] = useState("");
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const roomRef = useRef<unknown>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

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
      const voice = selectedPersona ? getTTSVoice(selectedPersona) : "kazi";
      const res = await fetch("/api/roleplay/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 1024), voice }),
      });

      if (!res.ok) throw new Error("TTS failed");

      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setPlayingMessageIdx(null);
        URL.revokeObjectURL(audioUrl);
      };

      setPlayingMessageIdx(messageIdx);
      setTtsLoading(null);
      await audio.play();
    } catch (err) {
      console.error("TTS playback error:", err);
      setTtsLoading(null);
    }
  }, [playingMessageIdx, selectedPersona]);

  // ─── Microphone Recording ───────────────────────────────────────────────────

  const sendChatMessageWithText = useCallback(async (text: string) => {
    if (!text.trim() || !selectedPersona || isChatLoading) return;
    const userMsg = text.trim();
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
  }, [selectedPersona, isChatLoading, chatSessionId, autoVoice, playTTS]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach(t => t.stop());

        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(",")[1];
          if (!base64Audio) return;

          try {
            const res = await fetch("/api/roleplay/asr", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audio: base64Audio }),
            });
            const data = await res.json();
            if (data.success && data.text) {
              setChatInput(data.text);
              setTimeout(() => {
                if (data.text.trim()) {
                  sendChatMessageWithText(data.text.trim());
                }
              }, 300);
            }
          } catch (err) {
            console.error("ASR error:", err);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);

      setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          stopRecording();
        }
      }, 30000);
    } catch (err) {
      console.error("Microphone access error:", err);
    }
  }, [sendChatMessageWithText, stopRecording]);

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      if (data.sessions) setSessions(data.sessions);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

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
    setView("roleplay");
    setRoleplayStatus("active");
    setCallTimer(0);
    setError(null);
    setSessionNotes("");
    setSessionStartTime(Date.now());
    setShowEndDialog(false);
    const sid = `chat-${persona.id}-${Date.now()}`;
    setChatSessionId(sid);
    const openingMsg = { role: "assistant" as const, content: persona.openingLine, timestamp: Date.now() };
    setChatMessages([
      { role: "system", content: `You are now in a sales roleplay with ${persona.name}.`, timestamp: Date.now() },
      openingMsg,
    ]);
    // Auto-play TTS for opening line if enabled
    if (autoVoice) {
      setTimeout(() => playTTS(persona.openingLine, 1), 300);
    }
    setTimeout(() => chatInputRef.current?.focus(), 300);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !selectedPersona || isChatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    await sendChatMessageWithText(userMsg);
    chatInputRef.current?.focus();
  };

  const startVoiceRoleplay = async (persona: Persona) => {
    setSelectedPersona(persona);
    setMode("voice");
    setView("roleplay");
    setRoleplayStatus("connecting");
    setError(null);
    setDispatchError(null);
    setCallTimer(0);
    setConnectionStep(0);
    setSessionNotes("");
    setSessionStartTime(Date.now());
    setShowEndDialog(false);

    try {
      setConnectionStep(1);
      const res = await fetch(`/api/roleplay/token?persona=${persona.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate session token");

      setToken(data.token);
      setRoomName(data.room);
      setWsUrl(data.wsUrl);
      setId(data.identity);
      setSessionId(data.sessionId);
      if (data.dispatch?.dispatchError) setDispatchError(data.dispatch.dispatchError);
      setConnectionStep(2);

      const { Room, RoomEvent } = await import("livekit-client");
      const room = new Room({ adaptiveStream: true, dynacast: true, audioCaptureDefaults: { noiseSuppression: true, echoCancellation: true } });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track: unknown) => {
        const t = track as { kind: string; attach?: () => HTMLMediaElement };
        if (t.kind === "audio" && t.attach) {
          const audioEl = t.attach();
          audioEl.id = "persona-audio";
          document.body.appendChild(audioEl);
          setIsAudioPlaying(true);
          setRoleplayStatus("active");
          setConnectionStep(4);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, () => setIsAudioPlaying(false));
      room.on(RoomEvent.ParticipantConnected, () => setConnectionStep(3));
      room.on(RoomEvent.Disconnected, () => { setRoleplayStatus("ended"); setIsAudioPlaying(false); });

      await room.connect(data.wsUrl, data.token);
      setConnectionStep(3);
      setRoleplayStatus("connected");
      await room.localParticipant.enableAudio();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start voice session");
      setRoleplayStatus("error");
    }
  };

  const endRoleplay = async (outcome?: string) => {
    // Stop any TTS playback
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingMessageIdx(null);
    setTtsLoading(null);

    try {
      if (roomRef.current) {
        const room = roomRef.current as { disconnect?: () => void };
        room.disconnect?.();
      }
    } catch { /* ignore */ }

    const audioEl = document.getElementById("persona-audio");
    if (audioEl) audioEl.remove();

    if (sessionId && mode === "voice") {
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

  const toggleMute = async () => {
    if (!roomRef.current) return;
    const room = roomRef.current as { localParticipant?: { setMicrophoneEnabled?: (enabled: boolean) => Promise<void> } };
    if (room.localParticipant?.setMicrophoneEnabled) {
      await room.localParticipant.setMicrophoneEnabled(isMuted);
      setIsMuted(!isMuted);
    }
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
            Practice your sales pitch against AI-powered buyer personas. Choose text chat with voice playback or live voice calls for immersive conversations.
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
            { step: "2", title: "Start Session", desc: "Text chat with voice playback or live voice call", icon: MessageCircle },
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
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> Use Auto-Voice to hear how the persona sounds — great for practicing tone</li>
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
          {/* Difficulty Filter */}
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground self-center mr-1">Difficulty:</span>
            {["all", "easy", "medium", "hard"].map(diff => (
              <Button key={diff} variant={difficultyFilter === diff ? "default" : "outline"} size="sm" onClick={() => setDifficultyFilter(diff)} className="gap-1">
                {diff === "all" ? "All" : DIFFICULTY_CONFIG[diff as "easy" | "medium" | "hard"].label}
                {diff !== "all" && <span className="ml-1 text-xs opacity-70">({PERSONAS.filter(p => p.difficulty === diff).length})</span>}
              </Button>
            ))}
          </div>
          {/* Type Filter */}
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

  // ─── RENDER: Text Chat Roleplay ─────────────────────────────────────────────

  const renderTextChat = () => (
    <div className="space-y-4 h-full flex flex-col">
      {/* Chat Messages */}
      <ScrollArea className="flex-1 rounded-lg border bg-white p-4 min-h-[400px] max-h-[calc(100vh-320px)]">
        <div className="space-y-4">
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
                <div className={`max-w-[80%] ${msg.role === "user" ? "order-1" : ""}`}>
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
                    <div className="rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap bg-slate-100 text-slate-900 rounded-bl-md relative group">
                      {msg.content}
                      <button
                        onClick={() => playTTS(msg.content, i)}
                        className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-50"
                        title={playingMessageIdx === i ? "Stop voice" : "Play voice"}
                      >
                        {ttsLoading === i ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : playingMessageIdx === i ? (
                          <Volume2 className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Volume2 className="w-3 h-3 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap bg-primary text-primary-foreground rounded-br-md">
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

      {/* Chat Input */}
      <div className="flex gap-2 items-end">
        {/* Microphone button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isRecording ? "destructive" : "outline"}
                size="icon"
                onClick={isRecording ? stopRecording : startRecording}
                className="shrink-0"
              >
                {isRecording ? (
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                    <MicOff className="w-4 h-4" />
                  </motion.div>
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isRecording ? "Stop recording" : "Voice input"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex-1 relative">
          <Input
            ref={chatInputRef}
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
            placeholder={isRecording ? "Listening..." : "Type your sales pitch..."}
            disabled={isChatLoading || isRecording}
            className="pr-10"
          />
          <Button
            size="sm"
            onClick={sendChatMessage}
            disabled={!chatInput.trim() || isChatLoading}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>

        <Button variant="destructive" size="icon" onClick={handleEndSession} title="End session">
          <PhoneOff className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  // ─── RENDER: Voice Roleplay ─────────────────────────────────────────────────

  const renderVoiceCall = () => {
    const connectionSteps = [
      { label: "Generating secure session...", icon: RefreshCw },
      { label: "Requesting access token...", icon: Zap },
      { label: "Connecting to voice room...", icon: Phone },
      { label: "Persona participant joined", icon: Users },
      { label: "Persona audio attached — speak now!", icon: Volume2 },
    ];

    return (
      <div className="space-y-6">
        {(roleplayStatus === "connecting" || roleplayStatus === "connected") && (
          <div className="space-y-4 py-8">
            <div className="flex justify-center">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                <RefreshCw className="w-12 h-12 text-muted-foreground" />
              </motion.div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-semibold text-lg">Connecting to {selectedPersona?.name}...</h3>
              <p className="text-sm text-muted-foreground">Setting up voice channel</p>
            </div>
            <div className="max-w-sm mx-auto space-y-2">
              {connectionSteps.map((step, i) => (
                <div key={i} className={`flex items-center gap-2 text-sm transition-all duration-300 ${
                  i < connectionStep ? "text-emerald-600" : i === connectionStep ? "text-foreground font-medium" : "text-muted-foreground"
                }`}>
                  {i < connectionStep ? <CheckCircle2 className="w-4 h-4" /> : i === connectionStep ? (
                    <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }}><step.icon className="w-4 h-4" /></motion.div>
                  ) : <div className="w-4 h-4 rounded-full border-2 border-muted" />}
                  {step.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {roleplayStatus === "active" && (
          <div className="space-y-6 py-8">
            <div className="flex justify-center">
              <motion.div animate={{ scale: isAudioPlaying ? [1, 1.05, 1] : 1 }} transition={{ duration: 0.5, repeat: isAudioPlaying ? Infinity : 0 }} className="relative">
                <PersonaAvatar src={selectedPersona?.avatar || "/avatars/p1_faisal.png"} alt={selectedPersona?.name || "Persona"} size="xl" />
                {isAudioPlaying && (
                  <>
                    <motion.div animate={{ scale: [1, 1.5], opacity: [0.3, 0] }} transition={{ duration: 1.5, repeat: Infinity }} className="absolute inset-0 rounded-full border-2 border-emerald-400" />
                    <motion.div animate={{ scale: [1, 1.8], opacity: [0.2, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }} className="absolute inset-0 rounded-full border-2 border-emerald-300" />
                  </>
                )}
              </motion.div>
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-lg">{selectedPersona?.name}</h3>
              <p className="text-sm text-muted-foreground">{selectedPersona?.title}</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                {isAudioPlaying ? (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><Volume2 className="w-3 h-3 mr-1" /> Speaking</Badge>
                ) : (
                  <Badge variant="secondary"><Mic className="w-3 h-3 mr-1" /> Listening</Badge>
                )}
              </div>
            </div>
            <div className="flex justify-center gap-4">
              <TooltipProvider><Tooltip><TooltipTrigger asChild>
                <Button variant="outline" size="lg" className={`w-14 h-14 rounded-full ${isMuted ? "bg-red-50 border-red-200" : ""}`} onClick={toggleMute}>
                  {isMuted ? <MicOff className="w-6 h-6 text-red-500" /> : <Mic className="w-6 h-6" />}
                </Button>
              </TooltipTrigger><TooltipContent>{isMuted ? "Unmute" : "Mute"}</TooltipContent></Tooltip></TooltipProvider>
              <Button variant="destructive" size="lg" className="w-14 h-14 rounded-full" onClick={handleEndSession}><PhoneOff className="w-6 h-6" /></Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">{isMuted ? "Microphone muted" : "Speak naturally"}</p>
          </div>
        )}

        {roleplayStatus === "error" && (
          <div className="py-8 text-center space-y-4">
            <XCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h3 className="font-semibold text-lg">Connection Failed</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">{error}</p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => { setView("dashboard"); setRoleplayStatus("idle"); }}>Back to Dashboard</Button>
              <Button onClick={() => selectedPersona && startVoiceRoleplay(selectedPersona)} className="gap-2"><RefreshCw className="w-4 h-4" /> Try Again</Button>
            </div>
          </div>
        )}

        {dispatchError && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800 text-sm">Agent Dispatch Warning</h4>
                <p className="text-xs text-amber-700 mt-1">The voice agent could not be dispatched. Make sure the LiveKit worker is running.</p>
                <p className="text-xs text-amber-600 mt-1 font-mono">Error: {dispatchError}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // ─── RENDER: Roleplay Session ───────────────────────────────────────────────

  const renderRoleplay = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => {
            if (roleplayStatus === "active" || roleplayStatus === "connected") {
              if (confirm("End the current session?")) handleEndSession();
            }
            setView("dashboard"); setRoleplayStatus("idle");
          }}>Back</Button>
          {selectedPersona && (
            <div className="flex items-center gap-2">
              <span className="text-2xl">{selectedPersona.avatar}</span>
              <div>
                <div className="font-semibold">{selectedPersona.name}</div>
                <div className="text-xs text-muted-foreground">{selectedPersona.title} · {selectedPersona.company}</div>
              </div>
            </div>
          )}
          <div className="hidden sm:flex items-center gap-1.5 ml-2 px-2 py-1 rounded-md bg-slate-50 border border-slate-200">
            <Image src="/sgc-tech-logo.png" alt="SGC TECH" width={16} height={16} className="rounded-sm" />
            <span className="text-[10px] font-semibold text-slate-500 tracking-wide">SGC TECH</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
          {/* Auto-Voice Toggle - only show in text chat mode */}
          {mode === "text" && roleplayStatus === "active" && (
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
        </div>
      </div>

      {/* Main Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {mode === "text" ? renderTextChat() : renderVoiceCall()}
        </div>

        {/* Sidebar: Persona Info */}
        <div className="space-y-4">
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
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Shield className="w-4 h-4 text-amber-500" /> Objections</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="max-h-48">
                <ul className="space-y-2">
                  {selectedPersona?.objections.map((obj, i) => (
                    <li key={i} className="text-xs flex items-start gap-2 p-2 rounded bg-amber-50">
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
              <ScrollArea className="max-h-48">
                <ul className="space-y-2">
                  {selectedPersona?.winConditions.map((cond, i) => (
                    <li key={i} className="text-xs flex items-start gap-2 p-2 rounded bg-emerald-50">
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
              <ScrollArea className="max-h-48">
                <ul className="space-y-2">
                  {selectedPersona?.loseConditions.map((cond, i) => (
                    <li key={i} className="text-xs flex items-start gap-2 p-2 rounded bg-red-50">
                      <XCircle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" /><span className="text-red-800">{cond}</span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>
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
            {/* Session Stats */}
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

            {/* Persona Info */}
            {selectedPersona && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                <div className="text-2xl">{selectedPersona.avatar}</div>
                <div>
                  <div className="font-medium text-sm">{selectedPersona.name}</div>
                  <div className="text-xs text-muted-foreground">{selectedPersona.title} · {selectedPersona.company}</div>
                </div>
              </div>
            )}

            {/* Outcome Selector */}
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

            {/* Notes */}
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
                <div className="text-2xl">{persona?.avatar || "👤"}</div>
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
            <nav className="flex items-center gap-1">
              {[
                { key: "dashboard", label: "Dashboard", icon: BarChart3 },
                { key: "select", label: "Personas", icon: Users },
                { key: "history", label: "History", icon: Clock },
              ].map(item => (
                <Button key={item.key} variant={view === item.key ? "secondary" : "ghost"} size="sm" onClick={() => { setView(item.key as AppView); if (item.key !== "roleplay") setRoleplayStatus("idle"); }} className="gap-1.5">
                  <item.icon className="w-4 h-4" /><span className="hidden sm:inline">{item.label}</span>
                </Button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
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
                <span className="text-slate-400">Sales Roleplay Arena — AI + TTS + ASR</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-slate-400">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{PERSONAS.length} Personas</span>
              <span className="flex items-center gap-1"><Volume2 className="w-3 h-3" />Voice Chat</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Session End Dialog */}
      {renderEndDialog()}
    </div>
  );
}
