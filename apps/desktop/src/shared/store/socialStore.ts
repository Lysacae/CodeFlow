import { create } from "zustand";
import {
  apiSocialBlock,
  apiSocialDelete,
  apiSocialDeleteThread,
  apiSocialReact,
  apiSocialRead,
  apiSocialRequest,
  apiSocialRespond,
  apiSocialSend,
  apiSocialSnapshot,
  apiSocialRemoveFriend,
  apiSocialTyping,
  apiSocialUnblock,
  flashTaskbar,
} from "@/shared/lib/api";
import { playNotifySound } from "@/shared/lib/notifySound";
import { applyBlockFlags, emptySocial, MESSAGE_EMOJIS, readLocalBlocked, writeLocalBlocked, type SocialSnapshot } from "@/shared/lib/social";
import type { StatPatch } from "@/shared/lib/progression";
import { useAuthStore } from "@/shared/store/authStore";

type Panel = "friends" | "messages" | null;

export type SocialNotice = {
  id: string;
  title: string;
  body: string;
};

type SocialState = {
  ready: boolean;
  snapshot: SocialSnapshot;
  error: string | null;
  panel: Panel;
  activePeer: string | null;
  primed: boolean;
  incomingBaseline: number;
  notices: SocialNotice[];
  dismissNotice: (id: string) => void;
  start: () => void;
  stop: () => void;
  refresh: () => Promise<void>;
  openFriends: () => void;
  openMessages: (peerId?: string | null) => void;
  close: () => void;
  setActivePeer: (peerId: string | null) => void;
  sendRequest: (username: string) => Promise<void>;
  respond: (requestId: string, accept: boolean) => Promise<void>;
  send: (peerId: string, text: string) => Promise<void>;
  markRead: (peerId: string) => Promise<void>;
  removeMessage: (peerId: string, messageId: string) => Promise<void>;
  react: (peerId: string, messageId: string, emoji: string) => Promise<void>;
  deleteThread: (peerId: string) => Promise<void>;
  removeFriend: (userId: string) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  signalTyping: (peerId: string, active: boolean) => Promise<void>;
};

let timer: number | null = null;
const seenNoticeKeys = new Set<string>();
const NOTICE_LIMIT = 4;
const NOTICE_MS = 6500;

function claimNotice(key: string) {
  if (seenNoticeKeys.has(key)) return false;
  seenNoticeKeys.add(key);
  return true;
}

function previewText(text: string) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= 72) return flat;
  return `${flat.slice(0, 71)}…`;
}

function diffNotices(prev: SocialSnapshot, next: SocialSnapshot, meId: string | null): SocialNotice[] {
  const out: SocialNotice[] = [];
  const prevReq = new Set(prev.incoming.map((request) => request.id));
  for (const request of next.incoming) {
    const key = `in:${request.id}`;
    if (prevReq.has(request.id) || !claimNotice(key)) continue;
    out.push({ id: key, title: "Demande d'ami", body: request.username });
  }
  if (!meId) return out;
  const prevMsg = new Set<string>();
  for (const thread of prev.threads) {
    for (const message of thread.messages) prevMsg.add(message.id);
  }
  for (const thread of next.threads) {
    const fresh = thread.messages.filter((message) => !prevMsg.has(message.id) && message.from !== meId);
    const claimed = fresh.filter((message) => claimNotice(`msg:${message.id}`));
    if (claimed.length === 0) continue;
    const last = claimed[claimed.length - 1];
    out.push({
      id: `msg:${last.id}`,
      title: claimed.length > 1 ? "Nouveaux messages" : "Nouveau message",
      body:
        claimed.length > 1
          ? `${thread.username} (${claimed.length})`
          : `${thread.username} — ${previewText(last.text) || "…"}`,
    });
  }
  return out;
}

function rememberNotices(items: SocialNotice[]) {
  for (const item of items) {
    window.setTimeout(() => {
      useSocialStore.setState((state) => ({
        notices: state.notices.filter((notice) => notice.id !== item.id),
      }));
    }, NOTICE_MS);
  }
}

function note(patch: StatPatch) {
  void import("@/shared/store/progressionStore").then((mod) => {
    mod.useProgressionStore.getState().record(patch);
  });
}

function hasEmoji(text: string) {
  return /\p{Extended_Pictographic}/u.test(text) || MESSAGE_EMOJIS.some((emoji) => text.includes(emoji));
}

function adopt(snapshot: SocialSnapshot): SocialSnapshot {
  const normalized = {
    ...snapshot,
    blocked: snapshot.blocked ?? [],
    threads: (snapshot.threads ?? []).map((thread) => ({ ...thread, peerTyping: Boolean(thread.peerTyping) })),
  };
  return applyBlockFlags(normalized, useAuthStore.getState().user?.id);
}

function sameSnapshot(a: SocialSnapshot, b: SocialSnapshot) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const useSocialStore = create<SocialState>((set, get) => ({
  ready: false,
  snapshot: emptySocial(),
  error: null,
  panel: null,
  activePeer: null,
  primed: false,
  incomingBaseline: 0,
  notices: [],
  dismissNotice: (id) =>
    set((state) => ({ notices: state.notices.filter((notice) => notice.id !== id) })),
  start: () => {
    if (timer != null) return;
    void get().refresh();
    timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void get().refresh();
    }, 4000);
    window.addEventListener("focus", onFocus);
  },
  stop: () => {
    if (timer != null) window.clearInterval(timer);
    timer = null;
    window.removeEventListener("focus", onFocus);
    seenNoticeKeys.clear();
    set({
      ready: false,
      snapshot: emptySocial(),
      error: null,
      panel: null,
      activePeer: null,
      primed: false,
      incomingBaseline: 0,
      notices: [],
    });
  },
  refresh: async () => {
    try {
      const snapshot = adopt(await apiSocialSnapshot());
      const count = snapshot.incoming.length;
      const prev = get();
      const requestAlert = prev.primed && count > prev.incomingBaseline;
      if (requestAlert) {
        playNotifySound();
        void flashTaskbar();
      }
      const incomingNotices = prev.primed
        ? diffNotices(prev.snapshot, snapshot, useAuthStore.getState().user?.id ?? null)
        : [];
      if (!requestAlert && incomingNotices.some((notice) => notice.id.startsWith("msg:"))) {
        playNotifySound();
        void flashTaskbar();
      }
      if (
        prev.ready &&
        incomingNotices.length === 0 &&
        sameSnapshot(prev.snapshot, snapshot) &&
        prev.incomingBaseline === count &&
        prev.error == null
      ) {
        return;
      }
      if (incomingNotices.length > 0) rememberNotices(incomingNotices);
      set({
        snapshot,
        ready: true,
        error: null,
        primed: true,
        incomingBaseline: count,
        notices:
          incomingNotices.length > 0
            ? [...prev.notices, ...incomingNotices].slice(-NOTICE_LIMIT)
            : prev.notices,
      });
    } catch (error) {
      if (!get().ready) {
        set({ error: error instanceof Error ? error.message : String(error), ready: true });
      }
    }
  },
  openFriends: () => {
    set({ panel: "friends" });
    void get().refresh();
  },
  openMessages: (peerId) => {
    set({
      panel: "messages",
      activePeer: peerId ?? get().activePeer,
    });
    void get().refresh();
  },
  close: () => set({ panel: null }),
  setActivePeer: (peerId) => set({ activePeer: peerId }),
  sendRequest: async (username) => {
    const snapshot = adopt(await apiSocialRequest(username));
    set({ snapshot, error: null, incomingBaseline: snapshot.incoming.length });
    note({ requestsSent: 1 });
  },
  respond: async (requestId, accept) => {
    const snapshot = adopt(await apiSocialRespond(requestId, accept));
    set({ snapshot, error: null, incomingBaseline: snapshot.incoming.length });
    note(accept ? { accepts: 1, friendPeak: snapshot.friends.length } : { refuses: 1 });
  },
  send: async (peerId, text) => {
    const snapshot = adopt(await apiSocialSend(peerId, text));
    set({ snapshot, error: null });
    note({ messagesSent: 1, emojiSent: hasEmoji(text) });
    void apiSocialTyping(peerId, false).catch(() => undefined);
  },
  markRead: async (peerId) => {
    const before = get().snapshot.threads.find((thread) => thread.peerId === peerId)?.unread ?? 0;
    const snapshot = adopt(await apiSocialRead(peerId));
    set({ snapshot, error: null });
    if (before > 0) note({ reads: 1 });
  },
  removeMessage: async (peerId, messageId) => {
    const snapshot = adopt(await apiSocialDelete(peerId, messageId));
    set({ snapshot, error: null });
    note({ deletedUnread: true });
  },
  react: async (peerId, messageId, emoji) => {
    const snapshot = adopt(await apiSocialReact(peerId, messageId, emoji));
    set({ snapshot, error: null });
    note({ reactions: 1 });
  },
  deleteThread: async (peerId) => {
    const snapshot = adopt(await apiSocialDeleteThread(peerId));
    const nextPeer = snapshot.threads[0]?.peerId ?? null;
    set({ snapshot, error: null, activePeer: get().activePeer === peerId ? nextPeer : get().activePeer });
  },
  removeFriend: async (userId) => {
    const snapshot = adopt(await apiSocialRemoveFriend(userId));
    set({ snapshot, error: null, incomingBaseline: snapshot.incoming.length });
  },
  blockUser: async (userId) => {
    const me = useAuthStore.getState().user?.id;
    const previous = me ? readLocalBlocked(me) : [];
    if (me) writeLocalBlocked(me, [...previous, userId]);
    try {
      const snapshot = adopt(await apiSocialBlock(userId));
      const nextPeer = snapshot.threads[0]?.peerId ?? null;
      set({
        snapshot,
        error: null,
        incomingBaseline: snapshot.incoming.length,
        activePeer: get().activePeer === userId ? nextPeer : get().activePeer,
      });
    } catch (error) {
      if (me) writeLocalBlocked(me, previous);
      throw error;
    }
  },
  unblockUser: async (userId) => {
    const me = useAuthStore.getState().user?.id;
    if (me) writeLocalBlocked(me, readLocalBlocked(me).filter((id) => id !== userId));
    const snapshot = adopt(await apiSocialUnblock(userId));
    set({ snapshot, error: null, incomingBaseline: snapshot.incoming.length });
  },
  signalTyping: async (peerId, active) => {
    try {
      await apiSocialTyping(peerId, active);
    } catch {
      /* signal éphémère */
    }
  },
}));

function onFocus() {
  void useSocialStore.getState().refresh();
}
