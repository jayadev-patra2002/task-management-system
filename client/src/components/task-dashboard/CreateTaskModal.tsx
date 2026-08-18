"use client";

import React from "react";
import {
  PriorityType,
  TaskFormData,
} from "../../types/task-types";

interface TeamMember {
  id?: string;
  name?: string;
  email: string;
}

interface CreateTaskModalProps {
  isOpen: boolean;
  taskForm: TaskFormData;
  setTaskForm: React.Dispatch<
    React.SetStateAction<TaskFormData>
  >;
  teamMembers: TeamMember[];
  onClose: () => void;
  onSubmit: (
    event: React.FormEvent<HTMLFormElement>
  ) => void;
  isLoading?: boolean;
}

/**
 * Convert:
 * "12 Sep 2026"
 *
 * into:
 * "2026-09-12"
 *
 * This format is required by <input type="date">
 */
function formatDateForPicker(
  dateString: string
): string {
  if (!dateString) {
    return "";
  }

  // If the value is already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  const parts = dateString.trim().split(" ");

  if (parts.length !== 3) {
    return "";
  }

  const day = parts[0];
  const month = parts[1];
  const year = parts[2];

  const months: Record<string, string> = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };

  const monthNumber = months[month];

  if (!monthNumber) {
    return "";
  }

  return `${year}-${monthNumber}-${day.padStart(
    2,
    "0"
  )}`;
}

/**
 * Convert:
 * "2026-09-12"
 *
 * into:
 * "12 Sep 2026"
 */
function formatDateForStorage(
  dateString: string
): string {
  if (!dateString) {
    return "";
  }

  const parts = dateString.split("-");

  if (parts.length !== 3) {
    return "";
  }

  const year = parts[0];
  const month = parts[1];
  const day = parts[2];

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const monthIndex = Number(month) - 1;

  if (
    monthIndex < 0 ||
    monthIndex > 11
  ) {
    return "";
  }

  return `${day.padStart(
    2,
    "0"
  )} ${months[monthIndex]} ${year}`;
}

export default function CreateTaskModal({
  isOpen,
  taskForm,
  setTaskForm,
  teamMembers,
  onClose,
  onSubmit,
  isLoading = false,
}: CreateTaskModalProps) {
  if (!isOpen) {
    return null;
  }

  const safeTeamMembers = Array.isArray(teamMembers)
    ? teamMembers
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 backdrop-blur-xs sm:p-4">
      <div className="max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-2xl sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">

        {/* ==================================================
            HEADER
        ================================================== */}

        <div className="flex items-center justify-between border-b border-gray-200 pb-4 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Create New Task
          </h3>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* ==================================================
            FORM
        ================================================== */}

        <form
          onSubmit={onSubmit}
          className="space-y-4 pt-4 text-xs"
        >

          {/* ==================================================
              TASK TITLE
          ================================================== */}

          <div>
            <label className="mb-1 block font-medium text-gray-700 dark:text-gray-300">
              Task Title
            </label>

            <input
              type="text"
              required
              disabled={isLoading}
              placeholder="e.g. Optimize Database Queries"
              value={taskForm.title}
              onChange={(e) =>
                setTaskForm((prev) => ({
                  ...prev,
                  title: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-black focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white disabled:opacity-50"
            />
          </div>

          {/* ==================================================
              DESCRIPTION
          ================================================== */}

          <div>
            <label className="mb-1 block font-medium text-gray-700 dark:text-gray-300">
              Description
            </label>

            <textarea
              placeholder="Add details about this task..."
              disabled={isLoading}
              value={taskForm.description}
              onChange={(e) =>
                setTaskForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-black focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white disabled:opacity-50"
              rows={2}
            />
          </div>

          {/* ==================================================
              STATUS + PRIORITY
          ================================================== */}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

            {/* STATUS */}

            <div>
              <label className="mb-1 block font-medium text-gray-700 dark:text-gray-300">
                Status
              </label>

              <select
                value={taskForm.status}
                disabled={isLoading}
                onChange={(e) =>
                  setTaskForm((prev) => ({
                    ...prev,
                    status:
                      e.target.value as TaskFormData["status"],
                  }))
                }
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 focus:border-black focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white disabled:opacity-50"
              >
                <option value="To Do">
                  To Do
                </option>

                <option value="Doing">
                  Doing
                </option>

                {/* NEW: ON HOLD */}

                <option value="On Hold">
                  On Hold
                </option>

                <option value="Completed">
                  Completed
                </option>
              </select>
            </div>

            {/* PRIORITY */}

            <div>
              <label className="mb-1 block font-medium text-gray-700 dark:text-gray-300">
                Priority
              </label>

              <select
                value={taskForm.priority}
                disabled={isLoading}
                onChange={(e) =>
                  setTaskForm((prev) => ({
                    ...prev,
                    priority:
                      e.target.value as PriorityType,
                  }))
                }
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 focus:border-black focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white disabled:opacity-50"
              >
                <option value="Urgent">
                  Urgent
                </option>

                <option value="High">
                  High
                </option>

                <option value="Medium">
                  Medium
                </option>

                <option value="Low">
                  Low
                </option>

                <option value="No Priority">
                  No Priority
                </option>
              </select>
            </div>
          </div>

          {/* ==================================================
              DUE DATE + ASSIGNEE
          ================================================== */}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

            {/* DUE DATE */}

            <div>
              <label className="mb-1 block font-medium text-gray-700 dark:text-gray-300">
                Due Date
              </label>

              <input
                type="date"
                required
                disabled={isLoading}
                value={formatDateForPicker(
                  taskForm.dueDate
                )}
                onChange={(e) => {
                  const selectedDate =
                    e.target.value;

                  const formattedDate =
                    formatDateForStorage(
                      selectedDate
                    );

                  setTaskForm((prev) => ({
                    ...prev,
                    dueDate:
                      formattedDate,
                  }));
                }}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-black focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white disabled:opacity-50"
              />

              {taskForm.dueDate && (
                <p className="mt-1 text-[10px] text-gray-400">
                  Stored as: {taskForm.dueDate}
                </p>
              )}
            </div>

            {/* ASSIGNEE */}

            <div>
              <label className="mb-1 block font-medium text-gray-700 dark:text-gray-300">
                Members / Assignee
              </label>

              <select
                value={taskForm.assignee}
                disabled={isLoading}
                onChange={(e) =>
                  setTaskForm((prev) => ({
                    ...prev,
                    assignee:
                      e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 focus:border-black focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white disabled:opacity-50"
              >
                <option value="">
                  Select team member...
                </option>

                {safeTeamMembers.length > 0 ? (
                  safeTeamMembers.map(
                    (member, index) => {
                      const displayName =
                        member.name ||
                        member.email;

                      return (
                        <option
                          key={
                            member.id ||
                            index
                          }
                          value={
                            displayName
                          }
                        >
                          {displayName}
                        </option>
                      );
                    }
                  )
                ) : (
                  <option
                    value=""
                    disabled
                  >
                    No team members available
                  </option>
                )}
              </select>
            </div>
          </div>

          {/* ==================================================
              LABELS + REPORTER
          ================================================== */}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

            {/* LABELS */}

            <div>
              <label className="mb-1 block font-medium text-gray-700 dark:text-gray-300">
                Labels (comma separated)
              </label>

              <input
                type="text"
                placeholder="e.g. Deployment, Testing"
                disabled={isLoading}
                value={taskForm.tagsInput}
                onChange={(e) =>
                  setTaskForm((prev) => ({
                    ...prev,
                    tagsInput:
                      e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-black focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white disabled:opacity-50"
              />
            </div>

            {/* REPORTER */}

            <div>
              <label className="mb-1 block font-medium text-gray-700 dark:text-gray-300">
                Reporter
              </label>

              <select
                value={taskForm.reporter}
                disabled={isLoading}
                onChange={(e) =>
                  setTaskForm((prev) => ({
                    ...prev,
                    reporter:
                      e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 focus:border-black focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white disabled:opacity-50"
              >
                <option value="">
                  Select reporter...
                </option>

                {safeTeamMembers.length > 0 ? (
                  safeTeamMembers.map(
                    (member, index) => {
                      const displayName =
                        member.name ||
                        member.email;

                      return (
                        <option
                          key={
                            member.id ||
                            index
                          }
                          value={
                            displayName
                          }
                        >
                          {displayName}
                        </option>
                      );
                    }
                  )
                ) : (
                  <option
                    value=""
                    disabled
                  >
                    No team members available
                  </option>
                )}
              </select>
            </div>
          </div>

          {/* ==================================================
              BUTTONS
          ================================================== */}

          <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-zinc-800">

            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-lg px-4 py-2 font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-800 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className="rounded-lg bg-black px-4 py-2 font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black disabled:opacity-50"
            >
              {isLoading
                ? "Saving..."
                : "Save Task"}
            </button>

          </div>
        </form>
      </div>
    </div>
  );
}