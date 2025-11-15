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
        <div className="min-h-screen bg-slate-900 text-slate-200">
            <TopBar />

            <div className="flex min-h-[calc(100vh-56px)]">
                {/* ЛЕВАЯ ПАНЕЛЬ: ПРОСТРАНСТВА */}
                <aside className="hidden md:block w-64 border-r border-slate-800 bg-slate-900/60">
                    <nav className="flex flex-col gap-2 p-4 text-sm">
                        <span className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                            Пространства
                        </span>

                        {/* Ссылка "Все пространства" */}
                        <Link
                            href="/workspaces"
                            className="rounded-md px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-sky-400 transition font-medium"
                        >
                            Все пространства
                        </Link>

                        {/* Список пространств пользователя */}
                        {loadingWs ? (
                            <span className="text-xs text-slate-500 mt-2 px-3">
                                Загрузка...
                            </span>
                        ) : workspaces.length === 0 ? (
                            <span className="text-xs text-slate-500 mt-2 px-3">
                                Нет доступных пространств.
                            </span>
                        ) : (
                            <div className="mt-2 flex flex-col gap-1 border-t border-slate-800 pt-3">
                                {workspaces.map((ws) => (
                                    <div
                                        key={ws.id}
                                        className="flex items-center gap-2 rounded-md px-3 py-1.5 hover:bg-slate-800 transition group"
                                    >
                                        <Link
                                            href={`/workspaces/${ws.id}`}
                                            className="flex-1 truncate text-slate-300 group-hover:text-sky-400 text-sm"
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
                                                className="text-sm text-slate-500 hover:text-red-400 opacity-50 group-hover:opacity-100"
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
                <main className="flex-1">
                    <div className="page-inner">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
