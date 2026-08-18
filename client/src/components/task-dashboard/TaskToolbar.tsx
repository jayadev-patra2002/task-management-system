"use client";

import React from "react";

import {
    Check,
    Columns3,
    Filter,
    LayoutGrid,
    ListFilter,
    Plus,
    Search,
} from "lucide-react";

import {
    ColumnVisibility,
} from "../../types/task-types";

interface TaskToolbarProps {
  searchQuery: string;

  setSearchQuery: (
    value: string
  ) => void;

  isFieldsOpen: boolean;

  setIsFieldsOpen: (
    value:
      | boolean
      | ((prev: boolean) => boolean)
  ) => void;

  viewMode: "list" | "board";

  setViewMode: (
    value: "list" | "board"
  ) => void;

  columns: ColumnVisibility;

  toggleColumn: (
    key: keyof ColumnVisibility
  ) => void;

  fieldsRef: React.RefObject<HTMLDivElement | null>;

  onAddTask: () => void;

  /*
   * Opens the EXISTING dashboard filter menu.
   * The toolbar does not render another filter menu.
   */
  onToggleFilter: (
    button: HTMLButtonElement
  ) => void;
}

export default function TaskToolbar({
  searchQuery,
  setSearchQuery,
  isFieldsOpen,
  setIsFieldsOpen,
  viewMode,
  setViewMode,
  columns,
  toggleColumn,
  fieldsRef,
  onAddTask,
  onToggleFilter,
}: TaskToolbarProps) {
  return (
    <div className="mb-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">
        Tasks
      </h1>

      <div className="relative flex w-full flex-wrap items-center gap-2 sm:w-auto">
        {/* Search */}

        <div className="relative flex items-center">
          <Search className="absolute left-3 h-3.5 w-3.5 text-gray-400" />

          <input
            id="task-search-input"
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) =>
              setSearchQuery(e.target.value)
            }
            className="w-full min-w-0 rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-10 text-xs text-gray-800 placeholder-gray-400 transition-all focus:border-[var(--app-accent)] focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-gray-200 dark:focus:border-[var(--app-accent)]"
          />

          <kbd className="pointer-events-none absolute right-2.5 rounded border border-gray-200 bg-gray-50 px-1 py-0.5 text-[10px] font-medium text-gray-400 dark:border-zinc-700 dark:bg-zinc-800">
            ⌘F
          </kbd>
        </div>

        {/* Fields */}

        <div
          className="relative"
          ref={fieldsRef}
        >
          <button
            type="button"
            onClick={() =>
              setIsFieldsOpen(
                (prev) => !prev
              )
            }
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              isFieldsOpen
                ? "border-[var(--app-accent)] bg-gray-100 text-[var(--app-accent)] dark:border-[var(--app-accent)] dark:bg-zinc-800"
                : "border-gray-200 text-gray-700 hover:bg-gray-100 dark:border-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-800"
            }`}
          >
            <Columns3 className="h-3.5 w-3.5" />

            <span>Fields</span>
          </button>

          {isFieldsOpen && (
            <div className="absolute right-0 top-9 z-30 w-[min(16rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
              {/* View switcher */}

              <div className="mb-3 flex rounded-lg border border-gray-100 bg-gray-100/70 p-0.5 dark:border-zinc-800 dark:bg-zinc-800/60">
                <button
                  type="button"
                  onClick={() =>
                    setViewMode("list")
                  }
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-xs font-medium transition-all ${
                    viewMode === "list"
                      ? "bg-white text-slate-900 shadow-xs dark:bg-zinc-900 dark:text-white"
                      : "text-gray-500 hover:text-gray-800 dark:text-gray-400"
                  }`}
                >
                  <ListFilter className="h-3.5 w-3.5" />

                  <span>List</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setViewMode("board")
                  }
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-xs font-medium transition-all ${
                    viewMode === "board"
                      ? "bg-white text-slate-900 shadow-xs dark:bg-zinc-900 dark:text-white"
                      : "text-gray-500 hover:text-gray-800 dark:text-gray-400"
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />

                  <span>Board</span>
                </button>
              </div>

              {/* Columns */}

              <div className="space-y-1 text-xs">
                {(
                  Object.keys(
                    columns
                  ) as Array<
                    keyof ColumnVisibility
                  >
                ).map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() =>
                      toggleColumn(col)
                    }
                    className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left capitalize text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-zinc-800/60"
                  >
                    <span className="font-medium">
                      {col.replace(
                        /([A-Z])/g,
                        " $1"
                      )}
                    </span>

                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                        columns[col]
                          ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-[var(--app-accent-foreground)] dark:border-[var(--app-accent)] dark:bg-[var(--app-accent)] dark:text-[var(--app-accent-foreground)]"
                          : "border-gray-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                      }`}
                    >
                      {columns[col] && (
                        <Check className="h-3 w-3" />
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Filter
            IMPORTANT: this is ONLY the trigger.
            The actual filter menu is rendered by ProjectsDashboard,
            so there is no duplicate modal. */}

        <button
          type="button"
          onClick={(event) =>
            onToggleFilter(
              event.currentTarget
            )
          }
          className="flex items-center gap-1.4 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-800"
        >
          <Filter className="h-3.5 w-3.7" />

          <span></span>
        </button>

        {/* Add Task */}

        <button
          type="button"
          onClick={onAddTask}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--app-accent)] px-3 py-1.5 text-xs font-medium text-[var(--app-accent-foreground)] transition-colors hover:bg-[var(--app-accent-hover)]"
        >
          <Plus className="h-3.5 w-3.5" />

          <span>Add Task</span>
        </button>
      </div>
    </div>
  );
}