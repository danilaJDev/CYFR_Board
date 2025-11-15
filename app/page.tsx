import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";

export default async function Home() {
  // Пробуем получить текущую сессию (пока её нет, вернётся null)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">CYFR Board</h1>
      <p className="mt-4">
        Supabase session: {session ? "есть" : "нет"}.
      </p>
    </main>
  );
}