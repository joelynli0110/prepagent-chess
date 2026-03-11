import Link from "next/link";
import { apiGet } from "@/lib/api";
import { OpponentSpace } from "@/lib/types";

export default async function OpponentsPage() {
  const opponents = await apiGet<OpponentSpace[]>("/opponents");

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Opponent Spaces</h1>

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
          </Link>
        ))}
      </div>
    </main>
  );
}