import Link from "next/link";
import { apiGet } from "@/lib/api";
import { OpponentSpace } from "@/lib/types";
import { CreateOpponentForm } from "./CreateOpponentForm";

export default async function OpponentsPage() {
  const opponents = await apiGet<OpponentSpace[]>("/opponents");

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Opponent Spaces</h1>

      <CreateOpponentForm />

      {opponents.length === 0 ? (
        <div className="rounded-2xl border p-4 text-sm text-gray-600">
          No opponent spaces yet.
        </div>
      ) : (
        <div className="space-y-3">
          {opponents.map((opponent) => (
            <Link
              key={opponent.id}
              href={`/opponents/${opponent.id}`}
              className="block rounded-2xl border p-4 hover:bg-gray-50"
            >
              <div className="font-medium">{opponent.display_name}</div>
              <div className="text-sm text-gray-500">
                canonical: {opponent.canonical_name}
              </div>
              <div className="text-xs text-gray-400 mt-1">id: {opponent.id}</div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}