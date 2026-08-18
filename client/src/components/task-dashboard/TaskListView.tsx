"use client";

import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Trash2,
} from "lucide-react";

import {
  ColumnVisibility,
  PriorityType,
  TaskItem,
} from "../../types/task-types";

interface TaskListViewProps {
  tasks: TaskItem[];

  searchQuery: string;

  columns: ColumnVisibility;

  collapsedGroups: Record<string, boolean>;

  toggleGroup: (groupId: string) => void;

  onSelectTask: (task: TaskItem) => void;

  onAddTask: () => void;

  /**
   * Called when Edit is selected
   * from the task (...) menu.
   */
  onEditTask: (task: TaskItem) => void;

  /**
   * Called when Delete is selected
   * from the task (...) menu.
   */
  onDeleteTask: (task: TaskItem) => void;
}

/* ============================================================
   PRIORITY BADGE
============================================================ */

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
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-red-500">
          <SignalHigh className="h-3 w-3 shrink-0" />
          Urgent
        </span>
      );

    /* ========================================================
       HIGH
    ======================================================== */

    case "High":
      return (
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-orange-500">
          <SignalHigh className="h-3 w-3 shrink-0" />
          High
        </span>
      );

    /* ========================================================
       MEDIUM
    ======================================================== */

    case "Medium":
      return (
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-amber-500">
          <SignalMedium className="h-3 w-3 shrink-0" />
          Medium
        </span>
      );

    /* ========================================================
       LOW
    ======================================================== */

    case "Low":
      return (
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-gray-400">
          <SignalLow className="h-3 w-3 shrink-0" />
          Low
        </span>
      );

    /* ========================================================
       NO PRIORITY
    ======================================================== */

    case "No Priority":
      return (
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-gray-400">
          <SignalLow className="h-3 w-3 shrink-0" />
          No Priority
        </span>
      );

    /* ========================================================
       FALLBACK
    ======================================================== */

    default:
      return (
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-gray-400">
          <SignalLow className="h-3 w-3 shrink-0" />
          No Priority
        </span>
      );
  }
}

/* ============================================================
   GET MEMBER INITIALS
============================================================ */

function getInitials(name?: string | null) {
  if (!name) {
    return "?";
  }

  const trimmedName = name.trim();

  if (!trimmedName) {
    return "?";
  }

  /*
   * If the existing value is already something like:
   * JP
   * CN
   * AD
   *
   * keep it as it is.
   */
  if (
    !trimmedName.includes(" ") &&
    trimmedName.length <= 3 &&
    trimmedName === trimmedName.toUpperCase()
  ) {
    return trimmedName;
  }

  const parts = trimmedName.split(/\s+/);

  /*
   * Single name:
   * Jayadev -> J
   */
  if (parts.length === 1) {
    return parts[0]
      .charAt(0)
      .toUpperCase();
  }

  /*
   * First name + last name:
   *
   * Jayadev Patra -> JP
   *
   * Also handles:
   * Jayadev Kumar Patra -> JP
   */
  return (
    parts[0].charAt(0) +
    parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}

/* ============================================================
   MEMBER AVATAR
============================================================ */

function Avatar({
  task,
}: {
  task: TaskItem;
}) {
  /*
   * No assigned member
   */
  if (
    !task.assignee ||
    task.assignee.trim() === "" ||
    task.assignee.trim() === "+"
  ) {
    return (
      <span
        title="Add member"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-sm text-gray-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-400"
      >
        -
      </span>
    );
  }

  const initials = getInitials(
    task.assignee
  );

  return (
    <span
      title={task.assignee}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold uppercase text-gray-700 dark:bg-zinc-700 dark:text-gray-200"
    >
      {initials}
    </span>
  );
}

/* ============================================================
   TASK LIST VIEW
============================================================ */

export default function TaskListView({
  tasks,
  searchQuery,
  columns,
  collapsedGroups,
  toggleGroup,
  onSelectTask,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: TaskListViewProps) {
  /*
   * IMPORTANT:
   *
   * On Hold has been added here.
   *
   * The order is:
   * To Do
   * Doing
   * On Hold
   * Completed
   */
  const sections: Array<
    "To Do" | "Doing" | "On Hold" | "Completed"
  > = [
    "To Do",
    "Doing",
    "On Hold",
    "Completed",
  ];

  /* ==========================================================
     TASK ACTION MENU STATE
  ========================================================== */

  const [openMenuId, setOpenMenuId] =
    useState<string | null>(null);

  const menuRef =
    useRef<HTMLDivElement | null>(null);

  /* ==========================================================
     CLOSE MENU WHEN CLICKING OUTSIDE
  ========================================================== */

  useEffect(() => {
    const handleOutsideClick = (
      event: MouseEvent
    ) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target as Node
        )
      ) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  /* ==========================================================
     CLOSE MENU WHEN ESC IS PRESSED
  ========================================================== */

  useEffect(() => {
    const handleEscape = (
      event: KeyboardEvent
    ) => {
      if (event.key === "Escape") {
        setOpenMenuId(null);
      }
    };

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);

  /* ==========================================================
     COLUMN COUNT
  ========================================================== */

  /*
   * Task + Actions are always visible.
   *
   * Remaining columns are controlled
   * by the Fields menu.
   */
  const activeColumnCount =
    2 +
    Object.values(columns).filter(
      Boolean
    ).length;

  /* ==========================================================
     EDIT HANDLER
  ========================================================== */

  const handleEdit = (
    event: React.MouseEvent,
    task: TaskItem
  ) => {
    /*
     * Prevent row click.
     */
    event.stopPropagation();

    /*
     * Close dropdown.
     */
    setOpenMenuId(null);

    /*
     * Let parent handle editing.
     */
    onEditTask(task);
  };

  /* ==========================================================
     DELETE HANDLER
  ========================================================== */

  const handleDelete = (
    event: React.MouseEvent,
    task: TaskItem
  ) => {
    /*
     * Prevent row click.
     */
    event.stopPropagation();

    /*
     * Close dropdown.
     */
    setOpenMenuId(null);

    /*
     * Let parent handle deletion.
     */
    onDeleteTask(task);
  };

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="space-y-5">
      {sections.map((section) => {
        const isCollapsed =
          collapsedGroups[section];

        /*
         * Filter tasks by status and search.
         */
        const sectionTasks =
          tasks.filter(
            (task) =>
              task.status === section &&
              task.title
                .toLowerCase()
                .includes(
                  searchQuery.toLowerCase()
                )
          );

        /*
         * During search, hide empty sections.
         */
        if (
          searchQuery.trim() !== "" &&
          sectionTasks.length === 0
        ) {
          return null;
        }

        return (
          <div
            key={section}
            className="space-y-2"
          >
            {/* ==================================================
                GROUP HEADER
            ================================================== */}

            <button
              type="button"
              onClick={() =>
                toggleGroup(section)
              }
              className="flex items-center gap-2 text-sm font-medium text-gray-800 transition-colors hover:text-black dark:text-gray-200 dark:hover:text-white"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              )}

              <span>{section}</span>
            </button>

            {/* ==================================================
                TABLE
            ================================================== */}

            {!isCollapsed && (
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <table className="w-full table-fixed text-left text-sm">

                  {/* ==================================================
                      COLUMN WIDTHS
                  ================================================== */}

                  <colgroup>
                    <col
                      style={{
                        width: "30%",
                      }}
                    />

                    {columns.priority && (
                      <col
                        style={{
                          width: "11%",
                        }}
                      />
                    )}

                    {columns.members && (
                      <col
                        style={{
                          width: "12%",
                        }}
                      />
                    )}

                    {columns.dueDate && (
                      <col
                        style={{
                          width: "12%",
                        }}
                      />
                    )}

                    {columns.labels && (
                      <col
                        style={{
                          width: "11%",
                        }}
                      />
                    )}

                    {columns.status && (
                      <col
                        style={{
                          width: "10%",
                        }}
                      />
                    )}

                    {columns.reporter && (
                      <col
                        style={{
                          width: "10%",
                        }}
                      />
                    )}

                    <col
                      style={{
                        width: "7%",
                      }}
                    />
                  </colgroup>

                  {/* ==================================================
                      TABLE HEADER
                  ================================================== */}

                  <thead className="bg-gray-50/80 text-[12px] font-medium text-gray-600 dark:bg-zinc-800/50 dark:text-gray-400">
                    <tr>
                      <th className="h-12 overflow-hidden px-4 text-left font-medium">
                        Task
                      </th>

                      {columns.priority && (
                        <th className="h-12 overflow-hidden px-3 text-left font-medium">
                          Priority
                        </th>
                      )}

                      {columns.members && (
                        <th className="h-12 overflow-hidden px-3 text-left font-medium">
                          Members
                        </th>
                      )}

                      {columns.dueDate && (
                        <th className="h-12 overflow-hidden px-3 text-left font-medium">
                          Due Date
                        </th>
                      )}

                      {columns.labels && (
                        <th className="h-12 overflow-hidden px-3 text-left font-medium">
                          Labels
                        </th>
                      )}

                      {columns.status && (
                        <th className="h-12 overflow-hidden px-3 text-left font-medium">
                          Status
                        </th>
                      )}

                      {columns.reporter && (
                        <th className="h-12 overflow-hidden px-3 text-left font-medium">
                          Reporter
                        </th>
                      )}

                      <th className="h-12 px-3 text-right font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  {/* ==================================================
                      TABLE BODY
                  ================================================== */}

                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/60">
                    {sectionTasks.map(
                      (task) => (
                        <tr
                          key={task.id}
                          onClick={() =>
                            onSelectTask(task)
                          }
                          className="group cursor-pointer transition-colors hover:bg-gray-50/70 dark:hover:bg-zinc-800/30"
                        >
                          {/* ==================================================
                              TASK
                          ================================================== */}

                          <td className="h-14 overflow-hidden px-4 font-medium text-gray-900 dark:text-gray-100">
                            <div
                              className="truncate"
                              title={task.title}
                            >
                              {task.title}
                            </div>
                          </td>

                          {/* ==================================================
                              PRIORITY
                          ================================================== */}

                          {columns.priority && (
                            <td className="h-14 overflow-hidden px-3">
                              <PriorityBadge
                                priority={
                                  task.priority
                                }
                              />
                            </td>
                          )}

                          {/* ==================================================
                              MEMBERS
                          ================================================== */}

                          {columns.members && (
                            <td className="h-14 overflow-hidden px-3">
                              <div className="flex items-center gap-2">
                                <Avatar
                                  task={task}
                                />
                              </div>
                            </td>
                          )}

                          {/* ==================================================
                              DUE DATE
                          ================================================== */}

                          {columns.dueDate && (
                            <td className="h-14 overflow-hidden px-3 text-gray-600 dark:text-gray-400">
                              <span
                                className="block truncate whitespace-nowrap"
                                title={
                                  task.dueDate
                                }
                              >
                                {task.dueDate}
                              </span>
                            </td>
                          )}

                          {/* ==================================================
                              LABELS
                          ================================================== */}

                          {columns.labels && (
                            <td className="h-14 overflow-hidden px-3">
                              {task.tags &&
                              task.tags.length >
                                0 ? (
                                <div className="flex max-w-full items-center gap-1 overflow-hidden">
                                  {task.tags
                                    .slice(
                                      0,
                                      2
                                    )
                                    .map(
                                      (
                                        tag,
                                        index
                                      ) => (
                                        <span
                                          key={`${task.id}-${tag}-${index}`}
                                          title={
                                            tag
                                          }
                                          className="max-w-[100px] truncate rounded-md bg-gray-100 px-2 py-1 text-[11px] text-gray-600 dark:bg-zinc-800 dark:text-gray-300"
                                        >
                                          {
                                            tag
                                          }
                                        </span>
                                      )
                                    )}

                                  {task.tags
                                    .length >
                                    2 && (
                                    <span className="shrink-0 text-[10px] text-gray-400">
                                      +
                                      {task
                                        .tags
                                        .length -
                                        2}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">
                                  -
                                </span>
                              )}
                            </td>
                          )}

                          {/* ==================================================
                              STATUS
                          ================================================== */}

                          {columns.status && (
                            <td className="h-14 overflow-hidden px-3 text-gray-600 dark:text-gray-400">
                              <span className="block truncate">
                                {
                                  task.status
                                }
                              </span>
                            </td>
                          )}

                          {/* ==================================================
                              REPORTER
                          ================================================== */}

                          {columns.reporter && (
                            <td className="h-14 overflow-hidden px-3 text-gray-600 dark:text-gray-400">
                              <span
                                className="block truncate"
                                title={
                                  task.reporter ||
                                  ""
                                }
                              >
                                {task.reporter ||
                                  "-"}
                              </span>
                            </td>
                          )}

                          {/* ==================================================
                              ACTIONS
                          ================================================== */}

                          <td className="relative h-14 px-3 text-right">
                            <div
                              className="relative inline-block"
                              ref={
                                openMenuId ===
                                task.id
                                  ? menuRef
                                  : null
                              }
                            >
                              {/* THREE DOT BUTTON */}

                              <button
                                type="button"
                                onClick={(
                                  event
                                ) => {
                                  event.stopPropagation();

                                  setOpenMenuId(
                                    (
                                      current
                                    ) =>
                                      current ===
                                      task.id
                                        ? null
                                        : task.id
                                  );
                                }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-gray-200"
                                aria-label={`Actions for ${task.title}`}
                                aria-expanded={
                                  openMenuId ===
                                  task.id
                                }
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>

                              {/* ACTION DROPDOWN */}

                              {openMenuId ===
                                task.id && (
                                <div
                                  className="absolute right-0 top-8 z-50 w-36 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 text-left shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                                  onClick={(
                                    event
                                  ) =>
                                    event.stopPropagation()
                                  }
                                >
                                  {/* EDIT */}

                                  <button
                                    type="button"
                                    onClick={(
                                      event
                                    ) =>
                                      handleEdit(
                                        event,
                                        task
                                      )
                                    }
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-zinc-800"
                                  >
                                    <Pencil className="h-3.5 w-3.5 shrink-0" />

                                    <span>
                                      Edit
                                    </span>
                                  </button>

                                  {/* DELETE */}

                                  <button
                                    type="button"
                                    onClick={(
                                      event
                                    ) =>
                                      handleDelete(
                                        event,
                                        task
                                      )
                                    }
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 shrink-0" />

                                    <span>
                                      Delete
                                    </span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    )}

                    {/* ==================================================
                        ADD TASK
                    ================================================== */}

                    {searchQuery.trim() ===
                      "" && (
                      <tr>
                        <td
                          colSpan={
                            activeColumnCount
                          }
                          className="h-12 px-4"
                        >
                          <button
                            type="button"
                            onClick={
                              onAddTask
                            }
                            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            <Plus className="h-4 w-4" />

                            <span>
                              Add Task
                            </span>
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}