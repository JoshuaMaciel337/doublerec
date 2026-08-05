import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Camada real de proteção: mesmo que o proxy seja contornado,
// nenhuma página do estúdio renderiza sem sessão válida.
export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return children;
}
