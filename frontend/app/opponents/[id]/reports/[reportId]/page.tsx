import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGet } from "@/lib/api";
import { Report } from "@/lib/types";
import { T } from "@/components/T";
import { ReportContent } from "./ReportContent";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string; reportId: string }>;
}) {
  const { id, reportId } = await params;

  let report: Report;
  try {
    report = await apiGet<Report>(`/opponents/${id}/reports/${reportId}`);
  } catch {
    notFound();
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 space-y-8">
      <Link
        href={`/opponents/${id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors"
      >
        <T k="back_to_opponent" />
      </Link>

      <ReportContent report={report} opponentId={id} reportId={reportId} />
    </main>
  );
}
