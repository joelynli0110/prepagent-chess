"use server";

import { redirect } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

export async function createOpponentAction(formData: FormData) {
  const display_name = String(formData.get("display_name") ?? "").trim();

  if (!display_name) {
    throw new Error("Name is required");
  }

  // Store canonical_name as the trimmed display name (preserving spaces) so that
  // OpponentIdentityService._name_tokens() can split it into individual name tokens
  // for matching against PGN player names in any format (e.g. "Carlsen, Magnus").
  const canonical_name = display_name.trim();

  const res = await fetch(`${API_BASE}/opponents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      display_name,
      canonical_name,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create opponent failed: ${res.status} ${text}`);
  }

  const created = await res.json();
  redirect(`/opponents/${created.id}`);
}