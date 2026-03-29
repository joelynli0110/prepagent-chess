import Link from "next/link";
import { apiGet } from "@/lib/api";
import { OpponentSpace } from "@/lib/types";
import { T } from "@/components/T";
import { CreateOpponentForm } from "./CreateOpponentForm";
import { DeleteAllButton } from "./DeleteAllButton";

export default async function OpponentsPage() {
  const opponents = await apiGet<OpponentSpace[]>("/opponents");

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900"><T k="opponents_title" /></h1>
        <p className="mt-1 text-sm text-gray-500"><T k="opponents_sub" /></p>
      </div>

      <CreateOpponentForm />

      {opponents.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <div className="text-2xl mb-2">♟</div>
          <p className="text-sm font-medium text-gray-600"><T k="no_opponents" /></p>
          <p className="text-sm text-gray-400 mt-1"><T k="no_opponents_sub" /></p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              {opponents.length} opponent{opponents.length !== 1 ? "s" : ""}
            </p>
            <DeleteAllButton />
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
            {opponents.map((opponent) => (
              <Link
                key={opponent.id}
                href={`/opponents/${opponent.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <span className="font-medium text-gray-900">{opponent.display_name}</span>
                <span className="text-xs text-gray-400"><T k="view" /></span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
