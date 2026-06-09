"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus, MessageSquare, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/utils/cn";
import { apiFetch } from "@/utils/apiClient";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdownMenu";
import type { ConversationDTO } from "@/types/entities";

export function ConversationSidebar({
  conversations,
}: Readonly<{
  conversations: ConversationDTO[];
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Go to the empty composer; the conversation is created (with a real title)
  // when the first message is sent.
  function handleNewChat() {
    startTransition(() => {
      router.push("/chat");
      router.refresh();
    });
  }

  async function handleDelete(id: string, href: string) {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await apiFetch(`/api/conversations/${id}`, { method: "DELETE" });
      toast.success("Conversation deleted.");
      // If we're viewing the deleted thread, leave it before refreshing.
      if (pathname === href) router.push("/chat");
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete conversation.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <Button variant="outline" className="justify-start" onClick={handleNewChat}>
        <Plus />
        New chat
      </Button>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <nav className="flex flex-col gap-0.5 pr-1">
          {conversations.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">
              No conversations yet.
            </p>
          ) : (
            conversations.map((c) => {
              const href = `/chat/${c.id}`;
              const active = pathname === href;
              return (
                <div
                  key={c.id}
                  className={cn(
                    "group flex w-full min-w-0 items-center gap-1 rounded-md pr-1 transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                    deletingId === c.id && "opacity-50",
                  )}
                >
                  <Link
                    href={href}
                    className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-2 text-sm"
                  >
                    <MessageSquare className="size-4 shrink-0" />
                    <span className="truncate">{c.title}</span>
                  </Link>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Conversation options"
                        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none data-[state=open]:bg-sidebar-accent data-[state=open]:text-foreground"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        disabled={deletingId === c.id}
                        onSelect={() => void handleDelete(c.id, href)}
                      >
                        <Trash2 /> Delete chat
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })
          )}
        </nav>
      </div>
    </div>
  );
}
