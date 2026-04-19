"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TrashIcon, XIcon } from "./Icons";

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
        title="Delete all"
        onClick={() => setConfirming(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-200 text-red-600 transition-colors hover:bg-red-50"
      >
        <TrashIcon className="h-4 w-4" />
        <span className="sr-only">Delete all</span>
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5">
      <span className="text-sm text-red-800">Delete all opponents?</span>
      <button
        type="button"
        disabled={deleting}
        onClick={handleDeleteAll}
        className="rounded-full bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
      >
        {deleting ? "Deleting..." : "Delete"}
      </button>
      <button
        type="button"
        disabled={deleting}
        onClick={() => setConfirming(false)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-white text-red-500 transition-colors hover:bg-red-100 disabled:opacity-50"
        title="Cancel"
      >
        <XIcon className="h-4 w-4" />
        <span className="sr-only">Cancel</span>
      </button>
    </div>
  );
}
