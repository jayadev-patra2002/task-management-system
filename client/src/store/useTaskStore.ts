import { TaskItem } from "@/types/task-types";
import { create } from "zustand";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000/api";

/* ============================================================
   STORE TYPES
============================================================ */

interface TaskState {
  /* -----------------------------
     STATE
  ----------------------------- */

  tasks: TaskItem[];

  searchQuery: string;

  selectedStatus: string;

  loading: boolean;

  error: string | null;

  /* -----------------------------
     BASIC STATE ACTIONS
  ----------------------------- */

  setTasks: (tasks: TaskItem[]) => void;

  setSearchQuery: (query: string) => void;

  setSelectedStatus: (status: string) => void;

  /* -----------------------------
     BACKEND TASK ACTIONS
  ----------------------------- */

  loadWorkspaceTasks: (
    workspaceName: string,
    userId: string
  ) => Promise<void>;

  addTask: (
    task: TaskItem,
    workspaceName: string,
    userId: string
  ) => Promise<TaskItem | null>;

  updateTask: (
    updatedTask: TaskItem,
    workspaceName: string,
    userId: string
  ) => Promise<TaskItem | null>;

  deleteTask: (
    taskId: string,
    workspaceName: string,
    userId: string
  ) => Promise<boolean>;

  /* -----------------------------
     LOCAL / REALTIME HELPERS
  ----------------------------- */

  applyTaskUpdate: (
    updatedTask: TaskItem
  ) => void;

  removeTask: (
    taskId: string
  ) => void;

  clearError: () => void;
}

/* ============================================================
   API RESPONSE HELPERS
============================================================ */

/**
 * The backend returns Task objects that should match
 * the frontend TaskItem structure.
 *
 * Keeping this helper here means we don't need `any`
 * or unsafe casts throughout the store.
 */
function isTaskItem(value: unknown): value is TaskItem {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const task = value as Record<string, unknown>;

  return (
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    typeof task.status === "string" &&
    typeof task.priority === "string" &&
    typeof task.assignee === "string" &&
    typeof task.dueDate === "string"
  );
}

/**
 * Safely convert an unknown API response
 * into TaskItem[].
 */
function parseTaskList(
  value: unknown
): TaskItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isTaskItem);
}

/**
 * Safely convert an unknown API response
 * into one TaskItem.
 */
function parseTask(
  value: unknown
): TaskItem {
  if (!isTaskItem(value)) {
    throw new Error(
      "Invalid task data received from server."
    );
  }

  return value;
}

/**
 * Extract an error message from an unknown
 * server response.
 */
async function getResponseError(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const data: unknown =
      await response.json();

    if (
      typeof data === "object" &&
      data !== null
    ) {
      const body =
        data as Record<string, unknown>;

      if (
        typeof body.message === "string"
      ) {
        return body.message;
      }

      if (
        typeof body.error === "string"
      ) {
        return body.error;
      }
    }
  } catch {
    // Response wasn't JSON.
  }

  return fallback;
}

/* ============================================================
   ZUSTAND STORE
============================================================ */

export const useTaskStore =
  create<TaskState>((set) => ({
    /* ========================================================
       INITIAL STATE
    ======================================================== */

    tasks: [],

    searchQuery: "",

    selectedStatus: "ALL",

    loading: false,

    error: null,

    /* ========================================================
       BASIC STATE ACTIONS
    ======================================================== */

    setTasks: (
      tasks: TaskItem[]
    ) => {
      set({
        tasks,
        error: null,
      });
    },

    setSearchQuery: (
      query: string
    ) => {
      set({
        searchQuery: query,
      });
    },

    setSelectedStatus: (
      status: string
    ) => {
      set({
        selectedStatus: status,
      });
    },

    /* ========================================================
       LOAD TASKS
       
       GET /api/tasks?userId=USER_ID
    ======================================================== */

    loadWorkspaceTasks: async (
      workspaceName: string,
      userId: string
    ): Promise<void> => {
      if (!userId) {
        set({
          tasks: [],
          loading: false,
          error: "User ID is required.",
        });

        return;
      }

      set({
        loading: true,
        error: null,
      });

      try {
        const response =
          await fetch(
            `${API_URL}/tasks?userId=${encodeURIComponent(
              userId
            )}`,
            {
              method: "GET",
              headers: {
                "Content-Type":
                  "application/json",
              },
              cache: "no-store",
            }
          );

        if (!response.ok) {
          const message =
            await getResponseError(
              response,
              `Failed to load tasks (${response.status})`
            );

          throw new Error(message);
        }

        const data: unknown =
          await response.json();

        const tasks =
          parseTaskList(data);

        set({
          tasks,
          loading: false,
          error: null,
        });

        /*
         * workspaceName is currently not sent to
         * the backend because your current
         * TasksController uses userId.
         *
         * It remains in the function signature
         * for future workspace/team support.
         */
        void workspaceName;
      } catch (error: unknown) {
        console.error(
          "Failed to load workspace tasks:",
          error
        );

        set({
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to load tasks.",
        });
      }
    },

    /* ========================================================
       CREATE TASK
       
       POST /api/tasks
    ======================================================== */

    addTask: async (
      task: TaskItem,
      workspaceName: string,
      userId: string
    ): Promise<TaskItem | null> => {
      if (!userId) {
        set({
          error: "User ID is required.",
        });

        return null;
      }

      set({
        loading: true,
        error: null,
      });

      try {
        /*
         * Don't send the frontend-only id if the
         * database generates the task ID.
         */
        const {
          id: _id,
          ...taskData
        } = task;

        const response =
          await fetch(
            `${API_URL}/tasks`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                ...taskData,
                userId,
              }),
            }
          );

        if (!response.ok) {
          const message =
            await getResponseError(
              response,
              `Failed to create task (${response.status})`
            );

          throw new Error(message);
        }

        const data: unknown =
          await response.json();

        const createdTask =
          parseTask(data);

        set((state) => ({
          tasks: [
            createdTask,
            ...state.tasks,
          ],

          loading: false,

          error: null,
        }));

        void workspaceName;

        return createdTask;
      } catch (error: unknown) {
        console.error(
          "Failed to create task:",
          error
        );

        set({
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to create task.",
        });

        return null;
      }
    },

    /* ========================================================
       UPDATE TASK
       
       PUT /api/tasks/:id
    ======================================================== */

    updateTask: async (
      updatedTask: TaskItem,
      workspaceName: string,
      userId: string
    ): Promise<TaskItem | null> => {
      if (!updatedTask.id) {
        set({
          error: "Task ID is required.",
        });

        return null;
      }

      if (!userId) {
        set({
          error: "User ID is required.",
        });

        return null;
      }

      set({
        loading: true,
        error: null,
      });

      try {
        const response =
          await fetch(
            `${API_URL}/tasks/${encodeURIComponent(
              updatedTask.id
            )}`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                userId,

                title:
                  updatedTask.title,

                description:
                  updatedTask.description ||
                  "",

                status:
                  updatedTask.status,

                priority:
                  updatedTask.priority,

                assignee:
                  updatedTask.assignee,

                avatarType:
                  updatedTask.avatarType ||
                  "text",

                dueDate:
                  updatedTask.dueDate,

                reporter:
                  updatedTask.reporter ||
                  "",

                tags:
                  updatedTask.tags || [],
              }),
            }
          );

        if (!response.ok) {
          const message =
            await getResponseError(
              response,
              `Failed to update task (${response.status})`
            );

          throw new Error(message);
        }

        const data: unknown =
          await response.json();

        const savedTask =
          parseTask(data);

        set((state) => ({
          tasks: state.tasks.map(
            (task) =>
              task.id === savedTask.id
                ? savedTask
                : task
          ),

          loading: false,

          error: null,
        }));

        set({
          loading: false,
          error: null,
        });

        void workspaceName;

        return savedTask;
      } catch (error: unknown) {
        console.error(
          "Failed to update task:",
          error
        );

        set({
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to update task.",
        });

        return null;
      }
    },

    /* ========================================================
       DELETE TASK
       
       DELETE /api/tasks/:id
       
       Current backend expects userId
       in the request body.
    ======================================================== */

    deleteTask: async (
      taskId: string,
      workspaceName: string,
      userId: string
    ): Promise<boolean> => {
      if (!taskId) {
        set({
          error: "Task ID is required.",
        });

        return false;
      }

      if (!userId) {
        set({
          error: "User ID is required.",
        });

        return false;
      }

      set({
        loading: true,
        error: null,
      });

      try {
        const response =
          await fetch(
            `${API_URL}/tasks/${encodeURIComponent(
              taskId
            )}`,
            {
              method: "DELETE",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                userId,
              }),
            }
          );

        if (!response.ok) {
          const message =
            await getResponseError(
              response,
              `Failed to delete task (${response.status})`
            );

          throw new Error(message);
        }

        set((state) => ({
          tasks:
            state.tasks.filter(
              (task) =>
                task.id !== taskId
            ),

          loading: false,

          error: null,
        }));

        void workspaceName;

        return true;
      } catch (error: unknown) {
        console.error(
          "Failed to delete task:",
          error
        );

        set({
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to delete task.",
        });

        return false;
      }
    },

    /* ========================================================
       APPLY REAL-TIME TASK UPDATE
       
       Future WebSocket usage:
       
       task.updated
            ↓
       applyTaskUpdate()
            ↓
       Zustand
            ↓
       Dashboard UI
    ======================================================== */

    applyTaskUpdate: (
      updatedTask: TaskItem
    ): void => {
      set((state) => {
        const exists =
          state.tasks.some(
            (task) =>
              task.id ===
              updatedTask.id
          );

        if (!exists) {
          return {
            tasks: [
              updatedTask,
              ...state.tasks,
            ],
          };
        }

        return {
          tasks:
            state.tasks.map(
              (task) =>
                task.id ===
                updatedTask.id
                  ? updatedTask
                  : task
            ),
        };
      });
    },

    /* ========================================================
       REMOVE TASK FROM LOCAL STATE
    ======================================================== */

    removeTask: (
      taskId: string
    ): void => {
      set((state) => ({
        tasks:
          state.tasks.filter(
            (task) =>
              task.id !== taskId
          ),
      }));
    },

    /* ========================================================
       CLEAR ERROR
    ======================================================== */

    clearError: (): void => {
      set({
        error: null,
      });
    },
  }));