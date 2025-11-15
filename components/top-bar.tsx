"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export function TopBar() {
    const router = useRouter();

    const handleAccount = () => {
        router.push("/account");
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    return (
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
            {/* Левая часть: логотип + название */}
            <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500 text-xs font-bold text-slate-950">
                    CY
                </span>
                <div className="flex flex-col">
                    <span className="text-sm font-semibold tracking-tight">
                        CYFR Board
                    </span>
                    <span className="text-[11px] text-slate-400">
                        Internal tasks &amp; objects tracker
                    </span>
                </div>
            </div>

            {/* Правая часть: ЛК + выход */}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={handleAccount}
                    className="btn-outline btn-sm"
                >
                    Личный кабинет
                </button>
                <button
                    type="button"
                    onClick={handleLogout}
                    className="btn-primary btn-sm"
                >
                    Выйти
                </button>
            </div>
        </header>
    );
}