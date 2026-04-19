import Link from "next/link";
import { apiGet } from "@/lib/api";
import { OpponentSpace } from "@/lib/types";
import { ChevronRightIcon } from "./Icons";
import { CreateOpponentForm } from "./CreateOpponentForm";
import { DeleteAllButton } from "./DeleteAllButton";

export default async function OpponentsPage() {
  const opponents = await apiGet<OpponentSpace[]>("/opponents");

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Opponents</h1>
          <p className="mt-1 text-sm text-gray-500">{opponents.length} tracked</p>
        </div>
        {opponents.length > 0 && <DeleteAllButton />}
      </div>

      <CreateOpponentForm />

      {opponents.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400 shadow-sm">
          No opponents yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {opponents.map((opponent, index) => (
            <Link
              key={opponent.id}
              href={`/opponents/${opponent.id}`}
              className={`flex items-center justify-between px-5 py-4 transition-colors hover:bg-gray-50 ${index > 0 ? "border-t border-gray-100" : ""}`}
            >
              <div className="min-w-0">
                <div className="font-medium text-gray-900">{opponent.display_name}</div>
                <div className="text-xs text-gray-400">{new Date(opponent.created_at).toLocaleDateString()}</div>
              </div>
              <ChevronRightIcon className="h-4 w-4 text-gray-300" />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
