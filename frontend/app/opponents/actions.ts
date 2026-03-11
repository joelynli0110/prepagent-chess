"use server";

import { redirect } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

export async function createOpponentAction(formData: FormData) {
  const display_name = String(formData.get("display_name") ?? "").trim();
  const canonical_name = String(formData.get("canonical_name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!display_name || !canonical_name) {
    throw new Error("display_name and canonical_name are required");
  }

  const res = await fetch(`${API_BASE}/opponents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      display_name,
      canonical_name,
      notes: notes || null,
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