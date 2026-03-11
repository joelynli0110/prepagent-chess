import { createOpponentAction } from "./actions";

export function CreateOpponentForm() {
  return (
    <form action={createOpponentAction} className="rounded-2xl border p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Create Opponent</h2>
        <p className="text-sm text-gray-500">Start a new preparation space.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1">
          <div className="text-sm font-medium">Display name</div>
          <input
            name="display_name"
            placeholder="e.g. Magnus Test"
            className="w-full rounded-xl border px-3 py-2 text-sm"
            required
          />
        </label>

        <label className="space-y-1">
          <div className="text-sm font-medium">Canonical name</div>
          <input
            name="canonical_name"
            placeholder="e.g. magnustest"
            className="w-full rounded-xl border px-3 py-2 text-sm"
            required
          />
        </label>
      </div>

      <label className="space-y-1 block">
        <div className="text-sm font-medium">Notes</div>
        <textarea
          name="notes"
          placeholder="Optional notes"
          className="w-full rounded-xl border px-3 py-2 text-sm min-h-24"
        />
      </label>

      <button
        type="submit"
        className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
      >
        Create opponent
      </button>
    </form>
  );
}