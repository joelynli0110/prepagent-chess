"use client";

import { useState, useTransition } from "react";
import { deleteOpponentAction } from "./actions";
import { TrashIcon, XIcon } from "./Icons";

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
        title="Delete opponent"
        onClick={() => setConfirming(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-200 text-red-600 transition-colors hover:bg-red-50"
      >
        <TrashIcon className="h-4 w-4" />
        <span className="sr-only">Delete opponent</span>
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5">
      <span className="text-sm text-red-800">
        Delete <strong>{opponentName}</strong>?
      </span>
      <button
        type="button"
        disabled={isPending}
        onClick={handleDelete}
        className="rounded-full bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {isPending ? "Deleting..." : "Delete"}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => setConfirming(false)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-white text-red-500 hover:bg-red-100 disabled:opacity-50"
        title="Cancel"
      >
        <XIcon className="h-4 w-4" />
        <span className="sr-only">Cancel</span>
      </button>
    </div>
  );
}
