'use client';

import { useState, useEffect, useCallback } from "react";
import {
  BarChart3, Users, TrendingUp, Award, RefreshCw,
  ChevronDown, ChevronUp, LogOut, Clock, CheckCircle2,
  XCircle, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedScore {
  id: string;
  userName: string;
  personaId: string;
  personaName: string;
  difficulty: string;
  rapport: number;
  discovery: number;
  objectionHandling: number;
  closing: number;
  overall: number;
  grade: string;
  outcome: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  duration: number;
  createdAt: string;
}

interface CandidateSummary {
  userName: string;
  scores: ParsedScore[];
  avgOverall: number;
  bestGrade: string;
  sessionCount: number;
  lastActive: string;
  personasTried: string[];
}

interface AdminStats {
  totalCandidates: number;
  totalSessions: number;
  avgOverall: number;
  topPerformer: string;
}

interface AdminData {
  stats: AdminStats;
  candidates: CandidateSummary[];
}

type SortKey = "avgOverall" | "userName" | "lastActive" | "sessionCount";

const ADMIN_AUTH_KEY = "sgc-admin-auth";
const REFRESH_INTERVAL = 30_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

function scoreColor(val: number): string {
  if (val >= 75) return "text-emerald-600 font-semibold";
  if (val >= 60) return "text-amber-600 font-semibold";
  return "text-red-600 font-semibold";
}

function gradeBadgeClass(grade: string): string {
  switch (grade) {
    case "A": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "B": return "bg-sky-100 text-sky-700 border-sky-200";
    case "C": return "bg-amber-100 text-amber-700 border-amber-200";
    case "D": return "bg-orange-100 text-orange-700 border-orange-200";
    default: return "bg-red-100 text-red-700 border-red-200";
  }
}

function outcomeBadge(outcome: string) {
  if (outcome === "booked") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3" /> Booked
      </span>
    );
  }
  if (outcome === "partial") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
        <AlertTriangle className="w-3 h-3" /> Partial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
      <XCircle className="w-3 h-3" /> Lost
    </span>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center gap-2 text-slate-400">
          {icon}
          <CardTitle className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {label}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className="text-2xl font-bold text-white">{value}</p>
      </CardContent>
    </Card>
  );
}

function SessionRow({ score }: { score: ParsedScore }) {
  return (
    <tr className="border-t border-slate-700 text-xs text-slate-300">
      <td className="py-2 px-3 text-slate-200">{score.personaName}</td>
      <td className="py-2 px-3">{new Date(score.createdAt).toLocaleDateString()}</td>
      <td className="py-2 px-3">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-500" />
          {formatDuration(score.duration)}
        </span>
      </td>
      <td className="py-2 px-3 text-center">{score.rapport}</td>
      <td className="py-2 px-3 text-center">{score.discovery}</td>
      <td className="py-2 px-3 text-center">{score.objectionHandling}</td>
      <td className="py-2 px-3 text-center">{score.closing}</td>
      <td className={`py-2 px-3 text-center ${scoreColor(score.overall)}`}>
        {score.overall}
      </td>
      <td className="py-2 px-3 text-center">
        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold border ${gradeBadgeClass(score.grade)}`}>
          {score.grade}
        </span>
      </td>
      <td className="py-2 px-3">{outcomeBadge(score.outcome)}</td>
    </tr>
  );
}

function CandidateRow({
  candidate,
  expanded,
  onToggle,
}: {
  candidate: CandidateSummary;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-t border-slate-700 hover:bg-slate-750 transition-colors">
        <td className="py-3 px-4 font-medium text-white">{candidate.userName}</td>
        <td className="py-3 px-4 text-slate-300">{candidate.sessionCount}</td>
        <td className={`py-3 px-4 ${scoreColor(candidate.avgOverall)}`}>
          {candidate.avgOverall}
        </td>
        <td className="py-3 px-4">
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${gradeBadgeClass(candidate.bestGrade)}`}>
            {candidate.bestGrade}
          </span>
        </td>
        <td className="py-3 px-4 text-slate-400 text-sm">
          <span title={candidate.personasTried.join(", ")}>
            {candidate.personasTried.length} persona{candidate.personasTried.length !== 1 ? "s" : ""}
          </span>
          {candidate.personasTried.length > 0 && (
            <div className="text-xs text-slate-500 truncate max-w-[160px]">
              {candidate.personasTried.slice(0, 2).join(", ")}
              {candidate.personasTried.length > 2 && ` +${candidate.personasTried.length - 2}`}
            </div>
          )}
        </td>
        <td className="py-3 px-4 text-slate-400 text-sm">
          {candidate.lastActive ? relativeTime(candidate.lastActive) : "-"}
        </td>
        <td className="py-3 px-4">
          <button
            onClick={onToggle}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors text-xs"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {expanded ? "Hide" : "Expand"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-900">
          <td colSpan={7} className="px-4 py-2">
            <div className="rounded-lg border border-slate-700 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-wide bg-slate-800">
                    <th className="text-left py-2 px-3 font-medium">Persona</th>
                    <th className="text-left py-2 px-3 font-medium">Date</th>
                    <th className="text-left py-2 px-3 font-medium">Duration</th>
                    <th className="text-center py-2 px-3 font-medium">Rapport</th>
                    <th className="text-center py-2 px-3 font-medium">Discovery</th>
                    <th className="text-center py-2 px-3 font-medium">Objections</th>
                    <th className="text-center py-2 px-3 font-medium">Closing</th>
                    <th className="text-center py-2 px-3 font-medium">Overall</th>
                    <th className="text-center py-2 px-3 font-medium">Grade</th>
                    <th className="text-left py-2 px-3 font-medium">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {candidate.scores.map((s) => (
                    <SessionRow key={s.id} score={s} />
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-slate-700 rounded ${className ?? ""}`} />
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

// ─── Login Gate ───────────────────────────────────────────────────────────────

function LoginGate({ onAuth }: { onAuth: (pw: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) { setError("Enter the admin password"); return; }
    // Accept the typed password — server will reject if wrong
    try { sessionStorage.setItem(ADMIN_AUTH_KEY, password.trim()); } catch { /* ignore */ }
    onAuth(password.trim());
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-6 h-6 text-slate-300" />
          </div>
          <h1 className="text-2xl font-bold text-white">SGC Admin</h1>
          <p className="text-slate-400 text-sm mt-1">Enter admin password to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Input
              type={show ? "text" : "password"}
              placeholder="Admin password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              className="bg-slate-800 border-slate-700 text-white placeholder-slate-500 pr-10"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              {show ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <Button type="submit" className="w-full bg-white text-slate-900 hover:bg-slate-100 font-medium">
            Access Admin
          </Button>
        </form>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [authToken, setAuthToken] = useState("");
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("avgOverall");
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  // Check session storage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(ADMIN_AUTH_KEY);
      if (saved) {
        setAuthToken(saved);
        setIsAuthed(true);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchData = useCallback(async () => {
    if (!isAuthed || !authToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/scores", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { success: boolean; stats: AdminStats; candidates: CandidateSummary[]; error?: string };
      if (!json.success) throw new Error(json.error ?? "Unknown error");
      setData({ stats: json.stats, candidates: json.candidates });
      setLastRefreshed(Date.now());
      setSecondsAgo(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [isAuthed, authToken]);

  // Initial fetch + polling
  useEffect(() => {
    if (!isAuthed) return;
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [isAuthed, fetchData]);

  // Seconds-ago ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      if (lastRefreshed) {
        setSecondsAgo(Math.floor((Date.now() - lastRefreshed) / 1000));
      }
    }, 1000);
    return () => clearInterval(ticker);
  }, [lastRefreshed]);

  const handleLogout = () => {
    try { sessionStorage.removeItem(ADMIN_AUTH_KEY); } catch { /* ignore */ }
    setIsAuthed(false);
    setAuthToken("");
    setData(null);
  };

  const toggleRow = (userName: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(userName)) next.delete(userName);
      else next.add(userName);
      return next;
    });
  };

  const sortedCandidates = data
    ? [...data.candidates].sort((a, b) => {
        switch (sortKey) {
          case "avgOverall": return b.avgOverall - a.avgOverall;
          case "userName": return a.userName.localeCompare(b.userName);
          case "lastActive":
            return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
          case "sessionCount": return b.sessionCount - a.sessionCount;
        }
      })
    : [];

  if (!isAuthed) {
    return <LoginGate onAuth={(pw) => { setAuthToken(pw); setIsAuthed(true); }} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-slate-400" />
          <h1 className="font-bold text-lg">SGC Admin Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-xs text-slate-500 hidden sm:block">
              Last refreshed: {secondsAgo}s ago
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={fetchData}
            disabled={loading}
            className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 gap-1.5 h-8 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleLogout}
            className="text-slate-400 hover:text-white gap-1.5 h-8 text-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Error state */}
        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950 px-4 py-3 flex items-center justify-between">
            <p className="text-red-300 text-sm">{error}</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={fetchData}
              className="text-red-400 hover:text-red-200 h-7 text-xs"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !data && <LoadingSkeleton />}

        {/* Content */}
        {data && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={<Users className="w-4 h-4" />}
                label="Total Candidates"
                value={data.stats.totalCandidates}
              />
              <StatCard
                icon={<BarChart3 className="w-4 h-4" />}
                label="Total Sessions"
                value={data.stats.totalSessions}
              />
              <StatCard
                icon={<TrendingUp className="w-4 h-4" />}
                label="Avg Score"
                value={data.stats.avgOverall}
              />
              <StatCard
                icon={<Award className="w-4 h-4" />}
                label="Top Performer"
                value={data.stats.topPerformer || "-"}
              />
            </div>

            {/* Sort controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500 uppercase tracking-wide">Sort by:</span>
              {(["avgOverall", "userName", "lastActive", "sessionCount"] as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setSortKey(key)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    sortKey === key
                      ? "bg-white text-slate-900 border-white"
                      : "border-slate-700 text-slate-400 hover:text-white hover:border-slate-500"
                  }`}
                >
                  {key === "avgOverall" ? "Avg Score" : key === "userName" ? "Name" : key === "lastActive" ? "Last Active" : "Sessions"}
                </button>
              ))}
            </div>

            {/* Candidates table */}
            <div className="rounded-lg border border-slate-700 bg-slate-800 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-700">
                    <th className="text-left py-3 px-4 font-medium">Candidate</th>
                    <th className="text-left py-3 px-4 font-medium">Sessions</th>
                    <th className="text-left py-3 px-4 font-medium">Avg Score</th>
                    <th className="text-left py-3 px-4 font-medium">Best Grade</th>
                    <th className="text-left py-3 px-4 font-medium">Personas Tried</th>
                    <th className="text-left py-3 px-4 font-medium">Last Active</th>
                    <th className="text-left py-3 px-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500">
                        No sessions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    sortedCandidates.map((candidate) => (
                      <CandidateRow
                        key={candidate.userName}
                        candidate={candidate}
                        expanded={expandedRows.has(candidate.userName)}
                        onToggle={() => toggleRow(candidate.userName)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Score &ge; 75</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Score &ge; 60</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Score &lt; 60</span>
              <span className="flex items-center gap-1.5">
                {(["A","B","C","D","F"] as const).map(g => (
                  <Badge key={g} variant="outline" className={`text-xs px-1 py-0 ${gradeBadgeClass(g)}`}>{g}</Badge>
                ))}
                Grades
              </span>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
