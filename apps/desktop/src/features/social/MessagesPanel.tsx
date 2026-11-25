import { useEffect, useRef, useState } from "react";
import { MESSAGE_EMOJIS } from "@/shared/lib/social";
import { useAuthStore } from "@/shared/store/authStore";
import { useSocialStore } from "@/shared/store/socialStore";
import { Button } from "@/shared/ui/Button";

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M8 7l1 13h6l1-13" />
    </svg>
  );
}

function TypingBubble() {
  return (
    <div className="text-left" aria-label="En train d'écrire">
      <div className="inline-flex items-center gap-1 rounded-[16px] border border-[var(--border)] px-3 py-2.5">
        <span className="cf-typing-dot h-1.5 w-1.5 rounded-full bg-[var(--text-secondary)]" />
        <span className="cf-typing-dot h-1.5 w-1.5 rounded-full bg-[var(--text-secondary)]" />
        <span className="cf-typing-dot h-1.5 w-1.5 rounded-full bg-[var(--text-secondary)]" />
      </div>
    </div>
  );
}

export function MessagesPanel({ onClose }: { onClose: () => void }) {
  const me = useAuthStore((s) => s.user);
  const snapshot = useSocialStore((s) => s.snapshot);
  const activePeer = useSocialStore((s) => s.activePeer);
  const setActivePeer = useSocialStore((s) => s.setActivePeer);
  const respond = useSocialStore((s) => s.respond);
  const send = useSocialStore((s) => s.send);
  const markRead = useSocialStore((s) => s.markRead);
  const removeMessage = useSocialStore((s) => s.removeMessage);
  const react = useSocialStore((s) => s.react);
  const deleteThread = useSocialStore((s) => s.deleteThread);
  const blockUser = useSocialStore((s) => s.blockUser);
  const signalTyping = useSocialStore((s) => s.signalTyping);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickerId, setPickerId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "delete" | "block" | "report">(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const textRef = useRef(text);
  textRef.current = text;

  const thread = snapshot.threads.find((item) => item.peerId === activePeer) ?? snapshot.threads[0] ?? null;

  useEffect(() => {
    if (thread && thread.peerId !== activePeer) setActivePeer(thread.peerId);
  }, [thread, activePeer, setActivePeer]);

  useEffect(() => {
    if (!thread || thread.unread <= 0) return;
    void markRead(thread.peerId).catch(() => undefined);
  }, [thread?.peerId, thread?.unread]);

  useEffect(() => {
    const peer = thread?.peerId;
    if (!peer) return;
    const beat = window.setInterval(() => {
      void signalTyping(peer, textRef.current.trim().length > 0);
    }, 2500);
    return () => {
      window.clearInterval(beat);
      void signalTyping(peer, false);
    };
  }, [thread?.peerId, signalTyping]);

  useEffect(() => {
    const peer = thread?.peerId;
    if (!peer || !text.trim()) return;
    const kick = window.setTimeout(() => {
      void signalTyping(peer, true);
    }, 350);
    return () => window.clearTimeout(kick);
  }, [thread?.peerId, text, signalTyping]);

  useEffect(() => {
    const el = listRef.current;
    if (!el || !stickRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [thread?.peerId, thread?.messages.length, thread?.peerTyping]);

  const submit = async () => {
    if (!thread) return;
    setBusy(true);
    setError(null);
    try {
      await send(thread.peerId, text);
      setText("");
      stickRef.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runConfirm = async () => {
    if (!thread || !confirm) return;
    if (confirm === "report") {
      setConfirm(null);
      setNotice("Signalement envoyé. Merci.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (confirm === "delete") {
        await deleteThread(thread.peerId);
        setNotice("Discussion supprimée.");
      } else {
        await blockUser(thread.peerId);
        setNotice("Utilisateur bloqué.");
      }
      setConfirm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-layer" onClick={onClose}>
      <div className="modal msg-modal" onClick={(event) => event.stopPropagation()}>
        <div className="flex h-[min(640px,86vh)] flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <h2 className="text-lg font-semibold">Messagerie</h2>
            <Button variant="ghost" onClick={onClose}>Fermer</Button>
          </div>
          <div className="grid min-h-0 flex-1 grid-rows-[9rem_minmax(0,1fr)] md:grid-cols-[16rem_minmax(0,1fr)] md:grid-rows-1">
            <aside className="min-h-0 overflow-y-auto border-b border-[var(--border)] p-3 md:border-b-0 md:border-r">
              <p className="px-1 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">Demandes</p>
              {snapshot.incoming.length === 0 && snapshot.outgoing.length === 0 ? (
                <p className="px-1 py-2 text-sm text-[var(--text-secondary)]">Aucune demande.</p>
              ) : null}
              {snapshot.incoming.map((request) => (
                <div key={request.id} className="mt-2 rounded-[12px] border border-[var(--border)] p-2">
                  <p className="text-sm font-medium">{request.username}</p>
                  <p className="text-xs text-[var(--text-secondary)]">Demande reçue</p>
                  <div className="mt-2 flex gap-2">
                    <Button className="!px-2 !py-1" onClick={() => void respond(request.id, true).catch((e) => setError(String(e)))}>Accepter</Button>
                    <Button variant="ghost" className="!px-2 !py-1" onClick={() => void respond(request.id, false).catch((e) => setError(String(e)))}>Refuser</Button>
                  </div>
                </div>
              ))}
              {snapshot.outgoing.map((request) => (
                <div key={request.id} className="mt-2 rounded-[12px] border border-[var(--border)] px-2 py-2">
                  <p className="text-sm font-medium">{request.username}</p>
                  <p className="text-xs text-[var(--text-secondary)]">Demande envoyée</p>
                </div>
              ))}
              <p className="mt-4 px-1 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">Discussions</p>
              {snapshot.threads.length === 0 ? (
                <p className="px-1 py-2 text-sm text-[var(--text-secondary)]">Ajoutez un ami pour écrire.</p>
              ) : (
                snapshot.threads.map((item) => (
                  <button
                    key={item.peerId}
                    type="button"
                    onClick={() => {
                      setConfirm(null);
                      setActivePeer(item.peerId);
                    }}
                    className={
                      thread?.peerId === item.peerId
                        ? "mt-1 flex w-full items-center justify-between rounded-[12px] bg-[var(--surface-strong)] px-2 py-2 text-left"
                        : "mt-1 flex w-full items-center justify-between rounded-[12px] px-2 py-2 text-left hover:bg-[var(--surface)]"
                    }
                  >
                    <span className="truncate text-sm">{item.username}</span>
                    {item.unread > 0 ? (
                      <span className="ml-2 rounded-full bg-[var(--accent)] px-1.5 text-[10px] text-white">{item.unread}</span>
                    ) : null}
                  </button>
                ))
              )}
            </aside>
            <section className="flex min-h-0 flex-col overflow-hidden">
              {thread ? (
                <>
                  <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium">{thread.username}</p>
                      <div className="flex shrink-0 gap-1">
                        <Button variant="ghost" className="!px-2 !py-1" onClick={() => setConfirm("delete")}>Supprimer</Button>
                        <Button variant="ghost" className="!px-2 !py-1" onClick={() => setConfirm("block")}>Bloquer</Button>
                        <Button variant="ghost" className="!px-2 !py-1" onClick={() => setConfirm("report")}>Signaler</Button>
                      </div>
                    </div>
                    {confirm ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                        <span>
                          {confirm === "delete"
                            ? "Supprimer cette discussion ?"
                            : confirm === "block"
                              ? "Bloquer cet utilisateur ?"
                              : "Signaler cet utilisateur ?"}
                        </span>
                        <Button className="!px-2 !py-1" disabled={busy} onClick={() => void runConfirm()}>Confirmer</Button>
                        <Button variant="ghost" className="!px-2 !py-1" onClick={() => setConfirm(null)}>Annuler</Button>
                      </div>
                    ) : null}
                  </div>
                  <div
                    ref={listRef}
                    className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3"
                    onScroll={() => {
                      const el = listRef.current;
                      if (!el) return;
                      stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
                    }}
                  >
                    {thread.messages.length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)]">Aucun message. Dites bonjour.</p>
                    ) : (
                      thread.messages.map((message) => {
                        const mine = message.from === me?.id;
                        const grouped = new Map<string, number>();
                        for (const emoji of Object.values(message.reactions || {})) {
                          grouped.set(emoji, (grouped.get(emoji) ?? 0) + 1);
                        }
                        const deletable = mine && !message.readAt;
                        const actionsOpen = pickerId === message.id;
                        return (
                          <div key={message.id} className={mine ? "group flex w-full flex-col items-end" : "group flex w-full flex-col items-start"}>
                            <div className={mine ? "relative w-fit min-w-0 max-w-[calc(100%-4.75rem)]" : "relative w-fit min-w-0 max-w-[calc(100%-2.75rem)]"}>
                              <div
                                className={
                                  mine
                                    ? "rounded-[16px] bg-[color-mix(in_srgb,var(--accent)_22%,transparent)] px-3 py-2 text-left"
                                    : "rounded-[16px] border border-[var(--border)] px-3 py-2 text-left"
                                }
                              >
                                <p className="allow-select whitespace-pre-wrap break-words text-sm">{message.text}</p>
                                <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                                  {formatTime(message.at)}
                                  {mine && message.readAt ? " · vu" : ""}
                                </p>
                              </div>
                              <div
                                className={
                                  actionsOpen
                                    ? mine
                                      ? "absolute right-full top-1 z-10 mr-1 flex gap-0.5"
                                      : "absolute left-full top-1 z-10 ml-1 flex gap-0.5"
                                    : mine
                                      ? "pointer-events-none absolute right-full top-1 z-10 mr-1 flex gap-0.5 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
                                      : "pointer-events-none absolute left-full top-1 z-10 ml-1 flex gap-0.5 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
                                }
                              >
                                <button
                                  type="button"
                                  className="flex h-7 w-7 items-center justify-center rounded-full bg-transparent text-sm hover:bg-[var(--surface)]"
                                  aria-label="Réagir"
                                  onClick={() => setPickerId((current) => (current === message.id ? null : message.id))}
                                >
                                  😊
                                </button>
                                {deletable ? (
                                  <button
                                    type="button"
                                    className="flex h-7 w-7 items-center justify-center rounded-full bg-transparent text-[var(--error)] hover:bg-[var(--surface)]"
                                    aria-label="Supprimer le message"
                                    onClick={() =>
                                      void removeMessage(thread.peerId, message.id).catch((e) =>
                                        setError(e instanceof Error ? e.message : String(e)),
                                      )
                                    }
                                  >
                                    <TrashIcon />
                                  </button>
                                ) : null}
                              </div>
                            </div>
                            {pickerId === message.id ? (
                              <div className={mine ? "mt-1 flex flex-wrap justify-end gap-1" : "mt-1 flex flex-wrap gap-1"}>
                                {MESSAGE_EMOJIS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    className="rounded-[8px] bg-transparent px-1 text-base hover:bg-[var(--surface)]"
                                    onClick={() => {
                                      setPickerId(null);
                                      void react(thread.peerId, message.id, emoji);
                                    }}
                                    aria-label={`Réagir ${emoji}`}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                            {grouped.size > 0 ? (
                              <div className={mine ? "mt-1 flex flex-wrap justify-end gap-1" : "mt-1 flex flex-wrap gap-1"}>
                                {[...grouped.entries()].map(([emoji, count]) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    className="rounded-full border border-[var(--border)] bg-transparent px-2 py-0.5 text-xs"
                                    onClick={() => void react(thread.peerId, message.id, emoji)}
                                  >
                                    {emoji} {count}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                    {thread.peerTyping ? <TypingBubble /> : null}
                  </div>
                  <form
                    className="shrink-0 border-t border-[var(--border)] p-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submit();
                    }}
                  >
                    <div className="mb-2 flex flex-wrap gap-1">
                      {MESSAGE_EMOJIS.map((emoji) => (
                        <button key={emoji} type="button" className="rounded-[8px] bg-transparent px-1.5 py-0.5 text-lg hover:bg-[var(--surface)]" onClick={() => setText((value) => value + emoji)}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={text}
                        maxLength={280}
                        onChange={(event) => setText(event.target.value)}
                        placeholder="Message"
                        className="allow-select min-w-0 flex-1 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                      />
                      <Button type="submit" disabled={busy || !text.trim()}>Envoyer</Button>
                    </div>
                    {error ? <p className="mt-2 text-sm text-[var(--error)]">{error}</p> : null}
                    {notice ? <p className="mt-2 text-sm text-[var(--success)]">{notice}</p> : null}
                  </form>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center p-6 text-sm text-[var(--text-secondary)]">
                  Les messages sont réservés aux amis.
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
