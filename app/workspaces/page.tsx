"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Workspace = {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
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

    // 2. Подгружаем рабочие пространства
    useEffect(() => {
        if (!userId) return;

        const fetchWorkspaces = async () => {
            setLoadingWorkspaces(true);
            setError(null);

            // Берём workspaces, к которым у пользователя есть доступ через RLS
            const { data, error } = await supabase
                .from("workspaces")
                .select("id, name, description, created_at")
                .order("created_at", { ascending: true });

            if (error) {
                console.error(error);
                setError(error.message);
            } else {
                setWorkspaces((data ?? []) as Workspace[]);
            }

            setLoadingWorkspaces(false);
        };

        fetchWorkspaces();
    }, [userId]);

    const handleCreateWorkspace = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId) return;

        setCreating(true);
        setError(null);

        // 1. создаём workspace
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

        // 2. добавляем самого себя как owner в workspace_members
        const { error: memberError } = await supabase
            .from("workspace_members")
            .insert({
                workspace_id: wsData.id,
                user_id: userId,
                role: "owner",
            });

        if (memberError) {
            console.error(memberError);
            setError("Workspace создан, но не получилось сохранить членство (owner).");
            // всё равно покажем workspace в списке, т.к. RLS уже пропустит
        }

        // обновляем список
        setWorkspaces((prev) => [...prev, wsData as Workspace]);
        setName("");
        setDescription("");
        setCreating(false);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    if (loadingUser) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <p>Загрузка...</p>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50">
            <header className="flex justify-between items-center px-6 py-4 border-b bg-white">
                <h1 className="text-xl font-semibold">Рабочие пространства</h1>
                <button
                    onClick={handleLogout}
                    className="text-xs px-3 py-1 border rounded"
                >
                    Выйти
                </button>
            </header>

            <div className="max-w-4xl mx-auto p-6 space-y-8">
                {/* Форма создания workspace */}
                <section className="bg-white rounded-lg shadow p-4 space-y-4">
                    <h2 className="text-lg font-medium">Создать новое пространство</h2>
                    <form onSubmit={handleCreateWorkspace} className="space-y-3">
                        <input
                            type="text"
                            placeholder="Название (например: Объекты CYFR, Отдел продаж)"
                            className="w-full border rounded px-3 py-2 text-sm"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />

                        <textarea
                            placeholder="Описание (необязательно: какие объекты/отделы будут внутри)"
                            className="w-full border rounded px-3 py-2 text-sm"
                            rows={3}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />

                        {error && <p className="text-sm text-red-500">{error}</p>}

                        <button
                            type="submit"
                            disabled={creating}
                            className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-60"
                        >
                            {creating ? "Создаём..." : "Создать пространство"}
                        </button>
                    </form>
                </section>

                {/* Список workspaces */}
                <section className="space-y-3">
                    <h2 className="text-lg font-medium">Мои пространства</h2>

                    {loadingWorkspaces ? (
                        <p className="text-sm text-gray-500">Загружаем...</p>
                    ) : workspaces.length === 0 ? (
                        <p className="text-sm text-gray-500">
                            Пока нет ни одного пространства. Создайте первое выше.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {workspaces.map((ws) => (
                                <li
                                    key={ws.id}
                                    className="bg-white rounded-lg shadow px-4 py-3 cursor-pointer hover:bg-gray-50"
                                    onClick={() => router.push(`/workspaces/${ws.id}`)}
                                >
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-medium text-sm">{ws.name}</h3>
                                        <span className="text-xs text-gray-400">
                                            {new Date(ws.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    {ws.description && (
                                        <p className="text-xs text-gray-600 mt-1">
                                            {ws.description}
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </main>
    );
}