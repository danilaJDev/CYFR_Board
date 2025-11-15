"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function HomePage() {
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        router.push("/workspaces");
      } else {
        setChecking(false);
      }
    };

    checkUser();
  }, [router]);

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Загрузка...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
      <h1 className="text-3xl font-semibold">CYFR Board</h1>
      <p className="text-gray-600 text-sm">
        Войдите или зарегистрируйтесь, чтобы работать с объектами и задачами.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="px-4 py-2 rounded bg-blue-600 text-white text-sm"
        >
          Войти
        </Link>
        <Link
          href="/register"
          className="px-4 py-2 rounded border text-sm"
        >
          Регистрация
        </Link>
      </div>
    </main>
  );
}