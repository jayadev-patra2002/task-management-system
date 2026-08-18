"use client";

import { CalendarDays, FolderKanban, X } from "lucide-react";
import { FormEvent } from "react";

import {
    PROJECT_PRIORITIES,
    PROJECT_STATUSES,
    ProjectFormValues,
    TeamMember,
} from "../../types/project-types";

interface ProjectFormModalProps {
  isOpen: boolean;
  isSaving: boolean;
  values: ProjectFormValues;
  members: TeamMember[];
  mode: "create" | "edit";
  onChange: (values: ProjectFormValues) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export default function ProjectFormModal({
  isOpen,
  isSaving,
  values,
  members,
  mode,
  onChange,
  onClose,
  onSubmit,
}: ProjectFormModalProps) {
  if (!isOpen) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-200">
              <FolderKanban className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{mode === "create" ? "Add project" : "Edit project"}</h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">Keep the workspace aligned around a clear goal.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} aria-label="Close project form" className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-zinc-300">Project name</label>
            <input autoFocus required maxLength={120} value={values.name} onChange={(event) => onChange({ ...values, name: event.target.value })} placeholder="e.g. Design Homepage" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[var(--app-accent)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-zinc-300">Priority</label>
              <select value={values.priority} onChange={(event) => onChange({ ...values, priority: event.target.value as ProjectFormValues["priority"] })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[var(--app-accent)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">
                {PROJECT_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-zinc-300">Project lead</label>
              <select value={values.leadId} onChange={(event) => onChange({ ...values, leadId: event.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[var(--app-accent)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">
                <option value="">No lead</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name || member.email}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-zinc-300">Status</label>
              <select value={values.status} onChange={(event) => onChange({ ...values, status: event.target.value as ProjectFormValues["status"] })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[var(--app-accent)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">
                {PROJECT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-zinc-300"><CalendarDays className="h-3.5 w-3.5" />Due date</label>
              <input type="date" value={values.dueDate} onChange={(event) => onChange({ ...values, dueDate: event.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[var(--app-accent)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-zinc-800">
          <button type="button" onClick={onClose} disabled={isSaving} className="rounded-lg px-3 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800">Cancel</button>
          <button type="submit" disabled={isSaving || !values.name.trim()} className="rounded-lg bg-[var(--app-accent)] px-3 py-2 text-xs font-semibold text-[var(--app-accent-foreground)] transition hover:bg-[var(--app-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? "Saving..." : mode === "create" ? "Add project" : "Save changes"}</button>
        </div>
      </form>
    </div>
  );
}
