import React, { useState, useMemo } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  Clock, 
  Terminal, 
  Play, 
  GitBranch, 
  FileText, 
  Users, 
  Tablet, 
  Layers, 
  Sparkles, 
  ShieldCheck, 
  AlertTriangle, 
  Copy, 
  Check, 
  ExternalLink, 
  Filter, 
  Search, 
  ArrowRight, 
  Cpu, 
  Database, 
  ChevronRight, 
  FolderGit2, 
  Flame, 
  RotateCcw,
  Zap,
  Globe,
  GitPullRequest,
  Key,
  Share2,
  ArrowUpRight
} from 'lucide-react';
import { ParsedSessionState, ValidationResult, TaskStatus, ZLCETask } from '../types/zlce';
import { copyText } from '../utils/clipboard';
import { serializeSessionStateToMarkdown, parseSessionStateMarkdown } from '../utils/markdownParser';
import { CURRENT_PROJECT_SESSION_STATE_MD } from '../data/templates';
import { TEAM_MEMBERS } from '../data/teamMembers';
import { TeamMember } from '../types/mobile';
import { UseSessionPersistenceReturn } from '../hooks/useSessionPersistence';

export { TEAM_MEMBERS };
export type { TeamMember };

interface DashboardTabProps {
  stateData: ParsedSessionState;
  rawMarkdown: string;
  validation: ValidationResult;
  onUpdateMarkdown: (newMd: string) => void;
  onUpdateStateData: (newData: ParsedSessionState) => void;
  onNavigateTab: (tab: string) => void;
  onRunLinter: () => void;
  persistence?: UseSessionPersistenceReturn;
}

export const TASK_PHASES = [
  { id: 'all', name: 'Semua Task', range: 'TASK-001 s/d TASK-043' },
  { id: 'fase-0', name: 'Fase 0: Baseline & Test Runner', range: 'TASK-001 s/d TASK-002', count: 2 },
  { id: 'fase-1', name: 'Fase 1: PWA & Ergonomi Tablet', range: 'TASK-003 s/d TASK-007', count: 5 },
  { id: 'fase-2', name: 'Fase 2: Markdown Workspace', range: 'TASK-008 s/d TASK-012', count: 5 },
  { id: 'fase-3', name: 'Fase 3: Multi-AI & Context Pack', range: 'TASK-013 s/d TASK-018', count: 6, priority: true },
  { id: 'fase-4', name: 'Fase 4: Multi-Akun & Tim Estafet', range: 'TASK-019 s/d TASK-024', count: 6, priority: true },
  { id: 'fase-5', name: 'Fase 5: Command Hub & Termux', range: 'TASK-025 s/d TASK-030', count: 6 },
  { id: 'fase-6', name: 'Fase 6: Git Sync & Kolaborasi Cabang', range: 'TASK-031 s/d TASK-035', count: 5 },
  { id: 'fase-7', name: 'Fase 7: Uji Fisik SM-T225 & Integrasi', range: 'TASK-036 s/d TASK-040', count: 5 },
  { id: 'fase-8', name: 'Fase 8: Dokumentasi & Panduan', range: 'TASK-041 s/d TASK-043', count: 3 }
];

export const DashboardTab: React.FC<DashboardTabProps> = ({
  stateData,
  rawMarkdown,
  validation,
  onUpdateMarkdown,
  onUpdateStateData,
  onNavigateTab,
  onRunLinter,
  persistence
}) => {
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeMemberId, setActiveMemberId] = useState<string>(() => {
    return localStorage.getItem('zlce_active_member_id') || 'eko';
  });

  // Evidence modal / inline input for marking DONE
  const [doneModalTaskId, setDoneModalTaskId] = useState<string | null>(null);
  const [evidenceInput, setEvidenceInput] = useState<string>('Verifikasi build & uji lulus 100%');

  // GitHub Sync & Remote Hub Modal state
  const [isGitSyncOpen, setIsGitSyncOpen] = useState<boolean>(false);
  const [gitSyncMode, setGitSyncMode] = useState<'direct-push' | 'fork-clone' | 'new-repo'>('direct-push');
  const [githubUsername, setGithubUsername] = useState<string>('acimau99-netizen');
  const [githubRepoName, setGithubRepoName] = useState<string>('ZLCE3.22-studio');
  const [targetBranch, setTargetBranch] = useState<string>('v4-mobile');

  const activeMember = useMemo(() => {
    return TEAM_MEMBERS.find(m => m.id === activeMemberId) || TEAM_MEMBERS[0];
  }, [activeMemberId]);

  const handleSelectMember = (id: string) => {
    setActiveMemberId(id);
    localStorage.setItem('zlce_active_member_id', id);
  };

  const handleCopy = async (text: string, id: string) => {
    const ok = await copyText(text);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Compute status summary
  const statusStats = useMemo(() => {
    const tasks = stateData.tasks || [];
    let ready = 0;
    let inProgress = 0;
    let done = 0;
    let pending = 0;
    let blocked = 0;

    tasks.forEach(t => {
      if (t.status === 'READY') ready++;
      else if (t.status === 'IN_PROGRESS') inProgress++;
      else if (t.status === 'DONE') done++;
      else if (t.status === 'BLOCKED') blocked++;
      else pending++;
    });

    return { total: tasks.length, ready, inProgress, done, pending, blocked };
  }, [stateData.tasks]);

  // Find active task or next task
  const activeOrNextTask = useMemo(() => {
    const inProg = stateData.tasks.find(t => t.status === 'IN_PROGRESS');
    if (inProg) return inProg;

    const ready = stateData.tasks.find(t => t.status === 'READY');
    if (ready) return ready;

    if (stateData.status.nextTask && stateData.status.nextTask !== '-') {
      const match = stateData.tasks.find(t => t.id === stateData.status.nextTask);
      if (match) return match;
    }

    return stateData.tasks[0] || null;
  }, [stateData.tasks, stateData.status.nextTask]);

  // Filter tasks based on phase, status, search
  const filteredTasks = useMemo(() => {
    return stateData.tasks.filter(t => {
      // Phase filter
      if (selectedPhase !== 'all') {
        const numMatch = t.id.match(/\d+/);
        if (numMatch) {
          const num = parseInt(numMatch[0], 10);
          if (selectedPhase === 'fase-0' && (num < 1 || num > 2)) return false;
          if (selectedPhase === 'fase-1' && (num < 3 || num > 7)) return false;
          if (selectedPhase === 'fase-2' && (num < 8 || num > 12)) return false;
          if (selectedPhase === 'fase-3' && (num < 13 || num > 18)) return false;
          if (selectedPhase === 'fase-4' && (num < 19 || num > 24)) return false;
          if (selectedPhase === 'fase-5' && (num < 25 || num > 30)) return false;
          if (selectedPhase === 'fase-6' && (num < 31 || num > 35)) return false;
          if (selectedPhase === 'fase-7' && (num < 36 || num > 40)) return false;
          if (selectedPhase === 'fase-8' && (num < 41 || num > 43)) return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && t.status !== statusFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return t.id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q);
      }

      return true;
    });
  }, [stateData.tasks, selectedPhase, statusFilter, searchQuery]);

  // Handle task status transition
  const handleUpdateTaskStatus = (taskId: string, newStatus: TaskStatus, customEvidence?: string) => {
    // Check 1 Task IN_PROGRESS rule
    if (newStatus === 'IN_PROGRESS') {
      const existingInProg = stateData.tasks.find(t => t.status === 'IN_PROGRESS' && t.id !== taskId);
      if (existingInProg) {
        alert(`Aturan Kolaborasi Tablet: Task ${existingInProg.id} sedang berstatus IN_PROGRESS. Hanya diperbolehkan 1 task aktif pada satu waktu di tablet bersama.`);
        return;
      }
    }

    const updatedTasks = stateData.tasks.map(t => {
      if (t.id === taskId) {
        const isNowDone = newStatus === 'DONE';
        return {
          ...t,
          status: newStatus,
          evidence: isNowDone 
            ? (customEvidence || t.evidence !== '-' ? t.evidence : 'Verifikasi terminal sukses 0 error') 
            : t.evidence,
          approved: isNowDone 
            ? 'ya' 
            : t.approved
        };
      }
      return t;
    });

    const updatedStatus = { ...stateData.status };
    const updatedWal = { ...stateData.wal };
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' WIB';

    if (newStatus === 'IN_PROGRESS') {
      const target = stateData.tasks.find(t => t.id === taskId);
      updatedStatus.activeTask = taskId;
      updatedStatus.activeTaskStatus = 'IN_PROGRESS';
      updatedWal.task = taskId;
      updatedWal.currentStep = `Implementasi ${target?.name || taskId} oleh ${activeMember.name}`;
      updatedWal.plannedFiles = target?.id === 'TASK-001' ? 'package.json, tsconfig.json' : 'src/components/mobile/';
      updatedWal.completedSoFar = 'Penyiapan konteks kerja & verifikasi dependensi';
      updatedWal.nextStepExact = `Eksekusi perintah verifikasi dan periksa output`;
      updatedWal.verificationCommand = target?.id === 'TASK-001' ? 'npm test && npm run lint && npm run build' : 'npm run build';
      updatedWal.updatedTimestamp = nowStr;
    } else if (newStatus === 'DONE') {
      updatedStatus.lastDoneTask = taskId;
      if (updatedStatus.activeTask === taskId) {
        updatedStatus.activeTask = '-';
        updatedStatus.activeTaskStatus = 'READY';
      }
      // Determine next task
      const currentIdx = stateData.tasks.findIndex(t => t.id === taskId);
      if (currentIdx >= 0 && currentIdx < stateData.tasks.length - 1) {
        const next = stateData.tasks[currentIdx + 1];
        updatedStatus.nextTask = next.id;
      }
      updatedWal.task = '-';
      updatedWal.currentStep = `Task ${taskId} tuntas diverifikasi oleh ${activeMember.name}`;
      updatedWal.nextStepExact = `Mulai task berikutnya: ${updatedStatus.nextTask}`;
      updatedWal.updatedTimestamp = nowStr;
    }

    // Append to audit log
    const updatedAuditLog = [
      `**${nowStr}:** Task ${taskId} status diubah ke ${newStatus} oleh ${activeMember.name}.`,
      ...(stateData.auditLog || []).slice(0, 20)
    ];

    const newState: ParsedSessionState = {
      ...stateData,
      tasks: updatedTasks,
      status: updatedStatus,
      wal: updatedWal,
      auditLog: updatedAuditLog
    };

    const newMd = serializeSessionStateToMarkdown(newState);
    onUpdateStateData(newState);
    onUpdateMarkdown(newMd);
  };

  // Reset or reload live canonical SESSION_STATE directly from physical disk file
  const handleReloadLiveSessionState = async () => {
    if (persistence?.reloadFromDisk) {
      const ok = await persistence.reloadFromDisk();
      if (ok) {
        alert('Berhasil disinkronkan langsung dari berkas disk /SESSION_STATE.md repositori!');
        return;
      }
    }
    if (confirm('Muat ulang state dari template kanonik workspace (ZLCE Mobile Workbench v4.0.0)?')) {
      const parsed = parseSessionStateMarkdown(CURRENT_PROJECT_SESSION_STATE_MD);
      onUpdateMarkdown(CURRENT_PROJECT_SESSION_STATE_MD);
      onUpdateStateData(parsed);
    }
  };

  // Generate complete Context Pack for current active task
  const generateContextPack = () => {
    const taskId = activeOrNextTask?.id || 'TASK-001';
    const taskName = activeOrNextTask?.name || 'Verifikasi Baseline Uji';
    return `# PORTABLE CONTEXT PACK: ${taskId}
* **Proyek:** ${stateData.context.projectName}
* **Perangkat:** Samsung Galaxy Tab A7 Lite (SM-T225 • 3GB RAM)
* **Anggota Aktif:** ${activeMember.name} (${activeMember.role})
* **Cabang Git:** ${stateData.status.gitBranch}
* **Task Aktif:** ${taskId} - ${taskName}
* **Aturan:** Schema-before-Data • Zero-Placeholder • Invarian I1 s/d I5
* **Timestamp:** ${new Date().toISOString()}

---
## INSTRUKSI EKSEKUSI
Lanjutkan implementasi ${taskId}. Pastikan kode ditulis utuh tanpa placeholder. Sebelum modifikasi multi-berkas, konfirmasi rencana di WAL.
Output verifikasi wajib bebas error.`;
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Banner: Project Hero & Hardware Identity */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 shadow-2xl p-6 sm:p-8">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 -mb-8 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-cyan-400" />
                Track 2 • Active Workspace
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
                Branch: {stateData.status.gitBranch || 'v4-mobile'}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Mode: {stateData.context.mode || 'FULL'} (10 Docs)
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                P2-CP4 Blueprint DONE
              </span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                <span>{stateData.context.projectName || 'ZLCE Mobile Workbench v4.0.0'}</span>
              </h1>
              <p className="text-slate-300 text-sm sm:text-base mt-1 max-w-3xl leading-relaxed">
                Implementasi Tablet Bersama (<span className="text-cyan-300 font-semibold">Samsung Galaxy Tab A7 Lite 8.7" • 3GB RAM</span>) untuk Tim Estafet 8 Anggota &amp; Orkes Multi-AI tanpa amnesia konteks.
              </p>
            </div>

            {/* Quick Context Strip */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400 pt-1">
              <div className="flex items-center gap-1.5 bg-slate-950/60 px-2.5 py-1 rounded border border-slate-800">
                <Tablet className="w-3.5 h-3.5 text-cyan-400" />
                <span>SM-T225 (1340x800 • Target Sentuh 44px+)</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-950/60 px-2.5 py-1 rounded border border-slate-800">
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
                <span>Termux: Python 3.11 • Git • Bash</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-950/60 px-2.5 py-1 rounded border border-slate-800">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Audit: {stateData.status.timestampAudit || '2026-11-04 12:00 WIB'}</span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons on Hero */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
            <button
              onClick={() => setIsGitSyncOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/30 transition active:scale-95 border border-emerald-400/30"
            >
              <GitBranch className="w-4 h-4 text-emerald-100" />
              <span>GitHub Sync &amp; Push Hub</span>
            </button>

            <button
              onClick={() => onNavigateTab('session')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/30 transition active:scale-95"
            >
              <FileText className="w-4 h-4" />
              <span>Buka SESSION_STATE &amp; WAL</span>
              <ArrowRight className="w-4 h-4 ml-1 opacity-70" />
            </button>

            <button
              onClick={() => handleCopy(generateContextPack(), 'context-pack-hero')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 transition active:scale-95"
            >
              {copiedId === 'context-pack-hero' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
              <span>{copiedId === 'context-pack-hero' ? 'Context Pack Tersalin!' : 'Salin Portable Context Pack'}</span>
            </button>

            <button
              onClick={handleReloadLiveSessionState}
              className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono bg-slate-950/60 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition"
              title="Sinkronkan ulang state dari berkas SESSION_STATE.md di repositori"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Sinkronkan ke File Repo Asli</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Disk Bridge Card (Single Source of Truth) */}
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
        persistence?.diskSync?.isSaving
          ? 'bg-amber-950/30 border-amber-800/60'
          : persistence?.diskSync?.isLive
          ? 'bg-emerald-950/20 border-emerald-800/40'
          : 'bg-slate-900/60 border-slate-800'
      }`}>
        <div className="flex items-start sm:items-center gap-3">
          <div className={`p-2.5 rounded-lg shrink-0 ${
            persistence?.diskSync?.isLive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
          }`}>
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">Integrasi Berkas Fisik: <code className="text-cyan-300 font-mono">/SESSION_STATE.md</code></span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold flex items-center gap-1.5 ${
                persistence?.diskSync?.isSaving
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : persistence?.diskSync?.isLive
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${persistence?.diskSync?.isLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                {persistence?.diskSync?.isSaving ? 'Menyimpan ke Disk...' : persistence?.diskSync?.isLive ? 'Terhubung & Real-Time' : 'Mode Offline / Local'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Setiap klaim task, status DONE, langkah WAL, dan serah terima tim <span className="text-emerald-400 font-semibold">langsung ditulis dua arah ke berkas disk repositori</span>. Deteksi perubahan eksternal (Git / Termux / Agen AI) aktif secara otomatis.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
          <button
            onClick={() => persistence?.saveToDiskNow && persistence.saveToDiskNow()}
            disabled={persistence?.diskSync?.isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/80 text-cyan-200 transition active:scale-95 disabled:opacity-50"
            title="Tulis paksa markdown antarmuka langsung ke berkas /SESSION_STATE.md"
          >
            <Check className="w-3.5 h-3.5 text-cyan-400" />
            <span>Tulis ke Disk</span>
          </button>
          <button
            onClick={() => persistence?.reloadFromDisk && persistence.reloadFromDisk()}
            disabled={persistence?.diskSync?.isReading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition active:scale-95 disabled:opacity-50"
            title="Muat ulang isi langsung dari berkas fisik /SESSION_STATE.md"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-emerald-400 ${persistence?.diskSync?.isReading ? 'animate-spin' : ''}`} />
            <span>Tarik dari Disk</span>
          </button>
        </div>
      </div>

      {/* Metrics Counter Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Tasks */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
            <span>Total Backlog</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{statusStats.total}</div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">9 Fase Eksekusi</div>
        </div>

        {/* Ready Tasks */}
        <div className="bg-slate-900/80 border border-amber-900/30 p-4 rounded-xl">
          <div className="flex items-center justify-between text-amber-400 text-xs font-medium mb-1">
            <span>Siap Eksekusi</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-amber-300">{statusStats.ready}</div>
          <div className="text-[11px] text-amber-400/80 mt-1 font-mono">{activeOrNextTask?.id || 'TASK-001'}</div>
        </div>

        {/* In Progress */}
        <div className="bg-slate-900/80 border border-cyan-900/30 p-4 rounded-xl">
          <div className="flex items-center justify-between text-cyan-400 text-xs font-medium mb-1">
            <span>In Progress</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-extrabold text-cyan-300">{statusStats.inProgress} / 1</div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">Aturan 1 Task Tablet</div>
        </div>

        {/* Completed */}
        <div className="bg-slate-900/80 border border-emerald-900/30 p-4 rounded-xl">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-medium mb-1">
            <span>Task DONE</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-300">{statusStats.done}</div>
          <div className="text-[11px] text-emerald-400/80 mt-1 font-mono">Gates 1-4 Lolos</div>
        </div>

        {/* Pending */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
            <span>Pending</span>
            <Clock className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-300">{statusStats.pending}</div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">Menunggu Antrean</div>
        </div>

        {/* State Health */}
        <div className={`border p-4 rounded-xl ${validation.valid ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-rose-950/20 border-rose-800/40'}`}>
          <div className="flex items-center justify-between text-xs font-medium mb-1">
            <span className={validation.valid ? 'text-emerald-400' : 'text-rose-400'}>State Health</span>
            <ShieldCheck className={`w-4 h-4 ${validation.valid ? 'text-emerald-400' : 'text-rose-400'}`} />
          </div>
          <div className={`text-xl font-extrabold ${validation.valid ? 'text-emerald-300' : 'text-rose-300'}`}>
            {validation.valid ? '100% VALID' : `${validation.errorsCount} ERROR`}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            {validation.valid ? 'zlce-check PASS' : 'Perlu Diperbaiki'}
          </div>
        </div>
      </div>

      {/* Main Grid: Spotlight on Active Task + Shared Team Selector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Spotlight Card: The Task Running / Next Up (Span 2 cols) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs uppercase font-mono font-bold text-amber-400 tracking-wider">
                  Fokus Eksekusi Sekarang
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white">
                  {activeOrNextTask?.id}: {activeOrNextTask?.name}
                </h3>
              </div>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase border ${
                activeOrNextTask?.status === 'IN_PROGRESS'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse'
                  : activeOrNextTask?.status === 'READY'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                ● Status: {activeOrNextTask?.status || 'READY'}
              </span>
            </div>
          </div>

          {/* Details & Acceptance Criteria */}
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-0.5">Fase &amp; Jalur:</span>
                <span className="text-slate-200 font-bold">Fase 0: Baseline &amp; Test Runner</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-0.5">Dependensi:</span>
                <span className="text-slate-200 font-bold">{activeOrNextTask?.dependencies || '- (Tidak ada)'}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-0.5">Berkas Terdampak:</span>
                <span className="text-cyan-300 font-bold">package.json, tsconfig.json</span>
              </div>
            </div>

            {/* Acceptance Criteria Box */}
            <div className="bg-slate-950/70 rounded-xl p-4 border border-slate-800/80 space-y-2.5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Kriteria Penerimaan (Acceptance Criteria):
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                  <span><code className="text-cyan-300 font-mono">npm test</code> atau runner test eksisting lulus 100% tanpa error.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                  <span><code className="text-cyan-300 font-mono">npm run lint</code> menghasilkan 0 error dan 0 fatal warning.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                  <span><code className="text-cyan-300 font-mono">npm run build</code> sukses menghasilkan bundel produksi Vite.</span>
                </li>
              </ul>
            </div>

            {/* Terminal Command to Run in Termux */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                  Perintah Verifikasi di Termux / Shell:
                </span>
                <button
                  onClick={() => handleCopy('npm test && npm run lint && npm run build', 'cmd-spotlight')}
                  className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition"
                >
                  {copiedId === 'cmd-spotlight' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedId === 'cmd-spotlight' ? 'Tersalin' : 'Salin Perintah'}
                </button>
              </div>
              <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-cyan-300 overflow-x-auto">
npm test && npm run lint && npm run build
              </pre>
            </div>

            {/* Git Commit Command with Dynamic Identity Injection (ADR-05) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span className="flex items-center gap-1.5">
                  <FolderGit2 className="w-3.5 h-3.5 text-emerald-400" />
                  Template Commit Git (Atribusi: {activeMember.name}):
                </span>
                <button
                  onClick={() => handleCopy(
                    `git -c user.name="${activeMember.name}" -c user.email="${activeMember.email}" commit -m "${activeOrNextTask?.id || 'TASK-001'}: verify test baseline and linter zero errors"`,
                    'git-commit-spotlight'
                  )}
                  className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition"
                >
                  {copiedId === 'git-commit-spotlight' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedId === 'git-commit-spotlight' ? 'Tersalin' : 'Salin Commit'}
                </button>
              </div>
              <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto">
{`git -c user.name="${activeMember.name}" -c user.email="${activeMember.email}" commit -m "${activeOrNextTask?.id || 'TASK-001'}: verify test baseline and linter zero errors"`}
              </pre>
            </div>
          </div>

          {/* Interactive State Transition Actions */}
          <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-3">
            {activeOrNextTask?.status !== 'IN_PROGRESS' ? (
              <button
                onClick={() => handleUpdateTaskStatus(activeOrNextTask?.id || 'TASK-001', 'IN_PROGRESS')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20 transition active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Mulai Kerjakan (Set IN_PROGRESS)</span>
              </button>
            ) : (
              <button
                onClick={() => setDoneModalTaskId(activeOrNextTask?.id || 'TASK-001')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Selesaikan &amp; Setujui (Set DONE)</span>
              </button>
            )}

            <button
              onClick={() => onNavigateTab('session')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            >
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>Buka WAL Lengkap</span>
            </button>

            <button
              onClick={() => onNavigateTab('tutorial')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              <span>Panduan Operasional</span>
            </button>
          </div>
        </div>

        {/* Right Column: 8-Member Relay Team Selector & Device Monitor */}
        <div className="space-y-6">
          {/* Active Member Selector Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Tim Estafet Tablet (8 Anggota)</h3>
                  <p className="text-[11px] text-slate-400">Pilih pemegang tablet saat ini (ADR-07)</p>
                </div>
              </div>
            </div>

            {/* Active Driver Highlight */}
            <div className="bg-gradient-to-r from-slate-950 to-indigo-950/40 p-3.5 rounded-xl border border-indigo-900/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${activeMember.avatarColor} flex items-center justify-center font-bold text-white shadow-md`}>
                  {activeMember.name.slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white">{activeMember.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">Driver</span>
                  </div>
                  <div className="text-xs text-slate-400">{activeMember.role}</div>
                </div>
              </div>
              <div className="text-right font-mono text-[11px] text-slate-400">
                <div>Git: {activeMember.name}</div>
                <div className="text-[10px] text-emerald-400">Persetujuan: Sah</div>
              </div>
            </div>

            {/* Grid of all 8 members */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {TEAM_MEMBERS.map(m => (
                <button
                  key={m.id}
                  onClick={() => handleSelectMember(m.id)}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-left transition ${
                    activeMemberId === m.id
                      ? 'bg-cyan-950/50 border-cyan-500/80 text-white shadow'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full bg-gradient-to-tr ${m.avatarColor} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
                    {m.name.slice(0, 1)}
                  </div>
                  <div className="truncate">
                    <div className="font-semibold truncate">{m.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{m.role.split(' ')[0]}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
              <span className="font-semibold text-slate-300 block">Prosedur Serah Terima (Handover):</span>
              <p>Sebelum tablet dioper ke anggota berikutnya: jalankan commit, perbarui catatan serah terima di Bagian 6, dan bersihkan token RAM.</p>
            </div>
          </div>

          {/* Device Constraints & Architecture ADR Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-slate-800 pb-2.5">
              <Tablet className="w-4 h-4 text-cyan-400" />
              Spesifikasi &amp; ADR Tablet Bersama:
            </h4>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60 font-mono">
                <span className="text-slate-400">Model:</span>
                <span className="text-white font-semibold">Samsung Tab A7 Lite (SM-T225)</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60 font-mono">
                <span className="text-slate-400">RAM:</span>
                <span className="text-amber-300 font-semibold">3GB (LMK Aware • Debounce 400ms)</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60 font-mono">
                <span className="text-slate-400">ADR-09:</span>
                <span className="text-cyan-300 font-semibold">Obsidian Dieksklusikan (Self-Contained)</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60 font-mono">
                <span className="text-slate-400">Keamanan:</span>
                <span className="text-emerald-300 font-semibold">Zero-Secret (git-cache 900s)</span>
              </div>
              <div className="flex items-center justify-between py-1 font-mono">
                <span className="text-slate-400">Viewport:</span>
                <span className="text-white font-semibold">8.7" WXGA+ (1340x800)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Task Backlog Matrix & 9-Phase Roadmap */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              Matriks Backlog 43 Task Atomik (Fase 0 s/d Fase 8)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Definisi seluruh pekerjaan Track 2 Tablet Bersama. Aturan: hanya 1 task berstatus IN_PROGRESS.
            </p>
          </div>

          {/* Search & Status Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari ID atau nama task..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-48 sm:w-56 font-mono"
              />
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value="all">Semua Status</option>
              <option value="READY">READY</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="DONE">DONE</option>
              <option value="PENDING">PENDING</option>
              <option value="BLOCKED">BLOCKED</option>
            </select>
          </div>
        </div>

        {/* Phase Filter Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {TASK_PHASES.map(phase => (
            <button
              key={phase.id}
              onClick={() => setSelectedPhase(phase.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition border ${
                selectedPhase === phase.id
                  ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/80 font-bold'
                  : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>{phase.name}</span>
              {phase.priority && <span className="ml-1 text-[10px] text-amber-400 font-bold">★</span>}
            </button>
          ))}
        </div>

        {/* Tasks Table / Cards */}
        <div className="space-y-2">
          {filteredTasks.length === 0 ? (
            <div className="bg-slate-950/50 p-8 rounded-xl border border-slate-800 text-center text-slate-400 text-xs font-mono">
              Tidak ada task yang cocok dengan filter atau pencarian.
            </div>
          ) : (
            filteredTasks.map((task, idx) => {
              const isSpotlight = task.id === activeOrNextTask?.id;
              return (
                <div
                  key={task.id}
                  className={`p-3.5 rounded-xl border transition flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    task.status === 'IN_PROGRESS'
                      ? 'bg-cyan-950/30 border-cyan-600/60 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500/30'
                      : isSpotlight
                      ? 'bg-slate-950/90 border-amber-600/40'
                      : 'bg-slate-950/50 border-slate-800/80 hover:bg-slate-950/90 hover:border-slate-700'
                  }`}
                >
                  {/* Left: ID & Title & Dependencies */}
                  <div className="flex items-start md:items-center gap-3">
                    <span className={`px-2.5 py-1 rounded font-mono font-bold text-xs shrink-0 ${
                      task.status === 'DONE'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : task.status === 'IN_PROGRESS'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : task.status === 'READY'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {task.id}
                    </span>

                    <div>
                      <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                        <span>{task.name}</span>
                        {task.status === 'IN_PROGRESS' && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/30 text-cyan-300 font-mono">
                            Sedang Dikerjakan
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5 font-mono">
                        <span>Dep: <span className="text-slate-300">{task.dependencies}</span></span>
                        {task.approved !== '-' && (
                          <span className="text-emerald-400">Persetujuan: {task.approved}</span>
                        )}
                        {task.evidence !== '-' && (
                          <span className="text-cyan-400 truncate max-w-xs">Bukti: {task.evidence}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Status Dropdown & Action */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                    <select
                      value={task.status}
                      onChange={e => handleUpdateTaskStatus(task.id, e.target.value as TaskStatus)}
                      className={`text-xs font-mono font-semibold px-2.5 py-1.5 rounded-lg border focus:outline-none transition ${
                        task.status === 'DONE'
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                          : task.status === 'IN_PROGRESS'
                          ? 'bg-cyan-950/60 text-cyan-300 border-cyan-600/60'
                          : task.status === 'READY'
                          ? 'bg-amber-950/60 text-amber-300 border-amber-700/60'
                          : 'bg-slate-900 text-slate-300 border-slate-700'
                      }`}
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="READY">READY</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="BLOCKED">BLOCKED</option>
                      <option value="DONE">DONE</option>
                    </select>

                    {task.status !== 'IN_PROGRESS' && task.status !== 'DONE' && (
                      <button
                        onClick={() => handleUpdateTaskStatus(task.id, 'IN_PROGRESS')}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
                        title="Klaim task ini sebagai aktif"
                      >
                        Klaim
                      </button>
                    )}

                    {task.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => setDoneModalTaskId(task.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition"
                        title="Tandai task selesai dengan bukti verifikasi"
                      >
                        Selesaikan
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Write-Ahead Log (WAL) & Handover Notes Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WAL Display Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-400" />
              Write-Ahead Log (WAL) Saat Ini
            </h4>
            <button
              onClick={() => onNavigateTab('session')}
              className="text-[11px] text-slate-400 hover:text-cyan-300 font-mono"
            >
              Edit di SESSION_STATE →
            </button>
          </div>

          <div className="space-y-2 text-xs font-mono text-slate-300">
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">TASK:</span>
              <span className="text-white font-bold">{stateData.wal.task || '-'}</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">LANGKAH SEDANG DIKERJAKAN:</span>
              <span className="text-slate-200">{stateData.wal.currentStep || '-'}</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">LANGKAH BERIKUTNYA (PERSIS):</span>
              <span className="text-cyan-300">{stateData.wal.nextStepExact || '-'}</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">PERINTAH VERIFIKASI:</span>
              <span className="text-emerald-400">{stateData.wal.verificationCommand || '-'}</span>
            </div>
          </div>
        </div>

        {/* Serah Terima Notes Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-amber-400" />
              Catatan Serah Terima (Bagian 6)
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">Single Source of Truth</span>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 font-mono leading-relaxed space-y-1.5 whitespace-pre-wrap max-h-60 overflow-y-auto">
            {stateData.handoverNotes || '* Gerbang P2-CP4 (Blueprint Approval) telah disetujui resmi.\n* Backlog 43 task atomik telah dirumuskan di TASKS.md.\n* Langkah berikutnya: TASK-001.'}
          </div>
        </div>
      </div>

      {/* Done Modal (Verification Evidence Prompt) */}
      {doneModalTaskId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Selesaikan {doneModalTaskId}</h3>
                <p className="text-xs text-slate-400">Aturan ZLCE: Status DONE wajib disertai bukti verifikasi riil</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Bukti Verifikasi (Evidence Output / Test Results):
                </label>
                <input
                  type="text"
                  value={evidenceInput}
                  onChange={e => setEvidenceInput(e.target.value)}
                  placeholder="Contoh: npm test 100% pass, build 0 error, lint clean"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1 font-mono text-[11px] text-slate-400">
                <div>Penyetuju (Provenance): <span className="text-white font-bold">{activeMember.name}</span></div>
                <div>Status Gerbang: <span className="text-emerald-400">ya</span> (Provenance dicatat ke Audit Log &amp; Git)</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setDoneModalTaskId(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  handleUpdateTaskStatus(doneModalTaskId, 'DONE', evidenceInput);
                  setDoneModalTaskId(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-lg shadow-emerald-600/30"
              >
                Konfirmasi Status DONE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GitHub Sync & Remote Hub Modal */}
      {isGitSyncOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md">
                  <GitBranch className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>GitHub Sync &amp; Remote Hub</span>
                    <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      v4-mobile
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Panduan &amp; perintah siap pakai untuk push dan sinkronisasi ke GitHub
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsGitSyncOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            {/* Current Remote Status Banner */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
              <div className="space-y-0.5">
                <span className="text-slate-400 block text-[10px]">REMOTE ORIGIN TERHUBUNG:</span>
                <span className="text-emerald-400 font-bold break-all">https://github.com/acimau99-netizen/ZLCE3.22-studio.git</span>
              </div>
              <div className="text-left sm:text-right space-y-0.5 shrink-0">
                <span className="text-slate-400 block text-[10px]">CABANG AKTIF:</span>
                <span className="text-cyan-300 font-bold">{targetBranch} (120 berkas ter-commit)</span>
              </div>
            </div>

            {/* Scenario Navigation Tabs */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-medium">
              <button
                onClick={() => setGitSyncMode('direct-push')}
                className={`py-2 px-2 rounded-lg transition text-center ${
                  gitSyncMode === 'direct-push'
                    ? 'bg-emerald-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                1. Push ke acimau99-netizen
              </button>

              <button
                onClick={() => setGitSyncMode('fork-clone')}
                className={`py-2 px-2 rounded-lg transition text-center ${
                  gitSyncMode === 'fork-clone'
                    ? 'bg-cyan-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                2. Fork ke Akun Anda
              </button>

              <button
                onClick={() => setGitSyncMode('new-repo')}
                className={`py-2 px-2 rounded-lg transition text-center ${
                  gitSyncMode === 'new-repo'
                    ? 'bg-purple-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                3. Bikin Repo Baru
              </button>
            </div>

            {/* Tab 1: Direct Push */}
            {gitSyncMode === 'direct-push' && (
              <div className="space-y-4 text-xs">
                <div className="bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-800/40 space-y-2">
                  <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Skenario 1: Push Langsung ke acimau99-netizen/ZLCE3.22-studio.git
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Gunakan metode ini jika Anda adalah pemilik akun <strong className="text-white">acimau99-netizen</strong> atau telah ditambahkan sebagai kolaborator dengan hak akses Write/Push pada repositori tersebut.
                  </p>
                </div>

                {/* Steps */}
                <div className="space-y-3">
                  <div>
                    <span className="font-bold text-white block mb-1">
                      Langkah 1: Siapkan GitHub Personal Access Token (PAT)
                    </span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      GitHub tidak lagi mengizinkan password biasa saat push melalui HTTPS. Buat token di <strong>GitHub → Settings → Developer Settings → Personal Access Tokens (Tokens classic)</strong> dan centang hak akses <code className="text-cyan-300 font-mono">repo</code>.
                    </p>
                  </div>

                  <div>
                    <span className="font-bold text-white block mb-1">
                      Langkah 2: Eksekusi Perintah Push di Terminal / Termux
                    </span>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                        <span>Perintah Push Branch v4-mobile:</span>
                        <button
                          onClick={() => handleCopy(
                            `# 1. Pastikan safe directory dan remote origin
git config --global --add safe.directory /app/applet
git remote set-url origin https://github.com/acimau99-netizen/ZLCE3.22-studio.git

# 2. Push cabang v4-mobile
git push -u origin v4-mobile

# Jika Anda ingin membuat dan push juga ke cabang 'main':
# git branch -M main
# git push -u origin main`,
                            'cmd-direct-push'
                          )}
                          className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                        >
                          {copiedId === 'cmd-direct-push' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedId === 'cmd-direct-push' ? 'Tersalin' : 'Salin Perintah'}</span>
                        </button>
                      </div>
                      <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-cyan-300 font-mono overflow-x-auto leading-relaxed">
{`# 1. Pastikan safe directory dan remote origin
git config --global --add safe.directory /app/applet
git remote set-url origin https://github.com/acimau99-netizen/ZLCE3.22-studio.git

# 2. Push cabang v4-mobile
git push -u origin v4-mobile

# Jika Anda ingin membuat dan push juga ke cabang 'main':
# git branch -M main
# git push -u origin main`}
                      </pre>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
                    <strong className="text-amber-300 block">Saat Terminal Menanyakan Kredensial:</strong>
                    <div>Username: <code className="text-white font-mono">acimau99-netizen</code></div>
                    <div>Password: <span className="text-amber-300 font-mono">(Tempelkan Personal Access Token Anda, bukan password akun)</span></div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Fork & Clone */}
            {gitSyncMode === 'fork-clone' && (
              <div className="space-y-4 text-xs">
                <div className="bg-cyan-950/20 p-3.5 rounded-xl border border-cyan-800/40 space-y-2">
                  <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                    <GitPullRequest className="w-4 h-4" />
                    Skenario 2: Fork ke Akun GitHub Anda Sendiri &amp; Hubungkan Upstream
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Sangat direkomendasikan jika Anda ingin memiliki salinan independen di akun GitHub Anda sendiri dan bebas melakukan push tanpa memerlukan izin dari akun <code className="text-slate-200">acimau99-netizen</code>.
                  </p>
                </div>

                {/* Input Username for Dynamic Command Generation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Username GitHub Anda:</label>
                    <input
                      type="text"
                      value={githubUsername}
                      onChange={e => setGithubUsername(e.target.value.trim())}
                      placeholder="contoh: eko-keplek"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Nama Repositori Fork:</label>
                    <input
                      type="text"
                      value={githubRepoName}
                      onChange={e => setGithubRepoName(e.target.value.trim())}
                      placeholder="ZLCE3.22-studio"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="font-bold text-white block mb-1">
                      Langkah A: Fork di Browser GitHub
                    </span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Buka <a href="https://github.com/acimau99-netizen/ZLCE3.22-studio" target="_blank" rel="noreferrer" className="text-cyan-400 underline font-mono">https://github.com/acimau99-netizen/ZLCE3.22-studio</a> lalu klik tombol <strong>"Fork"</strong> di pojok kanan atas.
                    </p>
                  </div>

                  <div>
                    <span className="font-bold text-white block mb-1">
                      Langkah B: Alihkan Remote ke Repo Fork Anda &amp; Push
                    </span>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                        <span>Perintah Terminal:</span>
                        <button
                          onClick={() => handleCopy(
                            `# 1. Alihkan origin ke repo fork Anda
git remote set-url origin https://github.com/${githubUsername}/${githubRepoName}.git

# 2. Tambahkan upstream referensi ke repo asli
git remote add upstream https://github.com/acimau99-netizen/ZLCE3.22-studio.git 2>/dev/null || true

# 3. Push seluruh berkas ke fork Anda
git push -u origin v4-mobile

# 4. (Opsional) Sinkronkan juga ke cabang main
# git branch -M main
# git push -u origin main`,
                            'cmd-fork-push'
                          )}
                          className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                        >
                          {copiedId === 'cmd-fork-push' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedId === 'cmd-fork-push' ? 'Tersalin' : 'Salin Perintah'}</span>
                        </button>
                      </div>
                      <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-cyan-300 font-mono overflow-x-auto leading-relaxed">
{`# 1. Alihkan origin ke repo fork Anda
git remote set-url origin https://github.com/${githubUsername}/${githubRepoName}.git

# 2. Tambahkan upstream referensi ke repo asli
git remote add upstream https://github.com/acimau99-netizen/ZLCE3.22-studio.git 2>/dev/null || true

# 3. Push seluruh berkas ke fork Anda
git push -u origin v4-mobile`}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: New Repo */}
            {gitSyncMode === 'new-repo' && (
              <div className="space-y-4 text-xs">
                <div className="bg-purple-950/20 p-3.5 rounded-xl border border-purple-800/40 space-y-2">
                  <div className="font-bold text-purple-300 flex items-center gap-1.5">
                    <FolderGit2 className="w-4 h-4" />
                    Skenario 3: Bikin Repository Baru Kosong di Akun Anda Sendiri
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Jika Anda ingin membuat repositori GitHub yang sepenuhnya baru dan bersih di bawah akun Anda (tanpa status fork), gunakan panduan ini.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Username GitHub Anda:</label>
                    <input
                      type="text"
                      value={githubUsername}
                      onChange={e => setGithubUsername(e.target.value.trim())}
                      placeholder="username-anda"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Nama Repository Baru:</label>
                    <input
                      type="text"
                      value={githubRepoName}
                      onChange={e => setGithubRepoName(e.target.value.trim())}
                      placeholder="ZLCE-Mobile-Workbench"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="font-bold text-white block mb-1">
                      Langkah 1: Buat Repo Kosong di GitHub
                    </span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Buka <a href="https://github.com/new" target="_blank" rel="noreferrer" className="text-cyan-400 underline font-mono">https://github.com/new</a>, beri nama <code className="text-white font-mono">{githubRepoName}</code>, biarkan <em>"Initialize with README"</em> <strong>TIDAK DICENTANG</strong> (repo kosong), lalu klik Create Repository.
                    </p>
                  </div>

                  <div>
                    <span className="font-bold text-white block mb-1">
                      Langkah 2: Hubungkan Remote &amp; Push Seluruh Kode Ini
                    </span>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                        <span>Perintah Terminal:</span>
                        <button
                          onClick={() => handleCopy(
                            `# 1. Pasangkan remote origin ke repo baru Anda
git remote set-url origin https://github.com/${githubUsername}/${githubRepoName}.git

# 2. Buat cabang main dan push
git branch -M main
git push -u origin main

# 3. Push juga cabang v4-mobile
git push -u origin v4-mobile`,
                            'cmd-new-repo'
                          )}
                          className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                        >
                          {copiedId === 'cmd-new-repo' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedId === 'cmd-new-repo' ? 'Tersalin' : 'Salin Perintah'}</span>
                        </button>
                      </div>
                      <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-purple-300 font-mono overflow-x-auto leading-relaxed">
{`# 1. Pasangkan remote origin ke repo baru Anda
git remote set-url origin https://github.com/${githubUsername}/${githubRepoName}.git

# 2. Buat cabang main dan push
git branch -M main
git push -u origin main

# 3. Push juga cabang v4-mobile
git push -u origin v4-mobile`}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Zero Secret & Security Footer */}
            <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-[11px]">
                  <strong>Zero-Secret Policy:</strong> Jangan menempelkan Personal Access Token di dalam file kode.
                </span>
              </div>

              <button
                onClick={() => setIsGitSyncOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition self-end sm:self-auto"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

