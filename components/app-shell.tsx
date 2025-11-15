"use client";

import { ReactNode } from "react";
import { TopBar } from "./top-bar";

export function AppShell({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-50">
            <TopBar />

            <div className="flex min-h-[calc(100vh-56px)]">
                <aside className="hidden md:block w-60 border-r border-slate-800 bg-slate-950/80">
                    <nav className="flex flex-col gap-2 p-4 text-sm">
                        <span className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                            Навигация
                        </span>
                        <a
                            href="/workspaces"
                            className="rounded-lg px-2 py-1 text-slate-200 hover:bg-slate-800 hover:text-sky-300 transition"
                        >
                            Пространства
                        </a>
                    </nav>
                </aside>

                <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
                    {children}
                </main>
            </div>
        </div>
    );
}