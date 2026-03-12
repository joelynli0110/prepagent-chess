import Link from "next/link";
import { apiGet } from "@/lib/api";
import { OpponentSpace } from "@/lib/types";
import { CreateOpponentForm } from "./CreateOpponentForm";

export default async function OpponentsPage() {
  const opponents = await apiGet<OpponentSpace[]>("/opponents");

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Opponents</h1>

      <CreateOpponentForm />

      {opponents.length === 0 ? (
        <div className="rounded-2xl border p-6 text-sm text-gray-500">
          No opponents yet. Create one above to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {opponents.map((opponent) => (
            <Link
              key={opponent.id}
              href={`/opponents/${opponent.id}`}
              className="flex items-center justify-between rounded-2xl border p-4 hover:bg-gray-50"
            >
              <div>
                <div className="font-medium">{opponent.display_name}</div>
                <div className="text-sm text-gray-400">
                  {opponent.canonical_name}
                </div>
              </div>
              <span className="text-sm text-gray-400">→</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
