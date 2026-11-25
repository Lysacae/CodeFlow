export type PersonCard = {
  id: string;
  username: string;
  avatarData: string | null;
};

export type SocialRequest = {
  id: string;
  userId: string;
  username: string;
  avatarData: string | null;
  at: string;
};

export type SocialMessage = {
  id: string;
  from: string;
  text: string;
  at: string;
  readAt: string | null;
  reactions: Record<string, string>;
};

export type SocialThread = {
  peerId: string;
  username: string;
  avatarData: string | null;
  messages: SocialMessage[];
  unread: number;
  peerTyping?: boolean;
};

export type SocialSnapshot = {
  friends: PersonCard[];
  incoming: SocialRequest[];
  outgoing: SocialRequest[];
  threads: SocialThread[];
  blocked: PersonCard[];
};

export const emptySocial = (): SocialSnapshot => ({
  friends: [],
  incoming: [],
  outgoing: [],
  threads: [],
  blocked: [],
});

export function blockStorageKey(userId: string) {
  return `cf-blocked-${userId}`;
}

export function readLocalBlocked(userId: string): string[] {
  try {
    const raw = localStorage.getItem(blockStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function writeLocalBlocked(userId: string, ids: string[]) {
  localStorage.setItem(blockStorageKey(userId), JSON.stringify([...new Set(ids)]));
}

/** Le nuage fait foi ; les identifiants locaux encore présents restent masqués. */
export function applyBlockFlags(snapshot: SocialSnapshot, userId: string | null | undefined): SocialSnapshot {
  const cloudIds = (snapshot.blocked ?? []).map((person) => person.id);
  if (!userId) {
    return { ...snapshot, blocked: snapshot.blocked ?? [] };
  }
  const local = readLocalBlocked(userId);
  const ids = new Set([...cloudIds, ...local]);
  writeLocalBlocked(userId, [...ids]);
  if (ids.size === 0) return { ...snapshot, blocked: snapshot.blocked ?? [] };
  const blocked = [...(snapshot.blocked ?? [])];
  for (const id of local) {
    if (!blocked.some((person) => person.id === id)) {
      const friend = snapshot.friends.find((person) => person.id === id);
      const thread = snapshot.threads.find((item) => item.peerId === id);
      blocked.push({
        id,
        username: friend?.username ?? thread?.username ?? "Utilisateur",
        avatarData: friend?.avatarData ?? thread?.avatarData ?? null,
      });
    }
  }
  return {
    ...snapshot,
    friends: snapshot.friends.filter((person) => !ids.has(person.id)),
    incoming: snapshot.incoming.filter((request) => !ids.has(request.userId)),
    outgoing: snapshot.outgoing.filter((request) => !ids.has(request.userId)),
    threads: snapshot.threads.filter((thread) => !ids.has(thread.peerId)),
    blocked,
  };
}

export const MESSAGE_EMOJIS = ["😀", "😂", "❤️", "👍", "🎉", "🔥", "✨", "👏", "😮", "🙏"];
