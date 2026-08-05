import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Único ponto de verificação de sessão (sem proxy/middleware, seguindo a
// recomendação do próprio Next.js): já logado não deve ver a tela de login.
export default async function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/");

  return children;
}
