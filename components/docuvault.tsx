"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

export interface ApiFile {
  id: string;
  original_filename: string;
  file_url: string;
  download_url: string;
  content_type: string;
  size_bytes: number;
  size_mb: number;
  access_type: string;
  is_public: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface DocuFile {
  id: string;
  name: string;
  type: string;
  size: number;
  dateModified: string;
  accessType: string;
  fileUrl: string;
  downloadUrl: string;
}

// -------------------------------------------------------------------
// Mapping
// -------------------------------------------------------------------

const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "text/plain": "txt",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "video/quicktime": "mov",
  "video/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
};

function deriveType(filename: string, contentType: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext && ext.length <= 5 && ext !== filename.toLowerCase()) return ext;
  return MIME_TO_EXT[contentType] ?? "file";
}

function mapApiFile(f: ApiFile): DocuFile {
  return {
    id: f.id,
    name: f.original_filename,
    type: deriveType(f.original_filename, f.content_type),
    size: f.size_bytes,
    dateModified: f.updated_at,
    accessType: f.access_type,
    fileUrl: f.file_url,
    downloadUrl: f.download_url,
  };
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function formatBytes(b: number): string {
  if (b === 0) return "0 Bytes";
  const k = 1024;
  const units = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getIconForType(type: string): { icon: string; color: string } {
  const map: Record<string, { icon: string; color: string }> = {
    pdf:    { icon: "fa-file-pdf",    color: "text-red-500"    },
    jpg:    { icon: "fa-file-image",  color: "text-purple-500" },
    jpeg:   { icon: "fa-file-image",  color: "text-purple-500" },
    png:    { icon: "fa-file-image",  color: "text-purple-500" },
    gif:    { icon: "fa-file-image",  color: "text-purple-500" },
    webp:   { icon: "fa-file-image",  color: "text-purple-500" },
    docx:   { icon: "fa-file-word",   color: "text-sky-600"    },
    doc:    { icon: "fa-file-word",   color: "text-sky-600"    },
    xlsx:   { icon: "fa-file-excel",  color: "text-green-600"  },
    xls:    { icon: "fa-file-excel",  color: "text-green-600"  },
    zip:    { icon: "fa-file-zipper", color: "text-amber-500"  },
    txt:    { icon: "fa-file-lines",  color: "text-slate-500"  },
    mov:    { icon: "fa-file-video",  color: "text-orange-500" },
    mp4:    { icon: "fa-file-video",  color: "text-orange-500" },
    mp3:    { icon: "fa-music",       color: "text-pink-500"   },
    wav:    { icon: "fa-music",       color: "text-pink-500"   },
    folder: { icon: "fa-folder",      color: "text-blue-500"   },
  };
  return map[type] ?? { icon: "fa-file", color: "text-slate-500" };
}

function accessLabel(accessType: string): string {
  if (accessType === "password")  return "Password protected";
  if (accessType === "email_otp") return "Email verification required";
  if (accessType === "private")   return "Private";
  return "";
}

// -------------------------------------------------------------------
// Nav config
// -------------------------------------------------------------------

type NavId = "all" | "documents" | "images" | "videos" | "audios";

interface NavItem {
  id: NavId;
  name: string;
  iconInactive: string;
  iconActive: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "all",       name: "All Files",  iconInactive: "fa-regular fa-grip-vertical",  iconActive: "fa-solid fa-grip-vertical"  },
  { id: "documents", name: "Documents",  iconInactive: "fa-regular fa-file-lines",     iconActive: "fa-solid fa-file-lines"     },
  { id: "images",    name: "Images",     iconInactive: "fa-regular fa-image",          iconActive: "fa-solid fa-image"          },
  { id: "videos",    name: "Videos",     iconInactive: "fa-regular fa-circle-play",    iconActive: "fa-solid fa-circle-play"    },
  { id: "audios",    name: "Audios",     iconInactive: "fa-solid fa-music",            iconActive: "fa-solid fa-music"          },
];

const TYPE_FILTERS: Record<NavId, string[] | null> = {
  all:       null,
  documents: ["pdf", "docx", "doc", "xlsx", "xls", "txt"],
  images:    ["jpg", "jpeg", "png", "gif", "webp"],
  videos:    ["mov", "mp4", "avi", "mkv", "webm"],
  audios:    ["mp3", "wav", "ogg", "flac", "aac"],
};

const STORAGE_SHADES = ["#2DD4BF", "#26C3B1", "#20B2A3", "#1AA195", "#159087", "#107F7A"];

// -------------------------------------------------------------------
// Sub-components
// -------------------------------------------------------------------

function LockBadge({ accessType, className = "" }: { accessType: string; className?: string }) {
  if (accessType === "public") return null;
  return (
    <span
      title={accessLabel(accessType)}
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-50 border border-amber-200 text-amber-500 ${className}`}
    >
      <i className="fa-solid fa-lock text-[9px]" />
    </span>
  );
}

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-slate-800 text-white text-sm rounded-xl shadow-xl max-w-sm"
    >
      <i className="fa-solid fa-circle-exclamation text-amber-400 flex-shrink-0" />
      <span>{message}</span>
      <button onClick={onDismiss} className="ml-1 text-slate-400 hover:text-white transition-colors flex-shrink-0">
        <i className="fa-solid fa-xmark" />
      </button>
    </motion.div>
  );
}

interface PasswordModalProps {
  file: DocuFile;
  action: "open" | "download";
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
}

function PasswordModal({ file, action, onClose, onSubmit }: PasswordModalProps) {
  const [value, setValue]   = useState("");
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) { setError("Please enter the password."); return; }
    setLoading(true);
    setError("");
    try {
      await onSubmit(value);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Incorrect password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.15 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
            <i className="fa-solid fa-lock text-amber-500" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-base">Password Required</h3>
            <p className="text-xs text-slate-500 truncate max-w-[200px]">{file.name}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600 transition-colors">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="password"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(""); }}
            placeholder="Enter file password"
            className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
          />
          {error && (
            <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
              <i className="fa-solid fa-circle-exclamation" /> {error}
            </p>
          )}
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <i className="fa-solid fa-spinner fa-spin" /> : <i className={`fa-solid ${action === "download" ? "fa-download" : "fa-arrow-up-right-from-square"}`} />}
              {action === "download" ? "Download" : "Open"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

interface DocuVaultProps {
  files: ApiFile[];
  usedBytes: number;
  storageLimitMb: number;
}

export default function DocuVault({ files: apiFiles, usedBytes, storageLimitMb }: DocuVaultProps) {
  const [activeNav, setActiveNav] = useState<NavId>("all");
  const [view, setView]           = useState<"grid" | "list">("grid");
  const [search, setSearch]       = useState("");
  const [sortKey, setSortKey]     = useState<"name" | "dateModified" | "size">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const [toast, setToast]         = useState<string | null>(null);
  const [pwModal, setPwModal]     = useState<{ file: DocuFile; action: "open" | "download" } | null>(null);

  const files = useMemo(() => apiFiles.map(mapApiFile), [apiFiles]);

  const filteredFiles = useMemo(() => {
    let result = files.filter((f) => !failedIds.has(f.id));
    const typeFilter = TYPE_FILTERS[activeNav];
    if (typeFilter) result = result.filter((f) => typeFilter.includes(f.type));
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((f) => f.name.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name")         cmp = a.name.localeCompare(b.name);
      else if (sortKey === "dateModified") cmp = new Date(a.dateModified).getTime() - new Date(b.dateModified).getTime();
      else                             cmp = a.size - b.size;
      return sortOrder === "asc" ? cmp : -cmp;
    });
    return result;
  }, [files, failedIds, activeNav, search, sortKey, sortOrder]);

  const recentFiles = useMemo(
    () => files
      .filter((f) => !failedIds.has(f.id))
      .sort((a, b) => new Date(b.dateModified).getTime() - new Date(a.dateModified).getTime())
      .slice(0, 4),
    [files, failedIds]
  );

  function showToast(msg: string) { setToast(msg); }

  // ── File action handlers ─────────────────────────────────────────

  async function handleOpen(file: DocuFile) {
    if (file.accessType === "private") {
      showToast("This file is private — only the owner can access it.");
      return;
    }
    if (file.accessType === "password") {
      setPwModal({ file, action: "open" });
      return;
    }
    if (file.accessType === "email_otp") {
      showToast("This file requires email verification to access.");
      return;
    }
    try {
      const res = await fetch(file.fileUrl, { method: "HEAD" });
      if (res.status === 404) {
        setFailedIds((prev) => new Set([...prev, file.id]));
        showToast("File not found — the record may have been deleted.");
        return;
      }
    } catch { /* CORS on HEAD — try opening anyway */ }
    window.open(file.fileUrl, "_blank", "noopener,noreferrer");
  }

  async function handleDownload(file: DocuFile) {
    if (file.accessType === "private") {
      showToast("This file is private — only the owner can access it.");
      return;
    }
    if (file.accessType === "password") {
      setPwModal({ file, action: "download" });
      return;
    }
    if (file.accessType === "email_otp") {
      showToast("This file requires email verification to access.");
      return;
    }
    const dlUrl = `${file.downloadUrl}${file.downloadUrl.includes("?") ? "&" : "?"}dl=1`;
    try {
      const res = await fetch(dlUrl, { method: "HEAD" });
      if (res.status === 404) {
        setFailedIds((prev) => new Set([...prev, file.id]));
        showToast("File not found — the record may have been deleted.");
        return;
      }
    } catch { /* CORS — proceed */ }
    const a = document.createElement("a");
    a.href = dlUrl;
    a.rel = "noopener noreferrer";
    a.click();
  }

  async function handlePasswordSubmit(password: string) {
    if (!pwModal) return;
    const accessUrl = pwModal.file.downloadUrl.replace(/\/download\/?$/, "/access/");
    const res = await fetch(accessUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "use_password", password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Incorrect password.");
    const token: string = data.access_token;
    const url = `${pwModal.file.downloadUrl}?token=${token}${pwModal.action === "download" ? "&dl=1" : ""}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setPwModal(null);
  }

  // ── Sort helpers ─────────────────────────────────────────────────

  function handleSort(key: "name" | "dateModified" | "size") {
    if (sortKey === key) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortOrder("asc"); }
  }

  function sortIcon(key: string) {
    if (sortKey !== key) return "fa-sort";
    return sortOrder === "asc" ? "fa-arrow-up" : "fa-arrow-down";
  }

  // ── Usage ────────────────────────────────────────────────────────

  const usedMb        = usedBytes / (1024 * 1024);
  const usagePct      = storageLimitMb > 0 ? Math.min((usedMb / storageLimitMb) * 100, 100) : 0;
  const TOTAL_SEGMENTS = 20;
  const filledSegments = Math.round((usagePct / 100) * TOTAL_SEGMENTS);

  const navLabel  = NAV_ITEMS.find((n) => n.id === activeNav)?.name ?? "All Files";
  const pageTitle = search ? "Search results" : navLabel;

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="bg-slate-100 font-sans text-slate-800 h-screen w-screen overflow-hidden flex">

      {/* ── Modals & toasts ──────────────────────────────────────── */}
      <AnimatePresence>
        {toast && <Toast key="toast" message={toast} onDismiss={() => setToast(null)} />}
        {pwModal && (
          <PasswordModal
            key="pw-modal"
            file={pwModal.file}
            action={pwModal.action}
            onClose={() => setPwModal(null)}
            onSubmit={handlePasswordSubmit}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside className="w-[270px] h-screen bg-white flex flex-col border-r border-slate-200 flex-shrink-0">
        <div className="px-7 pt-7 pb-8 flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <i className="fa-solid fa-cube text-violet-700 text-3xl" />
            <span className="text-xl font-medium text-slate-800">
              Docu<span className="font-bold">Vault</span>
            </span>
          </div>
        </div>

        <nav className="flex-grow px-5 flex flex-col overflow-y-auto">
          <div>
            <h3 className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Menu</h3>
            <ul className="mt-2 space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive = activeNav === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => setActiveNav(item.id)}
                      className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                        isActive
                          ? "bg-white text-slate-800 font-semibold border border-slate-200 shadow-sm"
                          : "text-slate-500 font-medium hover:bg-slate-100 hover:text-slate-800"
                      }`}
                    >
                      <i className={`${isActive ? item.iconActive : item.iconInactive} w-6 text-center text-lg`} />
                      <span>{item.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Usage card */}
          <div className="mt-6 px-1">
            <div className="w-full bg-white rounded-[14px] border border-gray-100 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
              <div className="flex justify-between items-center mb-1">
                <h2 className="text-base font-bold text-gray-900">Storage</h2>
                <span className="text-xs font-medium text-gray-500">
                  {usedMb.toFixed(1)}/{storageLimitMb} MB
                </span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed mb-4">
                {usagePct.toFixed(0)}% of your storage used.
              </p>
              <div className="flex items-center space-x-1">
                {Array.from({ length: TOTAL_SEGMENTS }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[32px] w-full rounded-full"
                    style={{ backgroundColor: i < filledSegments ? STORAGE_SHADES[i % STORAGE_SHADES.length] : "#E5E7EB" }}
                  />
                ))}
              </div>
            </div>
          </div>
        </nav>

        {/* APIEngine badge */}
        <div className="px-7 py-5 border-t border-slate-100 flex-shrink-0">
          <a
            href="https://theapiengine.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 transition-colors group"
          >
            <i className="fa-solid fa-bolt text-violet-400 group-hover:text-violet-600 transition-colors" />
            <span>Powered by <span className="font-semibold">APIEngine</span></span>
          </a>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="flex-grow flex flex-col h-full overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex-shrink-0 flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => setActiveNav("all")}
              className={`px-1 py-0.5 rounded transition-colors ${
                activeNav === "all"
                  ? "font-semibold text-slate-800 cursor-default"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              }`}
            >
              Dashboard
            </button>
            {activeNav !== "all" && (
              <>
                <i className="fa-solid fa-chevron-right text-slate-300 text-xs" />
                <span className="font-semibold text-slate-800 px-1 py-0.5">{navLabel}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <div className="relative hidden sm:block">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input
                type="text"
                placeholder="Search files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-48 lg:w-64 pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all placeholder:text-slate-400"
              />
            </div>
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              {(["list", "grid"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  title={v === "grid" ? "Grid View" : "List View"}
                  className={`p-2 rounded-lg transition-all ${view === v ? "bg-white shadow-sm text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
                >
                  <i className={`fa-solid ${v === "grid" ? "fa-th-large" : "fa-list"} fa-fw`} />
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="flex-grow overflow-y-auto p-4 md:p-6">
          {/* Quick Access */}
          {activeNav === "all" && !search && recentFiles.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-700 mb-4">Quick Access</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {recentFiles.map((item) => {
                  const { icon, color } = getIconForType(item.type);
                  const isProtected = item.accessType !== "public";
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => handleOpen(item)}
                      className="relative bg-white p-4 rounded-lg shadow-sm border border-transparent hover:border-blue-500 hover:shadow-md transition-all cursor-pointer flex items-center gap-4 select-none group"
                    >
                      <i className={`fa-solid ${icon} ${color} fa-2x flex-shrink-0`} />
                      <div className="overflow-hidden flex-grow min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-slate-700 truncate text-sm">{item.name}</p>
                          {isProtected && <LockBadge accessType={item.accessType} className="flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-slate-500">{formatDate(item.dateModified)}</p>
                      </div>
                      {!isProtected && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                          title="Download"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex-shrink-0"
                        >
                          <i className="fa-solid fa-download text-sm" />
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          <h2 className="text-xl font-semibold text-slate-700 mb-4">
            {pageTitle}
            <span className="ml-2 text-sm font-normal text-slate-400">({filteredFiles.length})</span>
          </h2>

          {filteredFiles.length === 0 && (
            <div className="text-center py-20">
              <i className="fa-solid fa-ghost fa-3x text-slate-300" />
              <p className="mt-4 text-slate-500">{search ? "No results found" : "No files here"}</p>
            </div>
          )}

          {/* Grid view */}
          {filteredFiles.length > 0 && view === "grid" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
              {filteredFiles.map((item, idx) => {
                const { icon, color } = getIconForType(item.type);
                const isProtected = item.accessType !== "public";
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.15, delay: idx * 0.02 }}
                    onClick={() => handleOpen(item)}
                    className="relative flex flex-col items-center justify-center p-4 rounded-xl text-center cursor-pointer transition-all duration-200 border-2 select-none bg-white border-transparent hover:bg-slate-50 hover:border-slate-200 hover:shadow-sm group"
                  >
                    {/* Lock badge */}
                    {isProtected && (
                      <div className="absolute top-2 left-2">
                        <LockBadge accessType={item.accessType} />
                      </div>
                    )}
                    <i className={`fa-solid ${icon} ${color} fa-4x mb-3`} />
                    <span className="font-medium text-sm text-slate-700 break-words w-full truncate">{item.name}</span>
                    {/* Download button (public only) */}
                    {!isProtected && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                        title="Download"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-white shadow-sm border border-slate-200 text-slate-400 hover:text-slate-600"
                      >
                        <i className="fa-solid fa-download text-xs" />
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* List view */}
          {filteredFiles.length > 0 && view === "list" && (
            <div className="flex flex-col">
              <div className="grid grid-cols-12 items-center gap-4 px-4 py-2 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200 mb-2">
                <div className="col-span-12 md:col-span-5 cursor-pointer select-none hover:text-slate-700" onClick={() => handleSort("name")}>
                  Name <i className={`fa-solid ${sortIcon("name")} text-[10px]`} />
                </div>
                <div className="col-span-6 md:col-span-3 cursor-pointer select-none hover:text-slate-700" onClick={() => handleSort("dateModified")}>
                  Date Modified <i className={`fa-solid ${sortIcon("dateModified")} text-[10px]`} />
                </div>
                <div className="col-span-6 md:col-span-2 cursor-pointer select-none hover:text-slate-700" onClick={() => handleSort("size")}>
                  Size <i className={`fa-solid ${sortIcon("size")} text-[10px]`} />
                </div>
                <div className="hidden md:block col-span-2">Actions</div>
              </div>

              {filteredFiles.map((item, idx) => {
                const { icon, color } = getIconForType(item.type);
                const isProtected = item.accessType !== "public";
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.12, delay: idx * 0.015 }}
                    onClick={() => handleOpen(item)}
                    className="grid grid-cols-12 items-center gap-4 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200 select-none border-l-4 bg-white border-l-transparent hover:bg-slate-50 hover:border-l-slate-300 mb-1 group"
                  >
                    <div className="col-span-12 md:col-span-5 flex items-center gap-3">
                      <i className={`fa-solid ${icon} ${color} fa-lg w-5 text-center flex-shrink-0`} />
                      <span className="font-medium text-sm text-slate-700 truncate">{item.name}</span>
                      {isProtected && <LockBadge accessType={item.accessType} className="flex-shrink-0" />}
                    </div>
                    <div className="col-span-6 md:col-span-3 text-sm text-slate-500">{formatDate(item.dateModified)}</div>
                    <div className="col-span-6 md:col-span-2 text-sm text-slate-500">{formatBytes(item.size)}</div>
                    <div className="hidden md:flex col-span-2 items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpen(item); }}
                        title={isProtected ? accessLabel(item.accessType) : "Open"}
                        className={`p-1.5 rounded-lg transition-colors ${isProtected ? "text-amber-400 hover:text-amber-600 hover:bg-amber-50" : "text-slate-400 hover:text-blue-600 hover:bg-blue-50"}`}
                      >
                        <i className={`fa-solid ${isProtected ? "fa-lock" : "fa-arrow-up-right-from-square"} text-sm`} />
                      </button>
                      {!isProtected && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                          title="Download"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          <i className="fa-solid fa-download text-sm" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
