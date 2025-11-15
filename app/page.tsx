// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ProfileRow = {
  first_name: string | null;
  second_name: string | null;
  phone: string | null;
};

export default function HomePage() {
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setChecking(false);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("first_name, second_name, phone")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError && profileError.code !== "PGRST116") {
        console.error(profileError);
      }

      const profile = profileData as ProfileRow | null;

      const needProfile =
        !profile ||
        !profile.first_name ||
        !profile.second_name ||
        !profile.phone;

      if (needProfile) {
        router.push("/account");
      } else {
        router.push("/workspaces");
      }
    };

    checkUser();
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-400">Загрузка приложения...</p>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 text-center p-4">
      <div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-50">
          CYFR Board
        </h1>
        <p className="mt-4 max-w-md text-sm md:text-base text-slate-400">
          Войдите или зарегистрируйтесь, чтобы работать с объектами,
          отделами и задачами CYFR FITOUT L.L.C.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Link href="/login" className="btn-primary">
          Войти
        </Link>
        <Link href="/register" className="btn-outline">
          Регистрация
        </Link>
      </div>
    </main>
  );
}
