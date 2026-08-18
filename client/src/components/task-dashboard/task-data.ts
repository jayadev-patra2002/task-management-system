import {
  TaskItem,
  ColumnVisibility,
  TaskFormData,
} from "../../types/task-types";

export const initialTasks: TaskItem[] = [];

export const defaultColumns: ColumnVisibility = {
  priority: true,
  members: true,
  dueDate: true,
  labels: true,
  status: false,
  reporter: false,
};

export const defaultTaskForm: TaskFormData = {
  title: "",
  description: "",
  status: "To Do",
  priority: "Medium",
  assignee: "A",
  dueDate: "",
  tagsInput: "Deployment",
  reporter: "",
};

export const sections: Array<
  "To Do" | "Doing" | "On Hold" | "Completed"
> = [
  "To Do",
  "Doing",
  "On Hold",
  "Completed",
];