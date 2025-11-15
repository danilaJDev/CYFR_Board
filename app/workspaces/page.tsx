// app/workspaces/page.tsx
"use client";

import { AppShell } from "@/components/app-shell";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Workspace = {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    role: string | null;
};

export default function WorkspacesPage() {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // 1. Проверяем пользователя
    useEffect(() => {
        const fetchUser = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.push("/login");
                return;
            }

            setUserId(user.id);
            setLoadingUser(false);
        };

        fetchUser();
    }, [router]);

    // 2. Подгружаем рабочие пространства, где пользователь состоит
    useEffect(() => {
        if (!userId) return;

        const fetchWorkspaces = async () => {
            setLoadingWorkspaces(true);
            setError(null);

            const { data, error } = await supabase
                .from("workspace_members")
                .select(
                    "role, workspace:workspaces(id, name, description, created_at)"
                )
                .eq("user_id", userId);

            if (error) {
                console.error(error);
                setError(error.message);
                setLoadingWorkspaces(false);
                return;
            }

            const list: Workspace[] =
                (data as any[])
                    ?.map((row) => ({
                        id: row.workspace?.id,
                        name: row.workspace?.name,
                        description: row.workspace?.description,
                        created_at: row.workspace?.created_at,
                        role: row.role ?? null,
                    }))
                    ?.filter((w) => w.id && w.name) ?? [];

            // Убираем дубликаты по id
            const uniqueById = Object.values(
                list.reduce<Record<string, Workspace>>((acc, ws) => {
                    acc[ws.id] = ws;
                    return acc;
                }, {})
            );

            setWorkspaces(uniqueById);
            setLoadingWorkspaces(false);
        };

        fetchWorkspaces();
    }, [userId]);

    const handleCreateWorkspace = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId) return;

        setCreating(true);
        setError(null);

        const { data: wsData, error: wsError } = await supabase
            .from("workspaces")
            .insert({
                name,
                description: description || null,
                created_by: userId,
            })
            .select("id, name, description, created_at")
            .single();

        if (wsError || !wsData) {
            setCreating(false);
            setError(wsError?.message || "Не удалось создать workspace");
            return;
        }

        const { error: memberError } = await supabase
            .from("workspace_members")
            .insert({
                workspace_id: wsData.id,
                user_id: userId,
                role: "owner",
            });

        if (memberError) {
            console.error(memberError);
            setError(
                "Workspace создан, но не получилось сохранить членство (owner)."
            );
        }

        // Добавляем в список как owner
        setWorkspaces((prev) => [
            ...prev,
            {
                id: wsData.id,
                name: wsData.name,
                description: wsData.description,
                created_at: wsData.created_at,
                role: "owner",
            },
        ]);

        setName("");
        setDescription("");
        setCreating(false);
    };

    const handleDeleteWorkspace = async (workspace: Workspace) => {
        if (workspace.role !== "owner") return;

        const confirmed = window.confirm(
            `Удалить пространство «${workspace.name}»? Все связанные данные могут быть потеряны.`
        );
        if (!confirmed) return;

        setDeletingId(workspace.id);

        const { error } = await supabase
            .from("workspaces")
            .delete()
            .eq("id", workspace.id);

        setDeletingId(null);

        if (error) {
            console.error(error);
            setError(
                "Не удалось удалить пространство. Возможно, есть связанные данные или нет прав.\n\n" +
                error.message
            );
            return;
        }

        setWorkspaces((prev) =>
            prev.filter((ws) => ws.id !== workspace.id)
        );
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    if (loadingUser) {
        return (
            <AppShell>
                <div className="flex min-h-[50vh] items-center justify-center">
                    <p className="text-sm text-slate-400">Загрузка данных пользователя...</p>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <div className="space-y-8">
                {/* Заголовок + кнопка выхода */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-50">Рабочие пространства</h1>
                        <p className="mt-1.5 text-sm text-slate-400">
                            Объединяйте объекты, отделы и задачи в удобные рабочие области.
                        </p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="btn-outline btn-sm self-start md:self-auto"
                    >
                        Выйти
                    </button>
                </div>

                {/* Форма создания workspace */}
                <div className="card space-y-4">
                    <h2 className="card-title">Создать новое пространство</h2>
                    <form
                        onSubmit={handleCreateWorkspace}
                        className="flex flex-col gap-4"
                    >
                        <input
                            type="text"
                            placeholder="Название (например: Объекты CYFR, Отдел продаж)"
                            className="input"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />

                        <textarea
                            placeholder="Описание (какие объекты/отделы будут внутри)"
                            className="textarea"
                            rows={3}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />

                        {error && (
                            <p className="text-xs text-red-400 whitespace-pre-line">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={creating}
                            className="btn-primary self-start"
                        >
                            {creating ? "Создаём..." : "Создать пространство"}
                        </button>
                    </form>
                </div>

                {/* Список workspaces */}
                <div className="space-y-4">
                    <h2 className="card-title">Мои пространства</h2>

                    {loadingWorkspaces ? (
                        <p className="text-sm text-slate-400">Загружаем список...</p>
                    ) : workspaces.length === 0 ? (
                        <div className="card text-center py-8">
                            <p className="text-sm text-slate-400">
                                Пока нет ни одного пространства. Создайте первое выше.
                            </p>
                        </div>
                    ) : (
                        <ul className="grid gap-4 md:grid-cols-2">
                            {workspaces.map((ws) => (
                                <li
                                    key={ws.id}
                                    className="card cursor-pointer hover:border-sky-500/60 hover:bg-slate-700/60 transition"
                                    onClick={() => router.push(`/workspaces/${ws.id}`)}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-slate-100">
                                                {ws.name}
                                            </h3>
                                            {ws.description && (
                                                <p className="mt-1 text-xs text-slate-400">
                                                    {ws.description}
                                                </p>
                                            )}
                                            <span className="mt-2 block text-[11px] text-slate-500">
                                                {new Date(
                                                    ws.created_at
                                                ).toLocaleDateString()}
                                            </span>
                                        </div>
                                        {ws.role === "owner" && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteWorkspace(ws);
                                                }}
                                                className="text-xs text-slate-500 hover:text-red-400 px-1 py-0.5"
                                                title="Удалить пространство"
                                            >
                                                {deletingId === ws.id
                                                    ? "..."
                                                    : "Удалить"}
                                            </button>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </AppShell>
    );
}
