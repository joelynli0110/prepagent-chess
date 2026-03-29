"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

export function DeleteAllButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteAll() {
    setDeleting(true);
    try {
      await fetch(`${API_BASE}/opponents`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-xl border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
      >
        Delete all
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
      <span className="text-sm text-red-800">Delete all opponents and their games?</span>
      <button
        type="button"
        disabled={deleting}
        onClick={handleDeleteAll}
        className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
      >
        {deleting ? "Deleting…" : "Yes, delete all"}
      </button>
      <button
        type="button"
        disabled={deleting}
        onClick={() => setConfirming(false)}
        className="rounded-xl border px-4 py-2 text-sm hover:bg-white disabled:opacity-50 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
