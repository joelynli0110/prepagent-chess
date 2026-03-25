import { createOpponentAction } from "./actions";

export function CreateOpponentForm() {
  return (
    <form action={createOpponentAction} className="rounded-2xl border p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Add Opponent</h2>
        <p className="text-sm text-gray-500">Start a new preparation space.</p>
      </div>

      <div className="flex gap-3">
        <input
          name="display_name"
          placeholder="e.g. Magnus Carlsen"
          className="flex-1 rounded-xl border px-3 py-2 text-sm"
          required
        />
        <button
          type="submit"
          className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50 shrink-0"
        >
          Add
        </button>
      </div>
    </form>
  );
}