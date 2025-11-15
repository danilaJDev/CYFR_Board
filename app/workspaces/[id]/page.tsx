"use client";

import { AppShell } from "@/components/app-shell";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Workspace = {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
};

type Project = {
    id: string;
    name: string;
    code: string | null;
    description: string | null;
    address: string | null;
    status: string | null;
    created_at: string;
};

export default function WorkspaceDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const workspaceId = params.id as string;

    const [userChecked, setUserChecked] = useState(false);

    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loadingWorkspace, setLoadingWorkspace] = useState(true);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Для формы создания проекта
    const [projectName, setProjectName] = useState("");
    const [projectCode, setProjectCode] = useState("");
    const [projectAddress, setProjectAddress] = useState("");
    const [projectDescription, setProjectDescription] = useState("");
    const [creatingProject, setCreatingProject] = useState(false);

    // 1. Проверка пользователя
    useEffect(() => {
        const checkUser = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.push("/login");
                return;
            }

            setUserChecked(true);
        };

        checkUser();
    }, [router]);

    // 2. Загрузка workspace
    useEffect(() => {
        if (!userChecked) return;

        const fetchWorkspace = async () => {
            setLoadingWorkspace(true);
            setError(null);

            const { data, error } = await supabase
                .from("workspaces")
                .select("id, name, description, created_at")
                .eq("id", workspaceId)
                .single();

            if (error) {
                console.error(error);
                setError(
                    error.code === "PGRST116"
                        ? "Рабочее пространство не найдено или нет доступа."
                        : error.message
                );
                setWorkspace(null);
            } else {
                setWorkspace(data as Workspace);
            }

            setLoadingWorkspace(false);
        };

        fetchWorkspace();
    }, [userChecked, workspaceId]);

    // 3. Загрузка projects этого workspace
    useEffect(() => {
        if (!userChecked) return;

        const fetchProjects = async () => {
            setLoadingProjects(true);
            setError(null);

            const { data, error } = await supabase
                .from("projects")
                .select(
                    "id, name, code, description, address, status, created_at"
                )
                .eq("workspace_id", workspaceId)
                .order("created_at", { ascending: true });

            if (error) {
                console.error(error);
                setError(error.message);
            } else {
                setProjects((data ?? []) as Project[]);
            }

            setLoadingProjects(false);
        };

        fetchProjects();
    }, [userChecked, workspaceId]);

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!workspaceId) return;

        setCreatingProject(true);
        setError(null);

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            setCreatingProject(false);
            router.push("/login");
            return;
        }

        const { data, error } = await supabase
            .from("projects")
            .insert({
                workspace_id: workspaceId,
                name: projectName,
                code: projectCode || null,
                address: projectAddress || null,
                description: projectDescription || null,
                created_by: user.id,
            })
            .select("id, name, code, description, address, status, created_at")
            .single();

        if (error) {
            console.error(error);
            setError(error.message);
            setCreatingProject(false);
            return;
        }

        setProjects((prev) => [...prev, data as Project]);
        setProjectName("");
        setProjectCode("");
        setProjectAddress("");
        setProjectDescription("");
        setCreatingProject(false);
    };

    const handleBack = () => {
        router.push("/workspaces");
    };

    if (!userChecked) {
        return (
            <AppShell>
                <div className="page-inner flex min-h-[50vh] items-center justify-center">
                    <p className="text-sm text-slate-300">Проверяем доступ...</p>
                </div>
            </AppShell>
        );
    }

    if (loadingWorkspace) {
        return (
            <AppShell>
                <div className="page-inner flex min-h-[50vh] items-center justify-center">
                    <p className="text-sm text-slate-300">
                        Загружаем пространство...
                    </p>
                </div>
            </AppShell>
        );
    }

    if (!workspace) {
        return (
            <AppShell>
                <div className="page-inner flex min-h-[50vh] flex-col items-center justify-center gap-4">
                    <p className="text-sm text-red-400">
                        {error || "Рабочее пространство не найдено."}
                    </p>
                    <button
                        onClick={handleBack}
                        className="btn-outline btn-sm"
                    >
                        Назад к списку пространств
                    </button>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <div className="page-inner space-y-8">
                {/* Верхний блок: название workspace + кнопка назад */}
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                        <button
                            onClick={handleBack}
                            className="btn-outline btn-sm mt-0.5"
                        >
                            Назад
                        </button>
                        <div>
                            <h1 className="text-xl font-semibold">{workspace.name}</h1>
                            {workspace.description && (
                                <p className="mt-1 text-sm text-slate-400">
                                    {workspace.description}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Форма создания объекта/проекта */}
                <section className="card space-y-4">
                    <h2 className="card-title">Добавить объект / проект</h2>
                    <form
                        onSubmit={handleCreateProject}
                        className="grid gap-3 md:grid-cols-2"
                    >
                        <div className="md:col-span-2">
                            <input
                                type="text"
                                placeholder="Название объекта (Bluewaters 702, Tiara 902 и т.п.)"
                                className="input"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <input
                                type="text"
                                placeholder="Код объекта (например: BW-702)"
                                className="input"
                                value={projectCode}
                                onChange={(e) => setProjectCode(e.target.value)}
                            />
                        </div>

                        <div>
                            <input
                                type="text"
                                placeholder="Адрес / локация"
                                className="input"
                                value={projectAddress}
                                onChange={(e) => setProjectAddress(e.target.value)}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <textarea
                                placeholder="Описание (тип объекта, заказчик и т.д.)"
                                className="textarea"
                                rows={3}
                                value={projectDescription}
                                onChange={(e) => setProjectDescription(e.target.value)}
                            />
                        </div>

                        {error && (
                            <p className="text-xs text-red-400 md:col-span-2">
                                {error}
                            </p>
                        )}

                        <div className="md:col-span-2">
                            <button
                                type="submit"
                                disabled={creatingProject}
                                className="btn-primary w-full md:w-auto"
                            >
                                {creatingProject ? "Добавляем..." : "Добавить объект"}
                            </button>
                        </div>
                    </form>
                </section>

                {/* Список объектов / проектов */}
                <section className="space-y-3">
                    <h2 className="card-title">
                        Объекты в этом пространстве
                    </h2>

                    {loadingProjects ? (
                        <p className="text-sm text-slate-400">
                            Загружаем объекты...
                        </p>
                    ) : projects.length === 0 ? (
                        <p className="text-sm text-slate-400">
                            Пока нет ни одного объекта. Добавьте первый выше.
                        </p>
                    ) : (
                        <ul className="grid gap-3 md:grid-cols-2">
                            {projects.map((project) => (
                                <li
                                    key={project.id}
                                    className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 cursor-pointer hover:border-sky-500 hover:bg-slate-800/80 transition"
                                    onClick={() => router.push(`/projects/${project.id}`)}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="text-sm font-semibold">
                                            {project.name}
                                        </h3>
                                        {project.code && (
                                            <span className="text-[11px] text-slate-500">
                                                {project.code}
                                            </span>
                                        )}
                                    </div>
                                    {project.address && (
                                        <p className="mt-1 text-xs text-slate-300">
                                            {project.address}
                                        </p>
                                    )}
                                    {project.description && (
                                        <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                                            {project.description}
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </AppShell>
    );
}