"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/components/app-shell";

type Project = {
    id: string;
    workspace_id: string;
    name: string;
    code: string | null;
    description: string | null;
    address: string | null;
    status: string | null;
    created_at: string;
};

type Task = {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string | null;
    assignee_id: string | null;
    due_date: string | null;
    created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
    todo: "To Do",
    in_progress: "In Progress",
    done: "Done",
};

const STATUS_ORDER = ["todo", "in_progress", "done"];

export default function ProjectPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    const [userChecked, setUserChecked] = useState(false);

    const [project, setProject] = useState<Project | null>(null);
    const [loadingProject, setLoadingProject] = useState(true);
    const [projectError, setProjectError] = useState<string | null>(null);

    const [tasks, setTasks] = useState<Task[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(true);
    const [tasksError, setTasksError] = useState<string | null>(null);

    // Форма создания задачи
    const [taskTitle, setTaskTitle] = useState("");
    const [taskDescription, setTaskDescription] = useState("");
    const [taskPriority, setTaskPriority] = useState("normal");
    const [taskDueDate, setTaskDueDate] = useState("");
    const [creatingTask, setCreatingTask] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // 1. Проверяем, залогинен ли пользователь
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

    // 2. Загружаем проект
    useEffect(() => {
        if (!userChecked) return;

        const fetchProject = async () => {
            setLoadingProject(true);
            setProjectError(null);

            const { data, error } = await supabase
                .from("projects")
                .select(
                    "id, workspace_id, name, code, description, address, status, created_at"
                )
                .eq("id", projectId)
                .single();

            if (error) {
                console.error(error);
                setProject(null);
                setProjectError(
                    error.code === "PGRST116"
                        ? "Проект не найден или нет доступа."
                        : error.message
                );
            } else {
                setProject(data as Project);
            }

            setLoadingProject(false);
        };

        fetchProject();
    }, [userChecked, projectId]);

    // 3. Загружаем задачи проекта
    useEffect(() => {
        if (!userChecked) return;

        const fetchTasks = async () => {
            setLoadingTasks(true);
            setTasksError(null);

            const { data, error } = await supabase
                .from("tasks")
                .select(
                    "id, title, description, status, priority, assignee_id, due_date, created_at"
                )
                .eq("project_id", projectId)
                .order("created_at", { ascending: true });

            if (error) {
                console.error(error);
                setTasksError(error.message);
            } else {
                setTasks((data ?? []) as Task[]);
            }

            setLoadingTasks(false);
        };

        fetchTasks();
    }, [userChecked, projectId]);

    // Группировка задач по статусам для мини-Kanban
    const tasksByStatus = useMemo(() => {
        const groups: Record<string, Task[]> = {
            todo: [],
            in_progress: [],
            done: [],
        };

        tasks.forEach((task) => {
            const key = STATUS_ORDER.includes(task.status)
                ? task.status
                : "todo";
            groups[key].push(task);
        });

        return groups;
    }, [tasks]);

    const handleBackToWorkspace = () => {
        if (project) {
            router.push(`/workspaces/${project.workspace_id}`);
        } else {
            router.push("/workspaces");
        }
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!project) return;

        setCreatingTask(true);
        setCreateError(null);

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            setCreatingTask(false);
            router.push("/login");
            return;
        }

        const { data, error } = await supabase
            .from("tasks")
            .insert({
                workspace_id: project.workspace_id,
                project_id: project.id,
                title: taskTitle,
                description: taskDescription || null,
                status: "todo",
                priority: taskPriority || "normal",
                assignee_id: user.id,
                due_date: taskDueDate || null,
                created_by: user.id,
            })
            .select(
                "id, title, description, status, priority, assignee_id, due_date, created_at"
            )
            .single();

        if (error || !data) {
            console.error(error);
            setCreateError(error?.message || "Не удалось создать задачу");
            setCreatingTask(false);
            return;
        }

        setTasks((prev) => [...prev, data as Task]);
        setTaskTitle("");
        setTaskDescription("");
        setTaskPriority("normal");
        setTaskDueDate("");
        setCreatingTask(false);
    };

    const handleStatusChange = async (taskId: string, newStatus: string) => {
        setTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
        );

        const { error } = await supabase
            .from("tasks")
            .update({ status: newStatus })
            .eq("id", taskId);

        if (error) {
            console.error(error);
            const { data } = await supabase
                .from("tasks")
                .select(
                    "id, title, description, status, priority, assignee_id, due_date, created_at"
                )
                .eq("project_id", projectId)
                .order("created_at", { ascending: true });

            setTasks((data ?? []) as Task[]);
        }
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

    if (loadingProject) {
        return (
            <AppShell>
                <div className="page-inner flex min-h-[50vh] items-center justify-center">
                    <p className="text-sm text-slate-300">Загружаем проект...</p>
                </div>
            </AppShell>
        );
    }

    if (!project) {
        return (
            <AppShell>
                <div className="page-inner flex min-h-[50vh] flex-col items-center justify-center gap-4">
                    <p className="text-sm text-red-400">
                        {projectError || "Проект не найден."}
                    </p>
                    <button
                        onClick={handleBackToWorkspace}
                        className="btn-outline btn-sm"
                    >
                        Назад
                    </button>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <div className="page-inner space-y-6">
                {/* Заголовок проекта */}
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                        <button
                            onClick={handleBackToWorkspace}
                            className="btn-outline btn-sm mt-0.5"
                        >
                            Назад к пространству
                        </button>
                        <div>
                            <h1 className="text-xl font-semibold">{project.name}</h1>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
                                {project.code && <span>Код: {project.code}</span>}
                                {project.address && <span>Адрес: {project.address}</span>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Описание проекта */}
                {project.description && (
                    <section className="card">
                        <h2 className="card-title">Описание проекта</h2>
                        <p className="mt-2 text-sm text-slate-300">
                            {project.description}
                        </p>
                    </section>
                )}

                {/* Форма создания задачи */}
                <section className="card space-y-4">
                    <h2 className="card-title">Новая задача</h2>
                    <form
                        onSubmit={handleCreateTask}
                        className="grid gap-3 md:grid-cols-2"
                    >
                        <div className="md:col-span-2">
                            <input
                                type="text"
                                placeholder="Название задачи"
                                className="input"
                                value={taskTitle}
                                onChange={(e) => setTaskTitle(e.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] text-slate-400 mb-1">
                                Приоритет
                            </label>
                            <select
                                className="select"
                                value={taskPriority}
                                onChange={(e) => setTaskPriority(e.target.value)}
                            >
                                <option value="low">Низкий</option>
                                <option value="normal">Нормальный</option>
                                <option value="high">Высокий</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[11px] text-slate-400 mb-1">
                                Дедлайн
                            </label>
                            <input
                                type="date"
                                className="input"
                                value={taskDueDate}
                                onChange={(e) => setTaskDueDate(e.target.value)}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <textarea
                                placeholder="Описание задачи (детали, что сделать)"
                                className="textarea"
                                rows={3}
                                value={taskDescription}
                                onChange={(e) => setTaskDescription(e.target.value)}
                            />
                        </div>

                        {createError && (
                            <p className="text-xs text-red-400 md:col-span-2">
                                {createError}
                            </p>
                        )}

                        <div className="md:col-span-2">
                            <button
                                type="submit"
                                disabled={creatingTask}
                                className="btn-primary w-full md:w-auto"
                            >
                                {creatingTask ? "Создаём..." : "Создать задачу"}
                            </button>
                        </div>
                    </form>
                </section>

                {/* Задачи (мини-Kanban) */}
                <section className="space-y-3">
                    <h2 className="card-title">Задачи по объекту</h2>

                    {tasksError && (
                        <p className="text-xs text-red-400">{tasksError}</p>
                    )}

                    {loadingTasks ? (
                        <p className="text-sm text-slate-400">Загружаем задачи...</p>
                    ) : tasks.length === 0 ? (
                        <p className="text-sm text-slate-400">
                            Пока нет задач. Создайте первую выше.
                        </p>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-3">
                            {STATUS_ORDER.map((statusKey) => (
                                <div
                                    key={statusKey}
                                    className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 flex flex-col gap-2 min-h-[140px]"
                                >
                                    <div className="mb-1 flex items-center justify-between">
                                        <h3 className="text-sm font-semibold">
                                            {STATUS_LABELS[statusKey]}
                                        </h3>
                                        <span className="text-[11px] text-slate-400">
                                            {tasksByStatus[statusKey].length}
                                        </span>
                                    </div>

                                    {tasksByStatus[statusKey].length === 0 ? (
                                        <p className="text-[11px] text-slate-500">
                                            Нет задач в этом статусе.
                                        </p>
                                    ) : (
                                        tasksByStatus[statusKey].map((task) => (
                                            <div
                                                key={task.id}
                                                className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs flex flex-col gap-1"
                                            >
                                                <div className="flex justify-between gap-2">
                                                    <span className="font-medium text-slate-50">
                                                        {task.title}
                                                    </span>
                                                    <select
                                                        className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-[10px]"
                                                        value={task.status}
                                                        onChange={(e) =>
                                                            handleStatusChange(task.id, e.target.value)
                                                        }
                                                    >
                                                        {STATUS_ORDER.map((s) => (
                                                            <option key={s} value={s}>
                                                                {STATUS_LABELS[s]}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {task.description && (
                                                    <p className="text-[11px] text-slate-300 line-clamp-2">
                                                        {task.description}
                                                    </p>
                                                )}

                                                <div className="mt-1 flex items-center justify-between">
                                                    {task.priority && (
                                                        <span className="text-[10px] uppercase tracking-wide text-slate-500">
                                                            Приоритет: {task.priority}
                                                        </span>
                                                    )}
                                                    {task.due_date && (
                                                        <span className="text-[10px] text-slate-500">
                                                            Дедлайн:{" "}
                                                            {new Date(task.due_date).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </AppShell>
    );
}