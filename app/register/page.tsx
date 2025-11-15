// app/register/page.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // Если email-конфирм выключен и есть session — сразу в личный кабинет
    if (data.session) {
      router.push("/account");
      return;
    }

    // Если Supabase требует подтверждение email
    setMessage("Проверьте email, чтобы подтвердить регистрацию, затем выполните вход.");
  };

  return (
    <div className="page-container flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md card space-y-6">
        <div className="text-center space-y-1">
          <h1 className="card-title">Регистрация</h1>
          <p className="card-subtitle">
            Создайте аккаунт, чтобы работать с объектами и отделами CYFR FITOUT.
          </p>
        </div>

        <form onSubmit={handleRegister} className="flex flex-col gap-3">
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
              placeholder="Минимум 6 символов"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 mt-1">
              {error}
            </p>
          )}
          {message && (
            <p className="text-xs text-emerald-400 mt-1">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-2 w-full"
          >
            {loading ? "Создаём аккаунт..." : "Зарегистрироваться"}
          </button>
        </form>

        <p className="text-[11px] text-center text-slate-400">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-sky-400 hover:text-sky-300">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}