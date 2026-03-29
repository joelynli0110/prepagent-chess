"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImportSection({ opponentId }: { opponentId: string }) {
  const router = useRouter();
  const [showUpload, setShowUpload] = useState(false);
  const [showChesscom, setShowChesscom] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [chesscomUrl, setChesscomUrl] = useState("");
  const [chesscomImporting, setChesscomImporting] = useState(false);
  const [chesscomMsg, setChesscomMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const acceptFile = (f: File | null) => { setFile(f); setUploadMsg(null); };
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    if (f) acceptFile(f);
  }, []);

  async function onImportChesscom(e: React.FormEvent) {
    e.preventDefault();
    if (!chesscomUrl.trim()) return;
    setChesscomImporting(true);
    setChesscomMsg(null);
    try {
      const res = await fetch(`${API_BASE}/opponents/${opponentId}/imports/chesscom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: chesscomUrl.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? `Failed (${res.status})`);
      }
      setChesscomMsg({ ok: true, text: "Chess.com import started — games will appear shortly." });
      setChesscomUrl("");
      router.refresh();
    } catch (err) {
      setChesscomMsg({ ok: false, text: err instanceof Error ? err.message : "Import failed." });
    } finally { setChesscomImporting(false); }
  }

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/opponents/${opponentId}/imports/pgn`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      setUploadMsg({ ok: true, text: `"${file.name}" uploaded.` });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setUploadMsg({ ok: false, text: err instanceof Error ? err.message : "Upload failed." });
    } finally { setUploading(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setShowUpload((v) => !v); setShowChesscom(false); setFile(null); setUploadMsg(null); }}
          className={`rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors ${showUpload ? "bg-gray-50" : "bg-white"}`}
        >
          Upload PGN
        </button>
        <button
          onClick={() => { setShowChesscom((v) => !v); setShowUpload(false); setChesscomMsg(null); }}
          className={`rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors ${showChesscom ? "bg-gray-50" : "bg-white"}`}
        >
          Chess.com
        </button>
      </div>

      {showChesscom && (
        <form onSubmit={onImportChesscom} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <p className="text-xs text-gray-400">
            Paste a Chess.com member URL or username — e.g.{" "}
            <span className="font-mono text-gray-500">https://www.chess.com/member/hikaru</span>
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={chesscomUrl}
              onChange={(e) => setChesscomUrl(e.target.value)}
              placeholder="https://www.chess.com/member/hikaru or hikaru"
              disabled={chesscomImporting}
              className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-300 focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={chesscomImporting || !chesscomUrl.trim()}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
            >
              {chesscomImporting ? "Importing…" : "Import"}
            </button>
          </div>
          {chesscomMsg && (
            <span className={`text-xs ${chesscomMsg.ok ? "text-gray-400" : "text-rose-600"}`}>
              {chesscomMsg.text}
            </span>
          )}
        </form>
      )}

      {showUpload && (
        <form onSubmit={onUpload} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept=".pgn,text/plain"
            className="hidden"
            onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
          />
          <div
            role="button"
            tabIndex={uploading ? -1 : 0}
            onClick={() => !uploading && inputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && !uploading && inputRef.current?.click()}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={[
              "cursor-pointer select-none rounded-lg border-2 border-dashed px-6 py-6 text-center transition-colors",
              isDragging ? "border-gray-400 bg-gray-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
              uploading ? "pointer-events-none opacity-50" : "",
            ].filter(Boolean).join(" ")}
          >
            {file ? (
              <div className="text-sm">
                <span className="font-medium text-gray-800">{file.name}</span>
                <span className="ml-2 text-gray-400">{formatBytes(file.size)}</span>
              </div>
            ) : (
              <span className="text-sm text-gray-400">
                Drop a <span className="font-medium text-gray-600">.pgn</span> file here or{" "}
                <span className="font-medium text-gray-700 underline underline-offset-2">browse</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={uploading || !file}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
            {file && !uploading && (
              <button type="button"
                onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; }}
                className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
                Clear
              </button>
            )}
            {uploadMsg && (
              <span className={`text-xs ${uploadMsg.ok ? "text-gray-400" : "text-rose-600"}`}>
                {uploadMsg.text}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
