'use client';

import { useState, useEffect, useRef, useCallback } from "react";
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
import { PERSONAS, DIFFICULTY_CONFIG, type Persona } from "@/lib/personas";

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

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const roomRef = useRef<unknown>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Fetch session history
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

  // Start TEXT roleplay
  const startTextRoleplay = (persona: Persona) => {
    setSelectedPersona(persona);
    setMode("text");
    setView("roleplay");
    setRoleplayStatus("active");
    setCallTimer(0);
    setError(null);
    setSessionNotes("");
    const sid = `chat-${persona.id}-${Date.now()}`;
    setChatSessionId(sid);
    setChatMessages([
      { role: "system", content: `You are now in a sales roleplay with ${persona.name}.`, timestamp: Date.now() },
      { role: "assistant", content: persona.openingLine, timestamp: Date.now() },
    ]);
    setTimeout(() => chatInputRef.current?.focus(), 300);
  };

  // Send chat message
  const sendChatMessage = async () => {
    if (!chatInput.trim() || !selectedPersona || isChatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: userMsg, timestamp: Date.now() }]);
    setIsChatLoading(true);

    try {
      const res = await fetch("/api/roleplay/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: chatSessionId,
          message: userMsg,
          personaId: selectedPersona.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setChatMessages(prev => [...prev, { role: "assistant", content: data.response, timestamp: Date.now() }]);
      } else {
        setChatMessages(prev => [...prev, { role: "system", content: `Error: ${data.error}`, timestamp: Date.now() }]);
      }
    } catch (err: unknown) {
      setChatMessages(prev => [...prev, { role: "system", content: "Connection error. Please try again.", timestamp: Date.now() }]);
    }
    setIsChatLoading(false);
    setCallTimer(prev => prev); // Keep timer running
    chatInputRef.current?.focus();
  };

  // Start VOICE roleplay
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

  // End roleplay
  const endRoleplay = async (outcome?: string) => {
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
    setCallTimer(0);
    fetchSessions();
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

  // ─── RENDER: Dashboard ─────────────────────────────────────────────────────

  const renderDashboard = () => (
    <div className="space-y-8">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 md:p-12">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L2c+PC9zdmc+')] opacity-50" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-white/10"><Headphones className="w-6 h-6 text-white" /></div>
            <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/20 border-white/20">AI-Powered</Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Sales Roleplay Arena</h1>
          <p className="text-slate-300 text-lg max-w-2xl mb-6">
            Practice your sales pitch against AI-powered buyer personas. Choose text chat for instant practice or voice mode for immersive conversations.
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
                      <div className="text-3xl">{persona.avatar}</div>
                      <div>
                        <CardTitle className="text-base group-hover:text-primary transition-colors">{persona.name}</CardTitle>
                        <CardDescription className="text-xs">{persona.title}</CardDescription>
                      </div>
                    </div>
                    {getDiffBadge(persona.difficulty)}
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
                    <span className="text-xs text-muted-foreground italic">&ldquo;{persona.openingLine}&rdquo;</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
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
            { step: "1", title: "Choose Persona", desc: "Pick a buyer persona from the UAE market", icon: Users },
            { step: "2", title: "Start Session", desc: "Text chat instantly or voice call with LiveKit", icon: MessageCircle },
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
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> Match the cultural communication style of each persona</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> Hard personas require patience and evidence-based selling</li>
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );

  // ─── RENDER: Persona Selection ──────────────────────────────────────────────

  const renderPersonaSelection = () => {
    const filtered = difficultyFilter === "all" ? PERSONAS : PERSONAS.filter(p => p.difficulty === difficultyFilter);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Choose Your Persona</h2>
            <p className="text-muted-foreground">Select a buyer persona to practice with</p>
          </div>
          <Button variant="ghost" onClick={() => setView("dashboard")}>Back to Dashboard</Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {["all", "easy", "medium", "hard"].map(diff => (
            <Button key={diff} variant={difficultyFilter === diff ? "default" : "outline"} size="sm" onClick={() => setDifficultyFilter(diff)} className="gap-1">
              {diff === "all" ? "All" : DIFFICULTY_CONFIG[diff as "easy" | "medium" | "hard"].label}
              {diff !== "all" && <span className="ml-1 text-xs opacity-70">({PERSONAS.filter(p => p.difficulty === diff).length})</span>}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((persona, i) => (
              <motion.div key={persona.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: 0.05 * i, duration: 0.3 }}>
                <Card className="h-full hover:shadow-lg transition-all group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-4xl">{persona.avatar}</div>
                        <div>
                          <CardTitle className="text-base group-hover:text-primary transition-colors">{persona.name}</CardTitle>
                          <CardDescription className="text-xs">{persona.title}</CardDescription>
                        </div>
                      </div>
                      {getDiffBadge(persona.difficulty)}
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
                      <Phone className="w-3 h-3" /> Voice
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
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
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-sm">{selectedPersona?.avatar}</div>
                        <span className="text-xs font-medium text-muted-foreground">{selectedPersona?.name}</span>
                      </div>
                    )}
                  </div>
                  <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-slate-100 text-slate-900 rounded-bl-md"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
          {isChatLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-sm">{selectedPersona?.avatar}</div>
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
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Input
            ref={chatInputRef}
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
            placeholder="Type your sales pitch..."
            disabled={isChatLoading}
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
        <Button variant="destructive" size="icon" onClick={() => endRoleplay("partial")} title="End session">
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
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-5xl">{selectedPersona?.avatar}</div>
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
              <Button variant="destructive" size="lg" className="w-14 h-14 rounded-full" onClick={() => endRoleplay("lost")}><PhoneOff className="w-6 h-6" /></Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">{isMuted ? "🔇 Microphone muted" : "🎤 Speak naturally"}</p>
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => {
            if (roleplayStatus === "active" || roleplayStatus === "connected") {
              if (confirm("End the current session?")) endRoleplay("abandoned");
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
        </div>
        <div className="flex items-center gap-2">
          {getDiffBadge(selectedPersona?.difficulty || "medium")}
          <Badge variant={mode === "text" ? "default" : "outline"} className="gap-1">
            {mode === "text" ? <><Type className="w-3 h-3" /> Chat</> : <><Phone className="w-3 h-3" /> Voice</>}
          </Badge>
          {roleplayStatus === "active" && (
            <div className="flex items-center gap-1 text-sm font-mono text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />{formatTime(callTimer)}
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
                <div className="text-3xl mb-1">{selectedPersona?.avatar}</div>
                <div className="font-semibold">{selectedPersona?.name}</div>
                <div className="text-xs text-muted-foreground">{selectedPersona?.nationality} · Age {selectedPersona?.age}</div>
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

          {/* Session End Actions */}
          {roleplayStatus === "ended" && (
            <Card className="border-emerald-200">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Session Complete</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  {["won", "partial", "lost"].map(outcome => (
                    <Button key={outcome} variant="outline" size="sm" onClick={() => endRoleplay(outcome)} className={`flex-1 gap-1 text-xs ${
                      outcome === "won" ? "hover:bg-emerald-50 hover:text-emerald-700" :
                      outcome === "lost" ? "hover:bg-red-50 hover:text-red-700" : ""
                    }`}>
                      {outcome === "won" ? <CheckCircle2 className="w-3 h-3" /> : outcome === "lost" ? <XCircle className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                      {outcome.charAt(0).toUpperCase() + outcome.slice(1)}
                    </Button>
                  ))}
                </div>
                <Textarea placeholder="Session notes..." value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} rows={2} />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setView("dashboard"); setRoleplayStatus("idle"); }} className="flex-1">Dashboard</Button>
                  <Button onClick={() => selectedPersona && (mode === "text" ? startTextRoleplay(selectedPersona) : startVoiceRoleplay(selectedPersona))} className="flex-1 gap-1">
                    <RefreshCw className="w-3 h-3" /> Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );

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
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setView("dashboard"); setRoleplayStatus("idle"); }}>
              <Headphones className="w-5 h-5 text-primary" />
              <span className="font-bold text-lg">RoleplayArena</span>
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

      <footer className="mt-auto border-t bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2"><Headphones className="w-4 h-4" /><span>Sales Roleplay Arena — LiveKit + Deepgram + AI</span></div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{PERSONAS.length} Personas</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
