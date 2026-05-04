"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

// Shape returned by GET /api/v1/files/
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

// Internal shape DocuVault renders with
interface DocuFile {
  id: string;
  name: string;
  // extension-based type: pdf | jpg | png | docx | xlsx | zip | txt | mov | mp4 | mp3 | wav | …
  // MISMATCH NOTE: APIEngine returns content_type (MIME), not an extension.
  // We derive the extension from filename first, falling back to a MIME→ext map.
  type: string;
  size: number;
  dateModified: string;
  owner: string;
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
  // Accept the filename extension only when it looks like a real extension
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
    owner: "Me",
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
  {
    id: "all",
    name: "All Files",
    iconInactive: "fa-regular fa-grip-vertical",
    iconActive:   "fa-solid fa-grip-vertical",
  },
  {
    id: "documents",
    name: "Documents",
    iconInactive: "fa-regular fa-file-lines",
    iconActive:   "fa-solid fa-file-lines",
  },
  {
    id: "images",
    name: "Images",
    iconInactive: "fa-regular fa-image",
    iconActive:   "fa-solid fa-image",
  },
  {
    id: "videos",
    name: "Videos",
    iconInactive: "fa-regular fa-circle-play",
    iconActive:   "fa-solid fa-circle-play",
  },
  {
    id: "audios",
    name: "Audios",
    iconInactive: "fa-solid fa-music",
    iconActive:   "fa-solid fa-music",
  },
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
// Component
// -------------------------------------------------------------------

interface DocuVaultProps {
  files: ApiFile[];
  usedBytes: number;
  storageLimitMb: number;
}

export default function DocuVault({
  files: apiFiles,
  usedBytes,
  storageLimitMb,
}: DocuVaultProps) {
  const [activeNav, setActiveNav]   = useState<NavId>("all");
  const [view, setView]             = useState<"grid" | "list">("grid");
  const [search, setSearch]         = useState("");
  const [sortKey, setSortKey]       = useState<"name" | "dateModified" | "size">("name");
  const [sortOrder, setSortOrder]   = useState<"asc" | "desc">("asc");

  // Map API files once
  const files = useMemo(() => apiFiles.map(mapApiFile), [apiFiles]);

  // Filtered + sorted file list
  const filteredFiles = useMemo(() => {
    let result = [...files];

    const typeFilter = TYPE_FILTERS[activeNav];
    if (typeFilter) {
      result = result.filter((f) => typeFilter.includes(f.type));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((f) => f.name.toLowerCase().includes(q));
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortKey === "dateModified") {
        cmp = new Date(a.dateModified).getTime() - new Date(b.dateModified).getTime();
      } else {
        cmp = a.size - b.size;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });

    return result;
  }, [files, activeNav, search, sortKey, sortOrder]);

  // Quick access = 4 most recently modified
  const recentFiles = useMemo(
    () =>
      [...files]
        .sort(
          (a, b) =>
            new Date(b.dateModified).getTime() - new Date(a.dateModified).getTime()
        )
        .slice(0, 4),
    [files]
  );

  function handleSort(key: "name" | "dateModified" | "size") {
    if (sortKey === key) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  }

  function sortIcon(key: string) {
    if (sortKey !== key) return "fa-sort";
    return sortOrder === "asc" ? "fa-arrow-up" : "fa-arrow-down";
  }

  // Usage card segments
  const usedMb = usedBytes / (1024 * 1024);
  const usagePct = storageLimitMb > 0 ? Math.min((usedMb / storageLimitMb) * 100, 100) : 0;
  const TOTAL_SEGMENTS = 20;
  const filledSegments = Math.round((usagePct / 100) * TOTAL_SEGMENTS);

  const navLabel = NAV_ITEMS.find((n) => n.id === activeNav)?.name ?? "All Files";
  const pageTitle = search ? "Search results" : navLabel;

  return (
    <div className="bg-slate-100 font-sans text-slate-800 h-screen w-screen overflow-hidden flex">

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside className="w-[270px] h-screen bg-white flex flex-col border-r border-slate-200 flex-shrink-0">
        {/* Logo */}
        <div className="px-7 pt-7 pb-8 flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <i className="fa-solid fa-cube text-violet-700 text-3xl" />
            <span className="text-xl font-medium text-slate-800">
              Docu<span className="font-bold">Vault</span>
            </span>
          </div>
        </div>

        <nav className="flex-grow px-5 flex flex-col overflow-y-auto">
          {/* Menu */}
          <div>
            <h3 className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Menu
            </h3>
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
                      <i
                        className={`${
                          isActive ? item.iconActive : item.iconInactive
                        } w-6 text-center text-lg`}
                      />
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
                <h2 className="text-base font-bold text-gray-900">Usage</h2>
                <span className="text-xs font-medium text-gray-500">
                  {usedMb.toFixed(1)}/{storageLimitMb} MB
                </span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed mb-4">
                Upgrade your plan for more space.
              </p>
              <div className="flex items-center space-x-1 mb-4">
                {Array.from({ length: TOTAL_SEGMENTS }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[32px] w-full rounded-full"
                    style={{
                      backgroundColor:
                        i < filledSegments
                          ? STORAGE_SHADES[i % STORAGE_SHADES.length]
                          : "#E5E7EB",
                    }}
                  />
                ))}
              </div>
              <button className="w-full bg-white text-gray-700 font-semibold text-xs py-2 px-3 rounded-[10px] border border-gray-200 hover:bg-gray-50 active:scale-[0.98] transition-all duration-150 shadow-sm">
                Go Unlimited
              </button>
            </div>
          </div>
        </nav>
      </aside>

      {/* ── Main content ─────────────────────────────────────── */}
      <div className="flex-grow flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex-shrink-0 flex items-center justify-between px-4 md:px-6">
          {/* Breadcrumbs */}
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
                <span className="font-semibold text-slate-800 px-1 py-0.5">
                  {navLabel}
                </span>
              </>
            )}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Search */}
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

            {/* View toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              {(["list", "grid"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  title={v === "grid" ? "Grid View" : "List View"}
                  className={`p-2 rounded-lg transition-all ${
                    view === v
                      ? "bg-white shadow-sm text-blue-600"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <i
                    className={`fa-solid ${
                      v === "grid" ? "fa-th-large" : "fa-list"
                    } fa-fw`}
                  />
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* File area */}
        <main className="flex-grow overflow-y-auto p-4 md:p-6">
          {/* Quick access — dashboard only */}
          {activeNav === "all" && !search && recentFiles.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-700 mb-4">
                Quick Access
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {recentFiles.map((item) => {
                  const { icon, color } = getIconForType(item.type);
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="bg-white p-4 rounded-lg shadow-sm border border-transparent hover:border-blue-500 hover:shadow-md transition-all cursor-default flex items-center gap-4 select-none"
                    >
                      <i className={`fa-solid ${icon} ${color} fa-2x`} />
                      <div className="overflow-hidden">
                        <p className="font-medium text-slate-700 truncate text-sm">
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(item.dateModified)}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          <h2 className="text-xl font-semibold text-slate-700 mb-4">
            {pageTitle}
            <span className="ml-2 text-sm font-normal text-slate-400">
              ({filteredFiles.length})
            </span>
          </h2>

          {/* Empty state */}
          {filteredFiles.length === 0 && (
            <div className="text-center py-20">
              <i className="fa-solid fa-ghost fa-3x text-slate-300" />
              <p className="mt-4 text-slate-500">
                {search ? "No results found" : "No files here"}
              </p>
            </div>
          )}

          {/* Grid view */}
          {filteredFiles.length > 0 && view === "grid" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
              {filteredFiles.map((item, idx) => {
                const { icon, color } = getIconForType(item.type);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.15, delay: idx * 0.02 }}
                    className="flex flex-col items-center justify-center p-4 rounded-xl text-center cursor-default transition-all duration-200 border-2 select-none bg-white border-transparent hover:bg-slate-50 hover:border-slate-200 hover:shadow-sm"
                  >
                    <i className={`fa-solid ${icon} ${color} fa-4x mb-3`} />
                    <span className="font-medium text-sm text-slate-700 break-words w-full truncate">
                      {item.name}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* List view */}
          {filteredFiles.length > 0 && view === "list" && (
            <div className="flex flex-col">
              {/* List header */}
              <div className="grid grid-cols-12 items-center gap-4 px-4 py-2 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200 mb-2">
                <div
                  className="col-span-12 md:col-span-5 cursor-pointer select-none hover:text-slate-700"
                  onClick={() => handleSort("name")}
                >
                  Name{" "}
                  <i className={`fa-solid ${sortIcon("name")} text-[10px]`} />
                </div>
                <div
                  className="col-span-6 md:col-span-3 cursor-pointer select-none hover:text-slate-700"
                  onClick={() => handleSort("dateModified")}
                >
                  Date Modified{" "}
                  <i className={`fa-solid ${sortIcon("dateModified")} text-[10px]`} />
                </div>
                <div
                  className="col-span-6 md:col-span-2 cursor-pointer select-none hover:text-slate-700"
                  onClick={() => handleSort("size")}
                >
                  Size{" "}
                  <i className={`fa-solid ${sortIcon("size")} text-[10px]`} />
                </div>
                <div className="hidden md:block col-span-2">Owner</div>
              </div>

              {filteredFiles.map((item, idx) => {
                const { icon, color } = getIconForType(item.type);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.12, delay: idx * 0.015 }}
                    className="grid grid-cols-12 items-center gap-4 px-4 py-3 rounded-lg cursor-default transition-all duration-200 select-none border-l-4 bg-white border-l-transparent hover:bg-slate-50 hover:border-l-slate-300 mb-1"
                  >
                    <div className="col-span-12 md:col-span-5 flex items-center gap-4">
                      <i className={`fa-solid ${icon} ${color} fa-lg w-5 text-center`} />
                      <span className="font-medium text-sm text-slate-700 truncate">
                        {item.name}
                      </span>
                    </div>
                    <div className="col-span-6 md:col-span-3 text-sm text-slate-500">
                      {formatDate(item.dateModified)}
                    </div>
                    <div className="col-span-6 md:col-span-2 text-sm text-slate-500">
                      {formatBytes(item.size)}
                    </div>
                    <div className="hidden md:block col-span-2 text-sm text-slate-500">
                      {item.owner}
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
