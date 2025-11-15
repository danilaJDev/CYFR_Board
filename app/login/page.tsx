// app/login/page.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ProfileRow = {
  first_name: string | null;
  second_name: string | null;
  phone: string | null;
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    // Успешный логин → проверяем профиль
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      router.push("/login");
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("first_name, second_name, phone")
      .eq("id", user.id)
      .maybeSingle();

    let needProfile = false;

    if (profileError && profileError.code !== "PGRST116") {
      console.error(profileError);
    }

    const profile = profileData as ProfileRow | null;

    if (
      !profile ||
      !profile.first_name ||
      !profile.second_name ||
      !profile.phone
    ) {
      needProfile = true;
    }

    setLoading(false);

    if (needProfile) {
      router.push("/account");
    } else {
      router.push("/workspaces");
    }
  };

  return (
    <div className="page-container flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md card space-y-6">
        <div className="text-center space-y-1">
          <h1 className="card-title">Вход в CYFR Board</h1>
          <p className="card-subtitle">
            Управляйте объектами и задачами CYFR FITOUT L.L.C.
          </p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-300">
              Email
            </label>
            <input
              type="email"
              placeholder="you@company.com"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-300">
              Пароль
            </label>
            <input
              type="password"
              placeholder="Введите пароль"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 mt-1">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-2 w-full"
          >
            {loading ? "Вход..." : "Войти"}
          </button>
        </form>

        <p className="text-[11px] text-center text-slate-400">
          Нет аккаунта?{" "}
          <Link href="/register" className="text-sky-400 hover:text-sky-300">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}