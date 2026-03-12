"use client";

import { useState, useTransition } from "react";
import { deleteOpponentAction } from "./actions";

export function DeleteOpponentButton({
  opponentId,
  opponentName,
}: {
  opponentId: string;
  opponentName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(() => deleteOpponentAction(opponentId));
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-xl border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
      >
        Delete opponent
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
      <span className="text-sm text-red-800">
        Delete <strong>{opponentName}</strong> and all its games?
      </span>
      <button
        type="button"
        disabled={isPending}
        onClick={handleDelete}
        className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {isPending ? "Deleting…" : "Yes, delete everything"}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => setConfirming(false)}
        className="rounded-xl border px-4 py-2 text-sm hover:bg-white disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
}
