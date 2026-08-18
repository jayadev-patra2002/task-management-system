"use client";

import {
    useEffect,
    useRef,
    useState,
} from "react";

import {
    Calendar,
    GripVertical,
    MoreHorizontal,
    Pencil,
    Plus,
    SignalHigh,
    SignalLow,
    SignalMedium,
    Tag,
    Trash2,
} from "lucide-react";

import {
    ColumnVisibility,
    PriorityType,
    TaskItem,
} from "../../types/task-types";

/* ======================================================
   PROPS
====================================================== */

interface TaskKanbanViewProps {
  tasks: TaskItem[];

  searchQuery: string;

  /*
   * Controls which fields are visible
   * inside each Kanban task card.
   */
  columns: ColumnVisibility;

  onSelectTask: (task: TaskItem) => void;

  onAddTask: (status?: string) => void;

  onEditTask: (task: TaskItem) => void;

  onDeleteTask: (task: TaskItem) => void;
}

/* ======================================================
   PRIORITY BADGE
====================================================== */

function PriorityBadge({
  priority,
}: {
  priority: PriorityType;
}) {
  switch (priority) {
    /* ========================================================
       URGENT
    ======================================================== */

    case "Urgent":
      return (
        <span className="flex items-center gap-1 text-[11px] font-medium text-red-500">
          <SignalHigh className="h-3 w-3" />
          Urgent
        </span>
      );

    /* ========================================================
       HIGH
    ======================================================== */

    case "High":
      return (
        <span className="flex items-center gap-1 text-[11px] font-medium text-orange-500">
          <SignalHigh className="h-3 w-3" />
          High
        </span>
      );

    /* ========================================================
       MEDIUM
    ======================================================== */

    case "Medium":
      return (
        <span className="flex items-center gap-1 text-[11px] font-medium text-amber-500">
          <SignalMedium className="h-3 w-3" />
          Medium
        </span>
      );

    /* ========================================================
       LOW
    ======================================================== */

    case "Low":
      return (
        <span className="flex items-center gap-1 text-[11px] font-medium text-gray-400">
          <SignalLow className="h-3 w-3" />
          Low
        </span>
      );

    /* ========================================================
       NO PRIORITY
    ======================================================== */

    case "No Priority":
      return (
        <span className="flex items-center gap-1 text-[11px] font-medium text-gray-400">
          <SignalLow className="h-3 w-3" />
          No Priority
        </span>
      );

    default:
      return (
        <span className="flex items-center gap-1 text-[11px] font-medium text-gray-400">
          <SignalLow className="h-3 w-3" />
          No Priority
        </span>
      );
  }
}

/* ======================================================
   AVATAR HELPER
====================================================== */

function getInitials(name?: string) {
  if (!name) return "U";

  const parts = name.trim().split(/\s+/);

  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }

  return name.substring(0, 2).toUpperCase();
}

/* ======================================================
   AVATAR
====================================================== */

function Avatar({
  task,
}: {
  task: TaskItem;
}) {
  if (task.avatarType === "img") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-purple-600 text-[10px] font-bold text-white">
        {task.assignee}
      </span>
    );
  }

  if (task.avatarType === "text" || task.assignee) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700 dark:bg-zinc-700 dark:text-gray-300">
        {getInitials(task.assignee)}
      </span>
    );
  }

  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-gray-300 text-[11px] text-gray-400 dark:border-zinc-700">
      +
    </span>
  );
}

/* ======================================================
   MAIN KANBAN COMPONENT
====================================================== */

export default function TaskKanbanView({
  tasks,
  searchQuery,
  columns,
  onSelectTask,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: TaskKanbanViewProps) {
  /*
   * Kanban columns
   */
  const columnStatuses: Array<
    "To Do" | "Doing" | "On Hold" | "Completed"
  > = [
    "To Do",
    "Doing",
    "On Hold",
    "Completed",
  ];

  /*
   * Currently opened task action menu
   */
  const [openMenuId, setOpenMenuId] =
    useState<string | null>(null);

  const menuRef =
    useRef<HTMLDivElement | null>(null);

  /* ====================================================
     CLOSE TASK MENU WHEN CLICKING OUTSIDE
  ==================================================== */

  useEffect(() => {
    const handleOutsideClick = (
      event: MouseEvent,
    ) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target as Node,
        )
      ) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );
    };
  }, []);

  /* ====================================================
     RENDER
  ==================================================== */

  return (
    <div className="flex min-w-0 items-start gap-3 overflow-x-auto pb-6 sm:gap-6">
      {columnStatuses.map(
        (columnStatus) => {
          /*
           * Get tasks belonging to this
           * individual status column.
           */
          const columnTasks =
            tasks.filter(
              (task) =>
                task.status ===
                  columnStatus &&
                task.title
                  .toLowerCase()
                  .includes(
                    searchQuery.toLowerCase(),
                  ),
            );

          return (
            <div
              key={columnStatus}
              className="flex w-[min(20rem,calc(100vw-1.5rem))] shrink-0 flex-col rounded-2xl sm:w-80 border border-gray-200/80 bg-gray-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              {/* ==================================================
                  COLUMN HEADER
              ================================================== */}

              <div className="mb-3 flex items-center justify-between border-b border-gray-200/60 pb-3 dark:border-zinc-800">
                <div className="flex items-center gap-1.5">
                  <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-gray-400" />

                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {columnStatus}
                  </span>

                  <span className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-200/80 text-[11px] font-medium text-gray-700 dark:bg-zinc-800 dark:text-gray-300">
                    {columnTasks.length}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {/* ADD TASK */}

                  <button
                    type="button"
                    onClick={() =>
                      onAddTask(
                        columnStatus,
                      )
                    }
                    className="rounded-lg p-1 text-gray-500 transition-colors hover:bg-gray-200/60 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-200"
                    aria-label={`Add task to ${columnStatus}`}
                  >
                    <Plus className="h-4 w-4" />
                  </button>

                  {/* COLUMN OPTIONS */}

                  <button
                    type="button"
                    className="rounded-lg p-1 text-gray-500 transition-colors hover:bg-gray-200/60 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-200"
                    aria-label="Column options"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* ==================================================
                  TASK CARDS
              ================================================== */}

              <div className="flex min-h-[120px] flex-col gap-3">
                {columnTasks.map(
                  (task) => (
                    <div
                      key={task.id}
                      onClick={() =>
                        onSelectTask(task)
                      }
                      className="group relative flex cursor-pointer flex-col gap-2.5 rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm transition-all hover:border-gray-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                    >
                      {/* ==========================================
                          CARD TITLE + ACTION MENU
                      ========================================== */}

                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100">
                          {task.title}
                        </h4>

                        <div
                          className="relative"
                          ref={
                            openMenuId ===
                            task.id
                              ? menuRef
                              : null
                          }
                        >
                          <button
                            type="button"
                            onClick={(
                              e,
                            ) => {
                              e.stopPropagation();

                              setOpenMenuId(
                                (
                                  current,
                                ) =>
                                  current ===
                                  task.id
                                    ? null
                                    : task.id,
                              );
                            }}
                            className="rounded-md p-1 text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-gray-200"
                            aria-label="Task options"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>

                          {/* TASK ACTION MENU */}

                          {openMenuId ===
                            task.id && (
                            <div
                              className="absolute right-0 top-7 z-50 w-32 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 text-left shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                              onClick={(
                                e,
                              ) =>
                                e.stopPropagation()
                              }
                            >
                              {/* EDIT */}

                              <button
                                type="button"
                                onClick={(
                                  e,
                                ) => {
                                  e.stopPropagation();

                                  setOpenMenuId(
                                    null,
                                  );

                                  onEditTask(
                                    task,
                                  );
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-zinc-800"
                              >
                                <Pencil className="h-3.5 w-3.5" />

                                <span>
                                  Edit
                                </span>
                              </button>

                              {/* DELETE */}

                              <button
                                type="button"
                                onClick={(
                                  e,
                                ) => {
                                  e.stopPropagation();

                                  setOpenMenuId(
                                    null,
                                  );

                                  onDeleteTask(
                                    task,
                                  );
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                              >
                                <Trash2 className="h-3.5 w-3.5" />

                                <span>
                                  Delete
                                </span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ==========================================
                          PRIORITY + MEMBERS + DUE DATE

                          THESE ARE NOW CONTROLLED BY
                          THE FIELDS MENU
                      ========================================== */}

                      {(columns.priority ||
                        columns.members ||
                        columns.dueDate) && (
                        <div className="flex items-center justify-between pt-1 text-xs">
                          {/* LEFT SIDE */}

                          <div className="flex items-center gap-3">
                            {/* PRIORITY */}

                            {columns.priority && (
                              <PriorityBadge
                                priority={
                                  task.priority
                                }
                              />
                            )}

                            {/* MEMBERS */}

                            {columns.members && (
                              <div className="flex items-center">
                                <Avatar
                                  task={
                                    task
                                  }
                                />
                              </div>
                            )}
                          </div>

                          {/* DUE DATE */}

                          {columns.dueDate &&
                            task.dueDate && (
                              <div className="flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-600 dark:bg-red-950/40 dark:text-red-400">
                                <Calendar className="h-3 w-3" />

                                <span>
                                  {
                                    task.dueDate
                                  }
                                </span>
                              </div>
                            )}
                        </div>
                      )}

                      {/* ==========================================
                          STATUS + REPORTER + LABELS

                          ALSO CONTROLLED BY FIELDS MENU
                      ========================================== */}

                      {(columns.status ||
                        columns.reporter ||
                        columns.labels) && (
                        <div className="flex items-center justify-between border-t border-gray-100 pt-1 dark:border-zinc-800/60">
                          {/* STATUS + REPORTER */}

                          <div className="flex items-center gap-2 pt-1">
                            {/* STATUS */}

                            {columns.status && (
                              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                {
                                  task.status
                                }
                              </span>
                            )}

                            {/* REPORTER */}

                            {columns.reporter &&
                              task.reporter && (
                                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                                  Reporter:{" "}
                                  {
                                    task.reporter
                                  }
                                </span>
                              )}
                          </div>

                          {/* LABELS */}

                          {columns.labels &&
                            task.tags &&
                            task.tags.length >
                              0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {task.tags.map(
                                  (
                                    tag,
                                    idx,
                                  ) => (
                                    <span
                                      key={`${task.id}-${tag}-${idx}`}
                                      className="flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-zinc-800 dark:text-gray-300"
                                    >
                                      <Tag className="h-3 w-3 text-gray-400" />

                                      <span>
                                        {
                                          tag
                                        }
                                      </span>
                                    </span>
                                  ),
                                )}
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  ),
                )}

                {/* ================================================
                    ADD TASK
                ================================================= */}

                <button
                  type="button"
                  onClick={() =>
                    onAddTask(
                      columnStatus,
                    )
                  }
                  className="mt-1 flex items-center gap-1.5 px-1 py-1.5 text-xs font-semibold text-black transition-colors hover:text-gray-700 dark:text-white dark:hover:text-gray-300"
                >
                  <Plus className="h-3.5 w-3.5" />

                  <span>
                    Add Task
                  </span>
                </button>
              </div>
            </div>
          );
        },
      )}
    </div>
  );
}