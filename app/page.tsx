import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const configured = (env as unknown as { SITE_AUTH_SESSION?: string }).SITE_AUTH_SESSION;
  const session = (await cookies()).get("shancheng_session")?.value;
  if (!configured || session !== configured) redirect("/login");
  return <HomeClient />;
}
