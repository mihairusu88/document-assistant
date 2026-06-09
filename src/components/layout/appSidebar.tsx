"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ConversationSidebar } from "@/views/chat/components/conversationSidebar";
import { UserMenu } from "./userMenu";
import type { ConversationDTO, UserDTO } from "@/types/entities";

export function AppSidebar({
  user,
  conversations,
}: {
  user: UserDTO;
  conversations: ConversationDTO[];
}) {
  return (
    <aside className="flex h-svh w-64 shrink-0 flex-col gap-3 border-r bg-sidebar p-3 text-sidebar-foreground">
      <Link href="/chat" className="flex items-center gap-2 px-2 py-1 font-semibold">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </span>
        Document Assistant
      </Link>

      <Separator />

      <ConversationSidebar conversations={conversations} />

      <Separator />

      <UserMenu user={user} />
    </aside>
  );
}
