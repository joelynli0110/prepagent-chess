"use server";

import { redirect } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

export async function analyzeOpponentAction(opponentId: string) {
  const res = await fetch(`${API_BASE}/opponents/${opponentId}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      depth: 10,
      max_games: 20,
      max_plies: 40,
      only_missing: false,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    redirect(`/opponents/${opponentId}?status=error&message=${encodeURIComponent(`Analyze failed: ${text}`)}`);
  }

  const data = await res.json();

  const message = `Analyzed ${data.analyzed_games} game(s), ${data.analyzed_positions} position(s).`;
  redirect(`/opponents/${opponentId}?status=success&message=${encodeURIComponent(message)}`);
}

export async function uploadPgnAction(opponentId: string, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    redirect(`/opponents/${opponentId}?status=error&message=${encodeURIComponent("PGN file is required")}`);
  }

  const outgoing = new FormData();
  outgoing.append("file", file);

  const res = await fetch(`${API_BASE}/opponents/${opponentId}/imports/pgn`, {
    method: "POST",
    body: outgoing,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    redirect(`/opponents/${opponentId}?status=error&message=${encodeURIComponent(`Upload failed: ${text}`)}`);
  }

  redirect(`/opponents/${opponentId}?status=success&message=${encodeURIComponent("PGN uploaded successfully.")}`);
}