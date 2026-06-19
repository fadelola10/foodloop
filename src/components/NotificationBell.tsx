import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

export function NotificationBell({ userId }: { userId: string | null }) {
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  async function load() {
    if (!userId) return;
    const { data } = await (supabase.from as any)("notifications")
      .select("id,type,title,body,link,read_at,created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data ?? []) as Notif[]);
  }

  useEffect(() => {
    if (!userId) return;
    load();
    const channel = supabase
      .channel(`notif-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as Notif;
          setItems((arr) => [n, ...arr].slice(0, 30));
          toast(n.title, { description: n.body ?? undefined });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const unread = items.filter((i) => !i.read_at).length;

  async function markRead(id: string) {
    await (supabase.from as any)("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    setItems((arr) => arr.map((i) => (i.id === id ? { ...i, read_at: new Date().toISOString() } : i)));
  }

  async function markAll() {
    if (!userId) return;
    const now = new Date().toISOString();
    await (supabase.from as any)("notifications").update({ read_at: now }).is("read_at", null).eq("user_id", userId);
    setItems((arr) => arr.map((i) => (i.read_at ? i : { ...i, read_at: now })));
  }

  async function remove(id: string) {
    await (supabase.from as any)("notifications").delete().eq("id", id);
    setItems((arr) => arr.filter((i) => i.id !== id));
  }

  if (!userId) return null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center rounded-lg border border-border bg-card p-2 hover:bg-muted"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-citrus px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="font-display text-sm font-bold">Notifications</span>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="inline-flex items-center gap-1 text-xs font-semibold text-citrus hover:underline"
              >
                <CheckCheck className="size-3" /> Tout lire
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {items.length === 0 ? (
              <li className="p-6 text-center text-sm text-muted-foreground">Aucune notification</li>
            ) : (
              items.map((n) => {
                const inner = (
                  <div className={`flex gap-2 p-3 ${n.read_at ? "" : "bg-citrus/5"}`}>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{n.title}</p>
                      {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      {!n.read_at && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            markRead(n.id);
                          }}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Marquer comme lu"
                        >
                          <Check className="size-3" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          remove(n.id);
                        }}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        to={n.link as any}
                        onClick={() => {
                          if (!n.read_at) markRead(n.id);
                          setOpen(false);
                        }}
                        className="block hover:bg-muted/50"
                      >
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
