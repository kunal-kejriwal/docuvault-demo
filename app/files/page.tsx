"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiengine";
import DocuVault, { type ApiFile } from "@/components/docuvault";

interface FilesResponse {
  files: ApiFile[];
  used_bytes: number;
  used_mb: number;
  storage_limit_mb: number;
  storage_pct: number;
}

export default function FilesPage() {
  const [data, setData] = useState<FilesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<FilesResponse>("/api/v1/files/")
      .then(setData)
      .catch((err: Error) => setError(err.message ?? "Failed to load files"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <i className="fa-solid fa-spinner fa-spin fa-3x text-blue-500" />
          <p className="mt-4 text-slate-500 text-sm">Loading files…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center max-w-md px-4">
          <i className="fa-solid fa-triangle-exclamation fa-3x text-red-400" />
          <p className="mt-4 text-lg font-semibold text-slate-700">
            Failed to load files
          </p>
          <p className="mt-2 text-slate-500 text-sm font-mono break-all">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <DocuVault
      files={data?.files ?? []}
      usedBytes={data?.used_bytes ?? 0}
      storageLimitMb={data?.storage_limit_mb ?? 200}
    />
  );
}
