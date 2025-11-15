"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/components/app-shell";
import {
    DragDropContext,
    Droppable,
    Draggable,
    type DropResult,
} from "@hello-pangea/dnd";
import { Modal } from "@/components/modal";

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

type TaskAssigneeRow = {
    user_id: string;
};

type TaskRow = {
    id: string;
    title: string;
    description: string | null;
    status: string;
    assignee_id: string | null; // старое поле, не используем, но оставим в типе
    due_date: string | null;
    created_at: string;
    task_assignees?: TaskAssigneeRow[];
};

type WorkspaceUser = {
    id: string;
    name: string;
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

    const [tasks, setTasks] = useState<TaskRow[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(true);
    const [tasksError, setTasksError] = useState<string | null>(null);

    // Участники текущего workspace
    const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceUser[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);

    // Форма создания задачи
    const [taskTitle, setTaskTitle] = useState("");
    const [taskDescription, setTaskDescription] = useState("");
    const [taskDueDate, setTaskDueDate] = useState("");
    const [creatingTask, setCreatingTask] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Удаление задач / проекта
    const [deletingProject, setDeletingProject] = useState(false);

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
                    (error as any).code === "PGRST116"
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

    // 3. Загружаем задачи проекта (с исполнителями)
    useEffect(() => {
        if (!userChecked) return;

        const fetchTasks = async () => {
            setLoadingTasks(true);
            setTasksError(null);

            const { data, error } = await supabase
                .from("tasks")
                .select(
                    "id, title, description, status, assignee_id, due_date, created_at, task_assignees ( user_id )"
                )
                .eq("project_id", projectId)
                .order("created_at", { ascending: true });

            if (error) {
                console.error(error);
                setTasksError(error.message);
            } else {
                setTasks((data ?? []) as TaskRow[]);
            }

            setLoadingTasks(false);
        };

        fetchTasks();
    }, [userChecked, projectId]);

    // 4. Загружаем участников workspace (после загрузки проекта, т.к. нам нужен workspace_id)
    useEffect(() => {
        if (!userChecked || !project) return;

        const fetchMembers = async () => {
            setLoadingMembers(true);

            // 1) берём всех user_id из workspace_members
            const { data: members, error: membersError } = await supabase
                .from("workspace_members")
                .select("user_id")
                .eq("workspace_id", project.workspace_id);

            if (membersError) {
                console.error(membersError);
                setWorkspaceUsers([]);
                setLoadingMembers(false);
                return;
            }

            const userIds = (members ?? []).map((m: any) => m.user_id) as string[];

            if (userIds.length === 0) {
                setWorkspaceUsers([]);
                setLoadingMembers(false);
                return;
            }

            // 2) загружаем профили этих пользователей
            const { data: profiles, error: profilesError } = await supabase
                .from("profiles")
                .select("id, first_name, second_name")
                .in("id", userIds);

            if (profilesError) {
                console.error(profilesError);
                // fallback: просто список ID
                const fallback = userIds.map((id) => ({
                    id,
                    name: "Пользователь",
                }));
                setWorkspaceUsers(fallback);
                setLoadingMembers(false);
                return;
            }

            const users: WorkspaceUser[] = userIds.map((id) => {
                const p = (profiles ?? []).find((pr: any) => pr.id === id);
                const fullName =
                    [p?.first_name, p?.second_name].filter(Boolean).join(" ") ||
                    "Пользователь";
                return {
                    id,
                    name: fullName,
                };
            });

            setWorkspaceUsers(users);
            setLoadingMembers(false);
        };

        fetchMembers();
    }, [userChecked, project]);

    // Группировка задач по статусам для Kanban
    const tasksByStatus = useMemo(() => {
        const groups: Record<string, TaskRow[]> = {
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

    // Создание задачи с назначением исполнителей
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

        // 1. создаём задачу
        const { data, error } = await supabase
            .from("tasks")
            .insert({
                workspace_id: project.workspace_id,
                project_id: project.id,
                title: taskTitle,
                description: taskDescription || null,
                status: "todo",
                assignee_id: null, // одиночное поле не используем
                due_date: taskDueDate || null,
                created_by: user.id,
            })
            .select(
                "id, title, description, status, assignee_id, due_date, created_at"
            )
            .single();

        if (error || !data) {
            console.error(error);
            setCreateError(
                (error as any)?.message || "Не удалось создать задачу"
            );
            setCreatingTask(false);
            return;
        }

        let assigneesRows: TaskAssigneeRow[] = [];

        // 2. если выбраны исполнители — записываем их в task_assignees
        if (newTaskAssignees.length > 0) {
            const payload = newTaskAssignees.map((uid) => ({
                task_id: (data as any).id,
                user_id: uid,
            }));

            const { data: inserted, error: assigneesError } = await supabase
                .from("task_assignees")
                .insert(payload)
                .select("user_id");

            if (assigneesError) {
                console.error(assigneesError);
                // не падаем, просто создаём задачу без назначений
            } else {
                assigneesRows = (inserted ?? []) as TaskAssigneeRow[];
            }
        }

        const newTask: TaskRow = {
            ...(data as any),
            task_assignees: assigneesRows,
        };

        setTasks((prev) => [...prev, newTask]);

        // Сброс формы
        setTaskTitle("");
        setTaskDescription("");
        setTaskDueDate("");
        setNewTaskAssignees([]);
        setCreatingTask(false);
    };

    // DRAG'N'DROP смена статуса
    const handleDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;

        const sourceStatus = source.droppableId;
        const destStatus = destination.droppableId;

        if (sourceStatus === destStatus) return;

        // локально меняем статус
        setTasks((prev) =>
            prev.map((task) =>
                task.id === draggableId ? { ...task, status: destStatus } : task
            )
        );

        const { error } = await supabase
            .from("tasks")
            .update({ status: destStatus })
            .eq("id", draggableId);

        if (error) {
            console.error(error);
            // откат: перечитываем задачи
            const { data } = await supabase
                .from("tasks")
                .select(
                    "id, title, description, status, assignee_id, due_date, created_at, task_assignees ( user_id )"
                )
                .eq("project_id", projectId)
                .order("created_at", { ascending: true });

            setTasks((data ?? []) as TaskRow[]);
        }
    };

    // Удаление задачи
    const handleDeleteTask = async (taskId: string) => {
        const confirmed = window.confirm("Удалить задачу?");
        if (!confirmed) return;

        setTasks((prev) => prev.filter((t) => t.id !== taskId));

        const { error } = await supabase
            .from("tasks")
            .delete()
            .eq("id", taskId);

        if (error) {
            console.error(error);
            alert(
                "Не удалось удалить задачу. Возможно, нет прав.\n\n" +
                error.message
            );

            const { data } = await supabase
                .from("tasks")
                .select(
                    "id, title, description, status, assignee_id, due_date, created_at, task_assignees ( user_id )"
                )
                .eq("project_id", projectId)
                .order("created_at", { ascending: true });

            setTasks((data ?? []) as TaskRow[]);
        }
    };

    // Назначение / снятие исполнителя у конкретной задачи
    const handleToggleAssignee = async (
        taskId: string,
        userId: string,
        checked: boolean
    ) => {
        // Оптимистично обновляем локально
        setTasks((prev) =>
            prev.map((task) => {
                if (task.id !== taskId) return task;
                const current = task.task_assignees ?? [];
                const exists = current.some((a) => a.user_id === userId);

                let next: TaskAssigneeRow[];
                if (checked && !exists) {
                    next = [...current, { user_id: userId }];
                } else if (!checked && exists) {
                    next = current.filter((a) => a.user_id !== userId);
                } else {
                    next = current;
                }

                return { ...task, task_assignees: next };
            })
        );

        if (checked) {
            // Добавляем исполнителя
            const { error } = await supabase
                .from("task_assignees")
                .insert({ task_id: taskId, user_id: userId });

            if (error) {
                console.error(error);
                alert(
                    "Не удалось назначить исполнителя. Возможно, нет прав.\n\n" +
                    error.message
                );
                // откат: перечитываем задачи
                const { data } = await supabase
                    .from("tasks")
                    .select(
                        "id, title, description, status, assignee_id, due_date, created_at, task_assignees ( user_id )"
                    )
                    .eq("project_id", projectId)
                    .order("created_at", { ascending: true });

                setTasks((data ?? []) as TaskRow[]);
            }
        } else {
            // Убираем исполнителя
            const { error } = await supabase
                .from("task_assignees")
                .delete()
                .eq("task_id", taskId)
                .eq("user_id", userId);

            if (error) {
                console.error(error);
                alert(
                    "Не удалось снять исполнителя. Возможно, нет прав.\n\n" +
                    error.message
                );
                const { data } = await supabase
                    .from("tasks")
                    .select(
                        "id, title, description, status, assignee_id, due_date, created_at, task_assignees ( user_id )"
                    )
                    .eq("project_id", projectId)
                    .order("created_at", { ascending: true });

                setTasks((data ?? []) as TaskRow[]);
            }
        }
    };

    // Удаление объекта (проекта) целиком
    const handleDeleteProject = async () => {
        if (!project) return;

        const confirmed = window.confirm(
            `Удалить объект «${project.name}»? Все задачи по этому объекту тоже будут удалены.`
        );
        if (!confirmed) return;

        setDeletingProject(true);

        const { error } = await supabase
            .from("projects")
            .delete()
            .eq("id", project.id);

        setDeletingProject(false);

        if (error) {
            console.error(error);
            alert(
                "Не удалось удалить объект. Возможно, нет прав или есть связанные данные.\n\n" +
                error.message
            );
            return;
        }

        router.push(`/workspaces/${project.workspace_id}`);
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
                {/* Заголовок проекта + кнопка удаления */}
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

                    <button
                        type="button"
                        onClick={handleDeleteProject}
                        disabled={deletingProject}
                        className="btn-outline btn-sm border-red-500 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    >
                        {deletingProject ? "Удаляем..." : "Удалить объект"}
                    </button>
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

                <Modal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title="Создание новой задачи"
                >
                    <form
                        onSubmit={handleCreateTask}
                        className="grid gap-3 md:grid-cols-2"
                    >
                        <div className="md:col-span-2">
                            <input
                                type="text"
                                placeholder="Формулировка задачи"
                                className="input"
                                value={taskTitle}
                                onChange={(e) => setTaskTitle(e.target.value)}
                                required
                            />
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
                                placeholder="Описание задачи"
                                className="textarea"
                                rows={3}
                                value={taskDescription}
                                onChange={(e) => setTaskDescription(e.target.value)}
                            />
                        </div>

                        {/* Выбор исполнителей для новой задачи */}
                        <div className="md:col-span-2">
                            <label className="block text-[11px] text-slate-400 mb-1">
                                Исполнители (участники пространства)
                            </label>

                            {loadingMembers ? (
                                <p className="text-[11px] text-slate-500">
                                    Загружаем участников пространства...
                                </p>
                            ) : workspaceUsers.length === 0 ? (
                                <p className="text-[11px] text-slate-500">
                                    В этом пространстве пока нет участников.
                                </p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {workspaceUsers.map((u) => {
                                        const checked = newTaskAssignees.includes(u.id);
                                        return (
                                            <label
                                                key={u.id}
                                                className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[11px] cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="h-3 w-3 rounded border-slate-600 bg-slate-950"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                        const isChecked = e.target.checked;
                                                        setNewTaskAssignees((prev) =>
                                                            isChecked
                                                                ? [...prev, u.id]
                                                                : prev.filter((id) => id !== u.id)
                                                        );
                                                    }}
                                                />
                                                <span>{u.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
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
                </Modal>

                {/* Задачи (Kanban с drag'n'drop + исполнители) */}
                <section className="space-y-3">
                    <h2 className="card-title">Задачи по объекту</h2>

                    {tasksError && (
                        <p className="text-xs text-red-400">{tasksError}</p>
                    )}

                    {tasksError && (
                        <p className="text-xs text-red-400">{tasksError}</p>
                    )}

                    {loadingTasks ? (
                        <p className="text-sm text-slate-400">Загружаем задачи...</p>
                    ) : (
                        <DragDropContext onDragEnd={handleDragEnd}>
                            <div className="grid gap-4 md:grid-cols-3">
                                {STATUS_ORDER.map((statusKey) => (
                                    <Droppable droppableId={statusKey} key={statusKey}>
                                        {(provided) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.droppableProps}
                                                className="group rounded-xl border border-slate-800 bg-slate-900/80 p-3 flex flex-col gap-2 min-h-[140px]"
                                            >
                                                <div className="mb-1 flex items-center justify-between">
                                                    <h3 className="text-sm font-semibold">
                                                        {STATUS_LABELS[statusKey]}
                                                    </h3>
                                                    <button
                                                        onClick={() => setIsModalOpen(true)}
                                                        className="text-xs text-slate-400 hover:text-sky-400 opacity-0 group-hover:opacity-100 transition"
                                                    >
                                                        + Новая задача
                                                    </button>
                                                    <span className="text-[11px] text-slate-400">
                                                        {tasksByStatus[statusKey].length}
                                                    </span>
                                                </div>

                                                {tasksByStatus[statusKey].length === 0 ? (
                                                    <p className="text-[11px] text-slate-500">
                                                        Нет задач в этом статусе.
                                                    </p>
                                                ) : (
                                                    tasksByStatus[statusKey].map((task, index) => (
                                                        <Draggable
                                                            key={task.id}
                                                            draggableId={task.id}
                                                            index={index}
                                                        >
                                                            {(provided) => {
                                                                const assignedIds = new Set(
                                                                    (task.task_assignees ?? []).map(
                                                                        (a) => a.user_id
                                                                    )
                                                                );
                                                                return (
                                                                    <div
                                                                        ref={provided.innerRef}
                                                                        {...provided.draggableProps}
                                                                        {...provided.dragHandleProps}
                                                                        className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs flex flex-col gap-1 cursor-grab active:cursor-grabbing"
                                                                    >
                                                                        <div className="flex justify-between gap-2">
                                                                            <span className="font-medium text-slate-50">
                                                                                {task.title}
                                                                            </span>
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleDeleteTask(task.id);
                                                                                }}
                                                                                className="text-[11px] text-slate-500 hover:text-red-400 px-1"
                                                                                title="Удалить задачу"
                                                                            >
                                                                                ✕
                                                                            </button>
                                                                        </div>

                                                                        {task.description && (
                                                                            <p className="text-[11px] text-slate-300 line-clamp-2">
                                                                                {task.description}
                                                                            </p>
                                                                        )}

                                                                        <div className="mt-1 flex items-center justify-end">
                                                                            {task.due_date && (
                                                                                <span className="text-[10px] text-slate-500">
                                                                                    Дедлайн:{" "}
                                                                                    {new Date(
                                                                                        task.due_date
                                                                                    ).toLocaleDateString()}
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        {/* Назначение исполнителей для существующей задачи */}
                                                                        {workspaceUsers.length > 0 && (
                                                                            <div className="mt-1">
                                                                                <p className="text-[10px] text-slate-500 mb-1">
                                                                                    Исполнители:
                                                                                </p>
                                                                                <div className="flex flex-wrap gap-1">
                                                                                    {workspaceUsers.map((u) => {
                                                                                        const checked =
                                                                                            assignedIds.has(u.id);
                                                                                        return (
                                                                                            <label
                                                                                                key={u.id}
                                                                                                className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[10px] cursor-pointer"
                                                                                            >
                                                                                                <input
                                                                                                    type="checkbox"
                                                                                                    className="h-3 w-3 rounded border-slate-600 bg-slate-950"
                                                                                                    checked={checked}
                                                                                                    onChange={(e) =>
                                                                                                        handleToggleAssignee(
                                                                                                            task.id,
                                                                                                            u.id,
                                                                                                            e.target.checked
                                                                                                        )
                                                                                                    }
                                                                                                />
                                                                                                <span>{u.name}</span>
                                                                                            </label>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            }}
                                                        </Draggable>
                                                    ))
                                                )}

                                                {provided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                ))}
                            </div>
                        </DragDropContext>
                    )}
                </section>
            </div>
        </AppShell>
    );
}