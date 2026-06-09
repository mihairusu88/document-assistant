import { redirect } from "next/navigation";

/**
 * Root entry. The middleware decides access: authenticated users reach /chat,
 * everyone else is redirected to /sign-in.
 */
export default function Home() {
  redirect("/chat");
}
