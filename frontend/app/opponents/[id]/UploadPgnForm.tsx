"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

export function UploadPgnForm({ opponentId }: { opponentId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!file) {
      setMessage("Please choose a PGN file first.");
      return;
    }

    setIsUploading(true);
    setMessage("");

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

      setMessage(`Uploaded: ${file.name}`);
      setFile(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Upload PGN</h2>
        <p className="text-sm text-gray-500">
          First choose a PGN file, then click Upload PGN.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept=".pgn,text/plain"
          className="hidden"
          onChange={(e) => {
            const selected = e.target.files?.[0] ?? null;
            setFile(selected);
            setMessage("");
          }}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Choose file
        </button>

        <div className="text-sm text-gray-600">
          {file ? file.name : "No file selected"}
        </div>
      </div>

      <button
        type="submit"
        disabled={isUploading}
        className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
      >
        {isUploading ? "Uploading..." : "Upload PGN"}
      </button>

      {message ? <p className="text-sm text-gray-600">{message}</p> : null}
    </form>
  );
}