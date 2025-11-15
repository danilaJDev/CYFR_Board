"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";

type Profile = {
    first_name: string | null;
    second_name: string | null;
    phone: string | null;
};

export default function AccountPage() {
    const router = useRouter();

    const [loadingUser, setLoadingUser] = useState(true);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [saving, setSaving] = useState(false);

    const [email, setEmail] = useState<string | null>(null);
    const [firstName, setFirstName] = useState("");
    const [secondName, setSecondName] = useState("");
    const [phone, setPhone] = useState("");

    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        const loadUserAndProfile = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.push("/login");
                return;
            }

            setEmail(user.email ?? null);
            setLoadingUser(false);

            setLoadingProfile(true);
            setError(null);

            const { data, error } = await supabase
                .from("profiles")
                .select("first_name, second_name, phone")
                .eq("id", user.id)
                .single();

            if (error && error.code !== "PGRST116") {
                console.error(error);
                setError(error.message);
            }

            if (data) {
                const profile = data as Profile;
                setFirstName(profile.first_name ?? "");
                setSecondName(profile.second_name ?? "");
                setPhone(profile.phone ?? "");
            }

            setLoadingProfile(false);
        };

        loadUserAndProfile();
    }, [router]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setSaving(true);

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            setSaving(false);
            router.push("/login");
            return;
        }

        // === ВАЛИДАЦИЯ ТЕЛЕФОНА ===
        const trimmedPhone = phone.trim();

        if (!trimmedPhone) {
            setError("Пожалуйста, укажите номер телефона.");
            setSaving(false);
            return;
        }

        // Разрешаем формат типа: +971 50 000 00 00, +375291234567 и т.п.
        const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
        if (!phoneRegex.test(trimmedPhone)) {
            setError(
                "Введите корректный номер телефона (например, +971 50 000 00 00)."
            );
            setSaving(false);
            return;
        }

        const payload = {
            id: user.id,
            first_name: firstName || null,
            second_name: secondName || null,
            phone: trimmedPhone,
        };

        const { error } = await supabase
            .from("profiles")
            .upsert(payload, { onConflict: "id" });

        if (error) {
            console.error(error);
            setError(error.message);
        } else {
            setSuccess("Данные успешно сохранены.");
        }

        setSaving(false);
    };

    if (loadingUser || loadingProfile) {
        return (
            <AppShell>
                <div className="page-inner flex min-h-[50vh] items-center justify-center">
                    <p className="text-sm text-slate-300">Загружаем профиль...</p>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <div className="page-inner max-w-xl space-y-6">
                <div>
                    <h1 className="text-xl font-semibold">Личный кабинет</h1>
                    <p className="mt-1 text-sm text-slate-400">
                        Здесь вы можете изменить информацию о себе. Email менять нельзя.
                    </p>
                </div>

                <section className="card space-y-4">
                    <h2 className="card-title">Персональные данные</h2>

                    <form onSubmit={handleSave} className="flex flex-col gap-3">
                        {/* Email только для чтения */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-slate-300">
                                Email (логин)
                            </label>
                            <input
                                type="email"
                                value={email ?? ""}
                                disabled
                                className="input opacity-70 cursor-not-allowed"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-slate-300">
                                Фамилия
                            </label>
                            <input
                                type="text"
                                placeholder="Фамилия"
                                className="input"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-slate-300">
                                Имя
                            </label>
                            <input
                                type="text"
                                placeholder="Имя"
                                className="input"
                                value={secondName}
                                onChange={(e) => setSecondName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-slate-300">
                                Номер телефона
                            </label>
                            <input
                                type="tel"
                                placeholder="+971 50 000 00 00"
                                className="input"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                required
                            />
                        </div>

                        {error && (
                            <p className="text-xs text-red-400">
                                {error}
                            </p>
                        )}

                        {success && (
                            <p className="text-xs text-emerald-400">
                                {success}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={saving}
                            className="btn-primary w-full md:w-auto"
                        >
                            {saving ? "Сохраняем..." : "Сохранить"}
                        </button>
                    </form>
                </section>
            </div>
        </AppShell>
    );
}