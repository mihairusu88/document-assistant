import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/layout/appSidebar";
import { ConversationService } from "@/services/ConversationService";
import type { UserDTO } from "@/types/entities";

/**
 * Authenticated application shell. Server Component:
 *  - guards the route (redirect to /sign-in if unauthenticated)
 *  - loads the user's conversations for the sidebar
 *  - renders the sidebar + chat area
 */
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authUser = await getCurrentUser();
  if (!authUser) redirect("/sign-in");

  const metadata = authUser.user_metadata ?? {};
  const user: UserDTO = {
    id: authUser.id,
    email: authUser.email ?? "",
    displayName:
      (metadata.display_name as string | undefined) ??
      (metadata.full_name as string | undefined) ??
      null,
    avatarUrl: (metadata.avatar_url as string | undefined) ?? null,
    createdAt: authUser.created_at ?? new Date().toISOString(),
  };

  // Best-effort: an empty list (e.g. before the schema migration is applied)
  // shouldn't break the shell.
  const conversations = await new ConversationService().list().catch(() => []);

  return (
    <div className="flex h-svh overflow-hidden">
      <AppSidebar user={user} conversations={conversations} />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
