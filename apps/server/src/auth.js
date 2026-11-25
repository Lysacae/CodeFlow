import { emailFromUsername, supabaseFetch } from "./supabase.js";

export function publicUser(user) {
  const meta = user.user_metadata || {};
  return {
    id: user.id,
    username: meta.username || String(user.email || "").split("@")[0],
    avatarData: meta.avatarData ?? null,
  };
}

export async function register({ username, password, avatarData }) {
  const name = String(username || "").trim();
  if (name.length < 3 || name.length > 24) {
    throw Object.assign(new Error("Le pseudo doit contenir entre 3 et 24 caractères."), {
      status: 400,
    });
  }
  if (![...name].every((c) => /[a-zA-Z0-9_-]/.test(c))) {
    throw Object.assign(new Error("Pseudo : lettres, chiffres, _ ou - uniquement."), {
      status: 400,
    });
  }
  if (String(password || "").length < 4) {
    throw Object.assign(new Error("Le mot de passe doit contenir au moins 4 caractères."), {
      status: 400,
    });
  }

  const email = emailFromUsername(name);
  let created;
  try {
    created = await supabaseFetch("/auth/v1/admin/users", {
      method: "POST",
      body: {
        email,
        password: String(password),
        email_confirm: true,
        user_metadata: {
          username: name,
          avatarData: avatarData && String(avatarData).trim() ? String(avatarData) : null,
        },
        app_metadata: {
          progress: null,
        },
      },
    });
  } catch (e) {
    const msg = String(e.message || "");
    if (/already|exists|registered|duplicate/i.test(msg) || e.status === 422) {
      throw Object.assign(new Error("Ce pseudo est déjà utilisé."), { status: 409 });
    }
    throw e;
  }

  const session = await supabaseFetch("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password: String(password) },
  });

  return {
    user: publicUser(created),
    token: session.access_token,
  };
}

export async function login({ username, password }) {
  const email = emailFromUsername(username);
  let session;
  try {
    session = await supabaseFetch("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: { email, password: String(password || "") },
    });
  } catch {
    throw Object.assign(new Error("Pseudo ou mot de passe incorrect."), { status: 401 });
  }

  const user =
    session.user ||
    (await supabaseFetch("/auth/v1/user", { token: session.access_token }));

  return {
    user: publicUser(user),
    token: session.access_token,
  };
}

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Non authentifié." });
  }
  try {
    const user = await supabaseFetch("/auth/v1/user", { token });
    req.user = user;
    req.accessToken = token;
    next();
  } catch {
    return res.status(401).json({ error: "Session expirée ou invalide." });
  }
}
