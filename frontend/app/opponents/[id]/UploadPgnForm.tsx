"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadPgnForm({ opponentId }: { opponentId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const acceptFile = (f: File | null) => {
    setFile(f);
    setStatus(null);
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    if (dropped) acceptFile(dropped);
  }, []);

  function clearFile() {
    setFile(null);
    setStatus(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!file) {
      setStatus({ type: "error", text: "Please choose a PGN file first." });
      return;
    }

    setIsUploading(true);
    setStatus(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${API_BASE}/opponents/${opponentId}/imports/pgn`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Upload failed: ${res.status} ${text}`);
      }

      setStatus({ type: "success", text: `"${file.name}" uploaded successfully.` });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setStatus({ type: "error", text: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Upload PGN</h2>
        <p className="text-sm text-gray-500">
          Drag &amp; drop a PGN file here, or click to browse.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        name="file"
        accept=".pgn,text/plain"
        className="hidden"
        onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
      />

      <div
        role="button"
        tabIndex={isUploading ? -1 : 0}
        aria-label="Click or drag to upload a PGN file"
        onClick={() => !isUploading && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && !isUploading && inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={[
          "cursor-pointer select-none rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
          isDragging
            ? "border-blue-400 bg-blue-50"
            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
          isUploading ? "pointer-events-none opacity-50" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {file ? (
          <div className="space-y-1">
            <div className="text-2xl leading-none">📄</div>
            <div className="mt-2 text-sm font-medium text-gray-800">{file.name}</div>
            <div className="text-xs text-gray-400">{formatBytes(file.size)}</div>
            <div className="mt-1 text-xs text-gray-400">Click to change file</div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-3xl leading-none text-gray-300">↑</div>
            <div className="text-sm text-gray-500">
              Drop a <span className="font-semibold">.pgn</span> file here, or{" "}
              <span className="font-semibold text-blue-600">browse</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isUploading || !file}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isUploading ? "Uploading…" : "Upload PGN"}
        </button>

        {file && !isUploading && (
          <button
            type="button"
            onClick={clearFile}
            className="text-sm text-gray-400 transition-colors hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </div>

      {status && (
        <p
          className={`rounded-xl border px-4 py-2 text-sm ${
            status.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {status.text}
        </p>
      )}
    </form>
  );
}
