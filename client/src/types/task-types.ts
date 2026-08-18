export type PriorityType = "No Priority" | "Urgent" | "High" | "Medium" | "Low";
export type TaskStatus = "To Do" | "Doing" | "On Hold" | "Completed";

export interface Subtask {
  id?: string;
  title: string;
  completed?: boolean;
  priority?: PriorityType;
  assignee?: string;
  dueDate?: string;
}

export interface TaskResource {
  id: string;
  name: string;
  url: string;
  userId?: string;
  createdAt?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: PriorityType;
  assignee: string;
  startDate?: string;
  dueDate: string;
  tags?: string[];
  labels?: string[];
  reporter?: string;
  subtasks?: Subtask[];
  resources?: TaskResource[];
  avatarType?: string;
  isLocked?: boolean;
  lockedByUserId?: string | null;
  lockedBy?: string | null;
}

export interface ColumnVisibility {
  priority: boolean;
  members: boolean;
  dueDate: boolean;
  labels: boolean;
  status: boolean;
  reporter: boolean;
}

export interface TaskFormData {
  title: string;
  description: string;
  status: TaskStatus;
  priority: PriorityType;
  assignee: string;
  dueDate: string;
  tagsInput: string;
  reporter: string;
  isLocked?: boolean;
}