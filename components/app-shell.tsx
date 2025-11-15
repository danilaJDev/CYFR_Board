"use client";

import { ReactNode, useEffect, useState } from "react";
import { TopBar } from "./top-bar";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";

type SidebarWorkspace = {
    id: string;
    name: string;
    role: string | null;
};

export function AppShell({ children }: { children: ReactNode }) {
    const [workspaces, setWorkspaces] = useState<SidebarWorkspace[]>([]);
    const [loadingWs, setLoadingWs] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const loadWorkspaces = async () => {
            setLoadingWs(true);

            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                setWorkspaces([]);
                setLoadingWs(false);
                return;
            }

            // Берём все пространства, где пользователь состоит в workspace_members
            const { data, error } = await supabase
                .from("workspace_members")
                .select("role, workspace:workspaces(id, name)")
                .eq("user_id", user.id);

            if (error) {
                console.error("Error loading sidebar workspaces:", error);
                setWorkspaces([]);
                setLoadingWs(false);
                return;
            }

            const list: SidebarWorkspace[] =
                (data as any[])
                    ?.map((row) => ({
                        id: row.workspace?.id,
                        name: row.workspace?.name,
                        role: row.role ?? null,
                    }))
                    ?.filter((w) => w.id && w.name) ?? [];

            // Убираем дубликаты по id
            const uniqueById = Object.values(
                list.reduce<Record<string, SidebarWorkspace>>((acc, ws) => {
                    acc[ws.id] = ws;
                    return acc;
                }, {})
            );

            setWorkspaces(uniqueById);
            setLoadingWs(false);
        };

        loadWorkspaces();
    }, []);

    const handleDeleteWorkspace = async (workspaceId: string, name: string) => {
        const confirmed = window.confirm(
            `Удалить пространство «${name}»? Все связанные данные могут быть потеряны.`
        );
        if (!confirmed) return;

        const { error } = await supabase
            .from("workspaces")
            .delete()
            .eq("id", workspaceId);

        if (error) {
            console.error("Error deleting workspace:", error);
            alert(
                "Не удалось удалить пространство. Возможно, есть связанные данные или нет прав.\n\n" +
                error.message
            );
            return;
        }

        // Обновляем список в сайдбаре
        setWorkspaces((prev) => prev.filter((ws) => ws.id !== workspaceId));

        // На всякий случай возвращаем на список пространств
        router.push("/workspaces");
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50">
            <TopBar />

            <div className="flex min-h-[calc(100vh-56px)]">
                {/* ЛЕВАЯ ПАНЕЛЬ: ПРОСТРАНСТВА */}
                <aside className="hidden md:block w-64 border-r border-slate-800 bg-slate-950/80">
                    <nav className="flex flex-col gap-2 p-4 text-sm">
                        <span className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                            Пространства
                        </span>

                        {/* Ссылка "Все пространства" */}
                        <Link
                            href="/workspaces"
                            className="rounded-lg px-2 py-1 text-slate-200 hover:bg-slate-800 hover:text-sky-300 transition"
                        >
                            Все пространства
                        </Link>

                        {/* Список пространств пользователя */}
                        {loadingWs ? (
                            <span className="text-[11px] text-slate-500 mt-1">
                                Загрузка списков...
                            </span>
                        ) : workspaces.length === 0 ? (
                            <span className="text-[11px] text-slate-500 mt-1">
                                Пока нет доступных пространств.
                            </span>
                        ) : (
                            <div className="mt-1 flex flex-col gap-1">
                                {workspaces.map((ws) => (
                                    <div
                                        key={ws.id}
                                        className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-slate-800 transition group"
                                    >
                                        <Link
                                            href={`/workspaces/${ws.id}`}
                                            className="flex-1 truncate text-slate-200 group-hover:text-sky-300 text-xs"
                                            title={ws.name}
                                        >
                                            {ws.name}
                                        </Link>
                                        {ws.role === "owner" && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleDeleteWorkspace(ws.id, ws.name)
                                                }
                                                className="text-[12px] text-slate-500 hover:text-red-400 px-1"
                                                title="Удалить пространство"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </nav>
                </aside>

                {/* ОСНОВНОЙ КОНТЕНТ */}
                <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
                    {children}
                </main>
            </div>
        </div>
    );
}