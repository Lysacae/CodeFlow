const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.warn(
    "[codeflow-server] SUPABASE_URL / SUPABASE_SECRET_KEY manquants — auth cloud indisponible.",
  );
}

export function emailFromUsername(username) {
  const safe = String(username || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  return `${safe}@accounts.codeflow.app`;
}

export async function supabaseFetch(path, { method = "GET", body, token } = {}) {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw Object.assign(new Error("Supabase non configuré sur le serveur."), {
      status: 503,
    });
  }

  const headers = {
    apikey: SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${token || SUPABASE_SECRET_KEY}`,
    "User-Agent": "codeflow-server/1.0",
    "Content-Type": "application/json",
  };

  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg =
      data?.msg ||
      data?.error_description ||
      data?.error ||
      data?.message ||
      `Erreur Supabase (${res.status})`;
    throw Object.assign(new Error(msg), { status: res.status, data });
  }

  return data;
}

export { SUPABASE_URL, SUPABASE_SECRET_KEY };
