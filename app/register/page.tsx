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
    } else {
      // зависит от настроек Supabase: может требоваться подтверждение email
      if (data.user && !data.session) {
        setMessage("Проверьте email, чтобы подтвердить регистрацию.");
      } else {
        router.push("/workspaces");
      }
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-6 space-y-6">
        <h1 className="text-2xl font-semibold text-center">Регистрация</h1>

        <form onSubmit={handleRegister} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            className="border rounded px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Пароль (мин. 6 символов)"
            className="border rounded px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />

          {error && <p className="text-red-500 text-sm">{error}</p>}
          {message && <p className="text-green-600 text-sm">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 py-2 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-60"
          >
            {loading ? "Создаём аккаунт..." : "Зарегистрироваться"}
          </button>
        </form>

        <p className="text-xs text-center text-gray-500">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </main>
  );
}