export const PROJECT_PRIORITIES = [
  "No Priority",
  "Urgent",
  "High",
  "Medium",
  "Low",
] as const;

export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];

export const PROJECT_STATUSES = [
  "To Do",
  "In Progress",
  "On Hold",
  "Completed",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface ProjectLead {
  id: string;
  name: string | null;
  email: string;
  avatar: string | null;
}

export interface ProjectTaskSummary {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee: string | null;
  dueDate: string | null;
}

export interface ProjectItem {
  id: string;
  name: string;
  priority: ProjectPriority;
  status: ProjectStatus;
  dueDate: string | null;
  lead: ProjectLead | null;
  taskCount: number;
  tasks: ProjectTaskSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  avatar: string | null;
}

export interface ProjectFormValues {
  name: string;
  priority: ProjectPriority;
  status: ProjectStatus;
  leadId: string;
  dueDate: string;
}

export const emptyProjectForm: ProjectFormValues = {
  name: "",
  priority: "Medium",
  status: "To Do",
  leadId: "",
  dueDate: "",
};
