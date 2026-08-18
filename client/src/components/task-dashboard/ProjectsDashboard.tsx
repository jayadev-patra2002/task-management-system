"use client";

import React, {
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";

import {
    Building2,
    CalendarDays,
    Check,
    ChevronRight,
    Circle,
    PanelLeft,
    SignalHigh,
    SignalLow,
    SignalMedium,
    Tag,
    UserRound,
    UsersRound,
} from "lucide-react";

import {
    connectSocket,
    disconnectSocket,
} from "@/lib/socket";

import Sidebar from "@/components/shared/sidebar";
import TaskDetailsModal from "@/components/tasks/task-details-modal";

import CreateTaskModal from "./CreateTaskModal";
import TaskBoardView from "./TaskBoardView";
import TaskListView from "./TaskListView";
import TaskToolbar from "./TaskToolbar";

import {
    TaskFormData,
    TaskItem,
} from "../../types/task-types";

import {
    defaultColumns,
    defaultTaskForm,
} from "./task-data";

import { useTaskStore } from "@/store/useTaskStore";

interface TeamMember {
  id?: string;
  name?: string;
  email: string;
}

interface TaskLockUpdatedPayload {
  taskId: string;
  teamId: string;
  locked: boolean;
  lock: {
    taskId: string;
    userId: string;
    userName: string;
  } | null;
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000/api";

/* ================================================================
   BROWSER SESSION STORAGE HOOK

   Reads localStorage without using setState inside an effect and
   without reading localStorage directly during the initial SSR render.
   This avoids both hydration mismatches and React cascading-render
   warnings.
================================================================ */

const subscribeToStorage = (callback: () => void) => {
  const handleStorage = () => callback();

  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener("storage", handleStorage);
  };
};

const getStorageValue = (key: string): string | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage.getItem(key) ?? undefined;
};

const getServerStorageValue = (): string | undefined => {
  return undefined;
};

const useLocalStorageValue = (key: string): string | undefined => {
  return useSyncExternalStore(
    subscribeToStorage,
    () => getStorageValue(key),
    getServerStorageValue
  );
};

/* ================================================================
   TEAM MEMBER VALIDATION
================================================================ */

const isTeamMember = (
  value: unknown
): value is TeamMember => {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const member =
    value as Record<string, unknown>;

  return typeof member.email === "string";
};

/* ================================================================
   PARSE TEAM MEMBERS
================================================================ */

const parseTeamMembers = (
  data: unknown
): TeamMember[] => {
  if (Array.isArray(data)) {
    return data.filter(isTeamMember);
  }

  if (
    typeof data !== "object" ||
    data === null
  ) {
    return [];
  }

  const response =
    data as Record<string, unknown>;

  const possibleLists = [
    response.users,
    response.data,
    response.members,
  ];

  for (const list of possibleLists) {
    if (Array.isArray(list)) {
      return list.filter(isTeamMember);
    }
  }

  return [];
};

/* ================================================================
   ERROR MESSAGE HELPER
================================================================ */

const getApiErrorMessage = (
  errorData: unknown,
  fallback: string
): string => {
  if (
    typeof errorData !== "object" ||
    errorData === null
  ) {
    return fallback;
  }

  const error =
    errorData as Record<string, unknown>;

  if (typeof error.message === "string") {
    return error.message;
  }

  if (typeof error.error === "string") {
    return error.error;
  }

  return fallback;
};

/* ================================================================
   PROJECTS DASHBOARD
================================================================ */

interface ProjectsDashboardProps {
  projectId?: string;
  projectName?: string;
}

export default function ProjectsDashboard({
  projectId,
  projectName,
}: ProjectsDashboardProps = {}) {
  /* ==============================================================
     GLOBAL TASK STORE
  ============================================================== */

  const tasks = useTaskStore(
    (state) => state.tasks
  );

  const setStoreTasks = useTaskStore(
    (state) => state.setTasks
  );

  /* ==============================================================
     CURRENT USER / TEAM

     IMPORTANT:

     These values come from localStorage through useSyncExternalStore.
     We do NOT use useEffect + setState, and we do NOT read refs during
     render. This avoids both the React cascading-render warning and
     the "Cannot access refs during render" error.

     The hook returns string | undefined, which matches
     TaskDetailsModalProps.
  ============================================================== */

  const currentUserId =
    useLocalStorageValue("userId");

  const usernameValue =
    useLocalStorageValue("username");

  const userNameValue =
    useLocalStorageValue("userName");

  const currentUsername =
    usernameValue ?? userNameValue;

  const currentTeamId =
    useLocalStorageValue("teamId");

  /* ==============================================================
     TEAM MEMBERS
  ============================================================== */

  const [
    teamMembers,
    setTeamMembers,
  ] = useState<TeamMember[]>([]);

  /* ==============================================================
     TOOLBAR
  ============================================================== */

  const [
    isFieldsOpen,
    setIsFieldsOpen,
  ] = useState(false);

  const [
    viewMode,
    setViewMode,
  ] = useState<"list" | "board">("list");

  const [
    searchQuery,
    setSearchQuery,
  ] = useState("");

  /* ==============================================================
     FILTER STATE
  ============================================================== */

  type TaskFilterCategory =
    | "Status"
    | "Priority"
    | "Members"
    | "Due Date"
    | "Teams"
    | "Labels"
    | "Reporter";

  const [taskFilterValues, setTaskFilterValues] =
    useState<Record<TaskFilterCategory, string>>({
      Status: "all",
      Priority: "all",
      Members: "all",
      "Due Date": "all",
      Teams: "all",
      Labels: "all",
      Reporter: "all",
    });

  const [taskFilterMenu, setTaskFilterMenu] = useState<{
    open: boolean;
    category: TaskFilterCategory | null;
    left: number;
    top: number;
  }>({
    open: false,
    category: null,
    left: 0,
    top: 0,
  });

  const taskFilterMenuRef =
    useRef<HTMLDivElement | null>(null);

  /* ==============================================================
     GROUP STATE
  ============================================================== */

  const [
    collapsedGroups,
    setCollapsedGroups,
  ] = useState<Record<string, boolean>>({});

  /* ==============================================================
     SELECTED TASK
  ============================================================== */

  const [
    selectedTask,
    setSelectedTask,
  ] = useState<TaskItem | null>(null);

  /* ==============================================================
     SIDEBAR
  ============================================================== */

  const [
    isSidebarOpen,
    setIsSidebarOpen,
  ] = useState(true);

  /* ==============================================================
     CREATE / EDIT TASK MODAL
  ============================================================== */

  const [
    isModalOpen,
    setIsModalOpen,
  ] = useState(false);

  const [
    editingTask,
    setEditingTask,
  ] = useState<TaskItem | null>(null);

  const [
    taskForm,
    setTaskForm,
  ] = useState<TaskFormData>(
    defaultTaskForm
  );

  /* ==============================================================
     COLUMNS
  ============================================================== */

  const [
    columns,
    setColumns,
  ] = useState(defaultColumns);

  /* ==============================================================
     REFS
  ============================================================== */

  const fieldsRef =
    useRef<HTMLDivElement | null>(null);

  /* ==============================================================
     SELECTED TASK DERIVED FROM STORE

     We do NOT call setSelectedTask() inside an effect.

     Whenever Zustand tasks change, the latest version of the
     selected task is derived during render.
  ============================================================== */

  const synchronizedSelectedTask =
    selectedTask
      ? tasks.find(
          (task) =>
            task.id === selectedTask.id
        ) ?? null
      : null;

  /* ==============================================================
     LOAD TASKS + TEAM MEMBERS + USER SESSION
  ============================================================== */

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const userId =
          localStorage.getItem("userId");

        const token =
          localStorage.getItem("authToken");

        if (!userId) {
          console.warn(
            "No userId found. Cannot load server data."
          );

          return;
        }

        /* ========================================================
           LOAD TASKS
        ======================================================== */

        const tasksResponse =
          await fetch(
            `${API_URL}/tasks?userId=${encodeURIComponent(
              userId
            )}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ""}`,
            {
              method: "GET",
              cache: "no-store",
              headers: {
                "Content-Type":
                  "application/json",

                ...(token
                  ? {
                      Authorization: `Bearer ${token}`,
                    }
                  : {}),
              },
            }
          );

        if (tasksResponse.ok) {
          const tasksData: unknown =
            await tasksResponse.json();

          if (
            mounted &&
            Array.isArray(tasksData)
          ) {
            setStoreTasks(
              tasksData as TaskItem[]
            );
          }
        } else {
          console.warn(
            "Failed to load tasks:",
            tasksResponse.status
          );
        }

        /* ========================================================
           LOAD TEAM MEMBERS
        ======================================================== */

        const usersResponse =
          await fetch(
            `${API_URL}/auth/team/members`,
            {
              method: "GET",

              headers: {
                ...(token
                  ? {
                      Authorization: `Bearer ${token}`,
                    }
                  : {}),
              },
            }
          );

        if (usersResponse.ok) {
          const usersData: unknown =
            await usersResponse.json();

          console.log(
            "RAW TEAM MEMBERS API RESPONSE:",
            usersData
          );

          const membersList =
            parseTeamMembers(
              usersData
            );

          if (mounted) {
            setTeamMembers(
              membersList
            );
          }
        } else {
          console.warn(
            "Failed to fetch team members:",
            usersResponse.status
          );
        }
      } catch (error) {
        console.error(
          "Failed to load dashboard data:",
          error
        );
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [setStoreTasks]);

  /* ==============================================================
     REALTIME TASK SYNCHRONIZATION
  ============================================================== */

  useEffect(() => {
    const userId = localStorage.getItem("userId");
const teamId = localStorage.getItem("teamId");

console.log("DEBUG - Retrieved Session:", { userId, teamId }); // <-- Add this line

if (!userId || !teamId) {
  console.warn("[Realtime] Connection skipped: userId or teamId missing.");
  return;
}

    /* ============================================================
       CONNECT SOCKET
    ============================================================ */

    const socket = connectSocket();

    console.log(
      "[Realtime] Connecting with:",
      {
        userId,
        teamId,
      }
    );

    /* ============================================================
       JOIN TEAM ROOM
    ============================================================ */

    socket.emit("team.join", {
      teamId,
      userId,
    });

    console.log(
      "[Realtime] Joined team:",
      {
        teamId,
        userId,
      }
    );

    /* ============================================================
       TASK CREATED
    ============================================================ */

    const handleTaskCreated = (data: {
      task: TaskItem;
      userId: string;
    }) => {
      console.log(
        "Realtime task.created:",
        data
      );

      if (!data?.task) {
        return;
      }

      const currentTasks =
        useTaskStore.getState().tasks;

      const alreadyExists =
        currentTasks.some(
          (task) =>
            task.id === data.task.id
        );

      if (alreadyExists) {
        return;
      }

      setStoreTasks([
        data.task,
        ...currentTasks,
      ]);
    };

    /* ============================================================
       TASK UPDATED
    ============================================================ */

    const handleTaskUpdated = (data: {
      task: TaskItem;
      userId: string;
    }) => {
      console.log(
        "Realtime task.updated:",
        data
      );

      if (!data?.task) {
        return;
      }

      const currentTasks =
        useTaskStore.getState().tasks;

      setStoreTasks(
        currentTasks.map(
          (task) =>
            task.id === data.task.id
              ? data.task
              : task
        )
      );
    };

    /* ============================================================
       TASK LOCK UPDATED
    ============================================================ */

    const handleTaskLockUpdated = (
      data: TaskLockUpdatedPayload
    ) => {
      console.log("Realtime task.lock.updated:", data);

      if (!data?.taskId) return;
      if (String(data.teamId) !== String(teamId)) return;

      const currentTasks =
        useTaskStore.getState().tasks;

      setStoreTasks(
        currentTasks.map((task) =>
          task.id === data.taskId
            ? {
                ...task,
                isLocked: data.locked,
                lockedByUserId: data.lock?.userId,
                lockedBy: data.lock?.userName,
              }
            : task
        )
      );
    };

    /* ============================================================
       TASK DELETED
    ============================================================ */

    const handleTaskDeleted = (data: {
      taskId: string;
      userId: string;
    }) => {
      console.log(
        "Realtime task.deleted:",
        data
      );

      if (!data?.taskId) {
        return;
      }

      const currentTasks =
        useTaskStore.getState().tasks;

      setStoreTasks(
        currentTasks.filter(
          (task) =>
            task.id !== data.taskId
        )
      );
    };
/* ============================================================
        REGISTER LISTENERS
    ============================================================ */

    socket.on(
      "task.created",
      handleTaskCreated
    );

    socket.on(
      "task.updated",
      handleTaskUpdated
    );

    socket.on(
      "task.lock.updated",
      handleTaskLockUpdated
    );

    socket.on(
      "task.deleted",
      handleTaskDeleted
    );

    /* ============================================================
        CLEANUP
    ============================================================ */

    return () => {
      socket.off(
        "task.created",
        handleTaskCreated
      );

      socket.off(
        "task.updated",
        handleTaskUpdated
      );

      socket.off(
        "task.lock.updated",
        handleTaskLockUpdated
      );

      socket.off(
        "task.deleted",
        handleTaskDeleted
      );

      socket.emit("team.leave", {
        teamId,
        userId,
      });

      disconnectSocket();
    };
  }, [
    setStoreTasks,
    currentUserId,
    currentTeamId,
    currentUsername,
  ]);

  /* ==============================================================
     SAME-BROWSER STORAGE SYNCHRONIZATION
  ============================================================== */

  useEffect(() => {
    const handleStorage = (
      event: StorageEvent
    ) => {
      if (
        !event.key ||
        !event.key.startsWith(
          "workspace_tasks_"
        )
      ) {
        return;
      }

      if (!event.newValue) {
        return;
      }

      try {
        const parsedValue: unknown =
          JSON.parse(event.newValue);

        if (
          Array.isArray(parsedValue)
        ) {
          setStoreTasks(
            parsedValue as TaskItem[]
          );
        }
      } catch (error) {
        console.error(
          "Failed to synchronize tasks from storage:",
          error
        );
      }
    };

    window.addEventListener(
      "storage",
      handleStorage
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleStorage
      );
    };
  }, [setStoreTasks]);

  /* ==============================================================
     FILTER MENU OUTSIDE CLICK
  ============================================================== */

  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (
        taskFilterMenuRef.current &&
        !taskFilterMenuRef.current.contains(target)
      ) {
        setTaskFilterMenu((previous) => ({
          ...previous,
          open: false,
          category: null,
        }));
      }
    };

    document.addEventListener(
      "mousedown",
      handleDocumentMouseDown,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleDocumentMouseDown,
      );
    };
  }, []);

  /* ==============================================================
     KEYBOARD SHORTCUT
  ============================================================== */

  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (
        (event.metaKey ||
          event.ctrlKey) &&
        event.key.toLowerCase() === "f"
      ) {
        event.preventDefault();

        document
          .getElementById(
            "task-search-input"
          )
          ?.focus();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, []);

  /* ==============================================================
     DATE NORMALIZATION
  ============================================================== */

  const normalizeDueDate = (
    dateString: string
  ): string => {
    if (!dateString) {
      return "";
    }

    if (
      /^\d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$/.test(
        dateString
      )
    ) {
      return dateString;
    }

    if (
      /^\d{4}-\d{2}-\d{2}$/.test(
        dateString
      )
    ) {
      const [
        year,
        month,
        day,
      ] = dateString.split("-");

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

      const monthIndex =
        Number(month) - 1;

      if (
        monthIndex >= 0 &&
        monthIndex < 12
      ) {
        return `${day} ${months[monthIndex]} ${year}`;
      }
    }

    return dateString;
  };

  /* ==============================================================
     OPEN CREATE TASK
  ============================================================== */

  const openCreateTaskModal =
    () => {
      setEditingTask(null);

      setTaskForm({
        ...defaultTaskForm,
      });

      setIsModalOpen(true);
    };

  /* ==============================================================
     OPEN EDIT TASK
  ============================================================== */

  const handleEditTask = (
    task: TaskItem
  ) => {
    setEditingTask(task);

    setTaskForm({
      title: task.title || "",

      description:
        task.description || "",

      status:
        task.status || "To Do",

      priority:
        task.priority || "Medium",

      assignee:
        task.assignee || "",

      dueDate:
        task.dueDate || "",

      tagsInput:
        Array.isArray(task.tags)
          ? task.tags.join(", ")
          : "",

      reporter:
        task.reporter || "",

      isLocked:
        task.isLocked || false,
    });

    setIsModalOpen(true);
  };

  /* ==============================================================
     DELETE TASK
  ============================================================== */

  const handleDeleteTask =
    async (
      task: TaskItem
    ) => {
      const confirmed =
        window.confirm(
          `Are you sure you want to delete "${task.title}"?`
        );

      if (!confirmed) {
        return;
      }

      try {
        const userId =
          localStorage.getItem(
            "userId"
          );

        const token =
          localStorage.getItem(
            "authToken"
          );

        if (!userId) {
          throw new Error(
            "User session not found."
          );
        }

        const response =
          await fetch(
            `${API_URL}/tasks/${encodeURIComponent(
              task.id
            )}`,
            {
              method: "DELETE",

              headers: {
                "Content-Type":
                  "application/json",

                ...(token
                  ? {
                      Authorization: `Bearer ${token}`,
                    }
                  : {}),
              },

              body: JSON.stringify({
                userId,
              }),
            }
          );

        if (!response.ok) {
          const errorData: unknown =
            await response
              .json()
              .catch(() => null);

          throw new Error(
            getApiErrorMessage(
              errorData,
              "Failed to delete task"
            )
          );
        }

        /* ========================================================
            UPDATE ZUSTAND
        ======================================================== */

        const currentTasks =
          useTaskStore.getState().tasks;

        setStoreTasks(
          currentTasks.filter(
            (item) =>
              item.id !== task.id
          )
        );
      } catch (error) {
        console.error(
          "Failed to delete task:",
          error
        );

        alert(
          error instanceof Error
            ? error.message
            : "Failed to delete task"
        );
      }
    };

  /* ==============================================================
     UPDATE TASK FROM DETAILS MODAL
  ============================================================== */

  const handleUpdateTask =
    async (
      updatedTask: TaskItem
    ) => {
      try {
        const userId =
          localStorage.getItem(
            "userId"
          );

        const token =
          localStorage.getItem(
            "authToken"
          );

        if (!userId) {
          throw new Error(
            "User session not found."
          );
        }

        /* ========================================================
            OPTIMISTIC UPDATE
        ======================================================== */

        const currentTasks =
          useTaskStore.getState().tasks;

        const updatedTasks =
          currentTasks.map(
            (item) =>
              item.id ===
              updatedTask.id
                ? updatedTask
                : item
          );

        setStoreTasks(
          updatedTasks
        );

        /* ========================================================
            SERVER UPDATE
        ======================================================== */

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

                ...(token
                  ? {
                      Authorization: `Bearer ${token}`,
                    }
                  : {}),
              },

              body: JSON.stringify({
                userId,

                title:
                  updatedTask.title,

                description:
                  updatedTask.description,

                status:
                  updatedTask.status,

                priority:
                  updatedTask.priority,

                assignee:
                  updatedTask.assignee,

                avatarType:
                  updatedTask.avatarType ||
                  "text",

                startDate:
                  updatedTask.startDate,

                dueDate:
                  updatedTask.dueDate,

                reporter:
                  updatedTask.reporter,

                tags:
                  updatedTask.tags,

                isLocked:
                  updatedTask.isLocked,
              }),
            }
          );

        if (!response.ok) {
          const errorData: unknown =
            await response
              .json()
              .catch(() => null);

          throw new Error(
            getApiErrorMessage(
              errorData,
              "Failed to update task"
            )
          );
        }

        const savedTask: TaskItem =
          await response.json();

   /* ========================================================
            UPDATE STORE WITH SERVER VERSION
        ======================================================== */

        const latestTasks =
          useTaskStore.getState().tasks;

        setStoreTasks(
          latestTasks.map(
            (item) =>
              item.id === savedTask.id
                ? savedTask
                : item
          )
        );
      } catch (error) {
        console.error(
          "Failed to sync task update:",
          error
        );

        /* ========================================================
            RELOAD FROM SERVER
        ======================================================== */

        try {
          const userId =
            localStorage.getItem(
              "userId"
            );

          const token =
            localStorage.getItem(
              "authToken"
            );

          if (userId) {
            const response =
              await fetch(
                `${API_URL}/tasks?userId=${encodeURIComponent(
                  userId
                )}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ""}`,
                {
                  cache: "no-store",

                  headers: {
                    ...(token
                      ? {
                          Authorization: `Bearer ${token}`,
                        }
                      : {}),
                  },
                }
              );

            if (response.ok) {
              const serverTasks: unknown =
                await response.json();

              if (
                Array.isArray(
                  serverTasks
                )
              ) {
                setStoreTasks(
                  serverTasks as TaskItem[]
                );
              }
            }
          }
        } catch (
          reloadError
        ) {
          console.error(
            "Failed to reload tasks:",
            reloadError
          );
        }

        alert(
          error instanceof Error
            ? error.message
            : "Failed to update task"
        );
      }
    };

  /* ==============================================================
     CREATE / UPDATE TASK FORM
  ============================================================== */

  const handleFormSubmit =
    async (
      event: React.FormEvent
    ) => {
      event.preventDefault();

      if (
        !taskForm.title.trim()
      ) {
        return;
      }

      try {
        const userId =
          localStorage.getItem(
            "userId"
          );

        const token =
          localStorage.getItem(
            "authToken"
          );

        if (!userId) {
          alert(
            "User session not found. Please login again."
          );

          return;
        }

        const tagsInputValue: string = String(
          (taskForm as unknown as {
            tagsInput?: unknown;
          }).tagsInput ?? "",
        );

        const tagsArray: string[] = tagsInputValue
          ? tagsInputValue
              .split(",")
              .map((tag: string) => tag.trim())
              .filter((tag: string) => tag.length > 0)
          : [];

        /* ========================================================
            EDIT EXISTING TASK
        ======================================================== */

        if (editingTask) {
          const response =
            await fetch(
              `${API_URL}/tasks/${encodeURIComponent(
                editingTask.id
              )}`,
              {
                method: "PUT",

                headers: {
                  "Content-Type":
                    "application/json",

                  ...(token
                    ? {
                        Authorization: `Bearer ${token}`,
                      }
                    : {}),
                },

                body: JSON.stringify({
                  userId,

                  title:
                    taskForm.title.trim(),

                  description:
                    taskForm.description,

                  status:
                    taskForm.status,

                  priority:
                    taskForm.priority,

                  assignee:
                    taskForm.assignee,

                  avatarType:
                    "text",

                  dueDate:
                    normalizeDueDate(
                      taskForm.dueDate
                    ),

                  reporter:
                    taskForm.reporter,

                  tags:
                    tagsArray,

                  isLocked:
                    taskForm.isLocked,
                }),
              }
            );

          if (!response.ok) {
            const errorData: unknown =
              await response
                .json()
                .catch(
                  () => null
                );

            throw new Error(
              getApiErrorMessage(
                errorData,
                "Failed to update task"
              )
            );
          }

          const updatedTask: TaskItem =
            await response.json();

          const currentTasks =
            useTaskStore.getState().tasks;

          const updatedTasks =
            currentTasks.map(
              (item) =>
                item.id ===
                updatedTask.id
                  ? updatedTask
                  : item
            );

          setStoreTasks(
            updatedTasks
          );

          setIsModalOpen(false);

          setEditingTask(null);

          setTaskForm({
            ...defaultTaskForm,
          });

          return;
        }

        /* ========================================================
            CREATE NEW TASK
        ======================================================== */

        const response =
          await fetch(
            `${API_URL}/tasks`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                ...(token
                  ? {
                      Authorization: `Bearer ${token}`,
                    }
                  : {}),
              },

              body: JSON.stringify({
                userId,
                ...(projectId ? { projectId } : {}),

                title:
                  taskForm.title.trim(),

                description:
                  taskForm.description,

                status:
                  taskForm.status,

                priority:
                  taskForm.priority,

                assignee:
                  taskForm.assignee,

                avatarType:
                  "text",

                dueDate:
                  normalizeDueDate(
                    taskForm.dueDate
                  ),

                reporter:
                  taskForm.reporter,

                tags:
                  tagsArray,
              }),
            }
          );

        if (!response.ok) {
          const errorData: unknown =
            await response
              .json()
              .catch(
                () => null
              );

          throw new Error(
            getApiErrorMessage(
              errorData,
              "Failed to create task"
            )
          );
        }

        const savedTask: TaskItem =
          await response.json();

        const currentTasks =
          useTaskStore.getState().tasks;

        const alreadyExists =
          currentTasks.some(
            (task) =>
              task.id === savedTask.id
          );

        if (!alreadyExists) {
          setStoreTasks([
            savedTask,
            ...currentTasks,
          ]);
        }

        setIsModalOpen(false);

        setTaskForm({
          ...defaultTaskForm,
        });
      } catch (error) {
        console.error(
          "Failed to save task:",
          error
        );

        alert(
          error instanceof Error
            ? error.message
            : "Failed to save task"
        );
      }
    };

  /* ==============================================================
     GROUP TOGGLE
  ============================================================== */

  const toggleGroup = (
    groupId: string
  ) => {
    setCollapsedGroups(
      (previous) => ({
        ...previous,

        [groupId]:
          !previous[groupId],
      })
    );
  };

  /* ==============================================================
     COLUMN TOGGLE
  ============================================================== */

  const toggleColumn = (
    key: keyof typeof columns
  ) => {
    setColumns(
      (previous) => ({
        ...previous,

        [key]: !previous[key],
      })
    );
  };

  /* ==============================================================
     TASK FILTER HELPERS
  ============================================================== */

  const taskFilterCategories: TaskFilterCategory[] = [
    "Status",
    "Priority",
    "Members",
    "Due Date",
    "Teams",
    "Labels",
    "Reporter",
  ];

  const getTaskTeamValue = (task: TaskItem): string => {
    const record = task as unknown as Record<string, unknown>;
    const direct = [
      record.teamId,
      record.teamName,
      record.team,
    ].find((value) => typeof value === "string" && value.trim());
    return typeof direct === "string" ? direct : "";
  };

  const getTaskLabelValues = (task: TaskItem): string[] => {
    const rawTags: unknown = (task as unknown as {
      tags?: unknown;
    }).tags;

    if (Array.isArray(rawTags)) {
      return rawTags
        .map((tag: unknown) =>
          typeof tag === "string" ? tag.trim() : "",
        )
        .filter((tag: string) => tag.length > 0);
    }

    const tagText =
      typeof rawTags === "string"
        ? rawTags
        : "";

    return tagText
      ? tagText
          .split(",")
          .map((tag: string) => tag.trim())
          .filter((tag: string) => tag.length > 0)
      : [];
  };

  /* ==============================================================
     TASK FILTER LOGIC
  ============================================================== */

  const getTaskField = (
    task: TaskItem,
    key: string,
  ): unknown => {
    return (task as unknown as Record<string, unknown>)[key];
  };

  const getTaskText = (
    task: TaskItem,
    keys: string[],
  ): string => {
    for (const key of keys) {
      const value = getTaskField(task, key);

      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }

      if (
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        return String(value);
      }

      if (
        typeof value === "object" &&
        value !== null
      ) {
        const record =
          value as Record<string, unknown>;

        for (const nestedKey of [
          "name",
          "title",
          "label",
          "email",
          "id",
        ]) {
          const nestedValue =
            record[nestedKey];

          if (
            typeof nestedValue === "string" &&
            nestedValue.trim()
          ) {
            return nestedValue.trim();
          }
        }
      }
    }

    return "";
  };

  const getTaskMemberValue = (
    task: TaskItem,
  ): string => {
    return getTaskText(task, [
      "assignee",
      "assigneeId",
      "member",
      "memberId",
      "assignedTo",
      "assignedToId",
    ]);
  };

  const getTaskReporterValue = (
    task: TaskItem,
  ): string => {
    return getTaskText(task, [
      "reporter",
      "reporterId",
      "reportedBy",
    ]);
  };

  const getTaskDueDateValue = (
    task: TaskItem,
  ): string => {
    return getTaskText(task, [
      "dueDate",
    ]);
  };

  const getTaskDueDateBucket = (
    task: TaskItem,
  ): string => {
    const value = getTaskDueDateValue(task);

    if (!value) {
      return "No Due Date";
    }

    let date: Date | null = null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      date = new Date(`${value}T00:00:00`);
    } else {
      const displayMatch =
        value.match(
          /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/,
        );

      if (displayMatch) {
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

        const month =
          months.indexOf(
            displayMatch[2],
          );

        date = new Date(
          Number(displayMatch[3]),
          month,
          Number(displayMatch[1]),
        );
      } else {
        const parsed =
          new Date(value);

        if (!Number.isNaN(parsed.getTime())) {
          date = parsed;
        }
      }
    }

    if (!date || Number.isNaN(date.getTime())) {
      return "No Due Date";
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    if (target < today) {
      return "Overdue";
    }

    if (target.getTime() === today.getTime()) {
      return "Today";
    }

    return "Upcoming";
  };

  const getTaskTeamValueForFilter = (
    task: TaskItem,
  ): string => {
    const value =
      getTaskTeamValue(task);

    return value || "No Team";
  };

  const getTaskLabelValuesForFilter = (
    task: TaskItem,
  ): string[] => {
    return getTaskLabelValues(task);
  };

  const getFilterOptions = (
    category: TaskFilterCategory,
  ): string[] => {
    switch (category) {
      case "Status": {
        const values = tasks
          .map((task) =>
            getTaskText(task, ["status"]),
          )
          .filter(Boolean);

        return [
          "all",
          ...Array.from(
            new Set(values),
          ),
        ];
      }

      case "Priority":
        return [
          "all",
          "No Priority",
          "Urgent",
          "High",
          "Medium",
          "Low",
        ];

      case "Members": {
        const values = teamMembers
          .map(
            (member) =>
              member.name ||
              member.email ||
              member.id ||
              "",
          )
          .filter(Boolean);

        return [
          "all",
          ...Array.from(
            new Set(values),
          ),
        ];
      }

      case "Due Date":
        return [
          "all",
          "No Due Date",
          "Overdue",
          "Today",
          "Upcoming",
        ];

      case "Teams": {
        const values = tasks
          .map((task) =>
            getTaskTeamValueForFilter(
              task,
            ),
          )
          .filter(Boolean);

        return [
          "all",
          ...Array.from(
            new Set(values),
          ),
        ];
      }

      case "Labels": {
        const values = tasks.flatMap(
          (task) =>
            getTaskLabelValuesForFilter(
              task,
            ),
        );

        return [
          "all",
          ...Array.from(
            new Set(values),
          ),
        ];
      }

      case "Reporter": {
        const values = tasks
          .map((task) =>
            getTaskReporterValue(
              task,
            ),
          )
          .filter(Boolean);

        return [
          "all",
          ...Array.from(
            new Set(values),
          ),
        ];
      }

      default:
        return ["all"];
    }
  };

  const formatFilterOption = (
    category: TaskFilterCategory,
    value: string,
  ): string => {
    if (value === "all") {
      return `All ${category}`;
    }

    return value;
  };

  const applyTaskFilter = (
    category: TaskFilterCategory,
    value: string,
  ) => {
    setTaskFilterValues(
      (previous) => ({
        ...previous,
        [category]: value,
      }),
    );

    setTaskFilterMenu(
      (previous) => ({
        ...previous,
        open: true,
        category: null,
      }),
    );
  };

  const clearTaskFilters = () => {
    setTaskFilterValues({
      Status: "all",
      Priority: "all",
      Members: "all",
      "Due Date": "all",
      Teams: "all",
      Labels: "all",
      Reporter: "all",
    });

    setTaskFilterMenu({
      open: false,
      category: null,
      left: 0,
      top: 0,
    });
  };

  const hasTaskFilters =
    Object.values(
      taskFilterValues,
    ).some(
      (value) =>
        value !== "all",
    );

  const filteredTasks =
    tasks.filter((task) => {
      const status =
        getTaskText(task, [
          "status",
        ]);

      const priority =
        getTaskText(task, [
          "priority",
        ]);

      const member =
        getTaskMemberValue(task);

      const reporter =
        getTaskReporterValue(task);

      const team =
        getTaskTeamValueForFilter(
          task,
        );

      const labels =
        getTaskLabelValuesForFilter(
          task,
        );

      const dueDate =
        getTaskDueDateBucket(task);

      const matchesStatus =
        taskFilterValues.Status ===
          "all" ||
        status ===
          taskFilterValues.Status;

      const matchesPriority =
        taskFilterValues.Priority ===
          "all" ||
        priority ===
          taskFilterValues.Priority;

      const matchesMember =
        taskFilterValues.Members ===
          "all" ||
        member ===
          taskFilterValues.Members ||
        getTaskText(task, [
          "assigneeName",
          "assigneeEmail",
        ]) ===
          taskFilterValues.Members;

      const matchesDueDate =
        taskFilterValues["Due Date"] ===
          "all" ||
        dueDate ===
          taskFilterValues["Due Date"];

      const matchesTeam =
        taskFilterValues.Teams ===
          "all" ||
        team ===
          taskFilterValues.Teams;

      const matchesLabel =
        taskFilterValues.Labels ===
          "all" ||
        labels.includes(
          taskFilterValues.Labels,
        );

      const matchesReporter =
        taskFilterValues.Reporter ===
          "all" ||
        reporter ===
          taskFilterValues.Reporter ||
        getTaskText(task, [
          "reporterName",
          "reporterEmail",
        ]) ===
          taskFilterValues.Reporter;

      return (
        matchesStatus &&
        matchesPriority &&
        matchesMember &&
        matchesDueDate &&
        matchesTeam &&
        matchesLabel &&
        matchesReporter
      );
    });

  const getFilterIcon = (
    category: TaskFilterCategory,
  ) => {
    switch (category) {
      case "Status":
        return (
          <Circle className="h-4 w-4" />
        );
      case "Priority":
        return (
          <SignalHigh className="h-4 w-4" />
        );
      case "Members":
        return (
          <UsersRound className="h-4 w-4" />
        );
      case "Due Date":
        return (
          <CalendarDays className="h-4 w-4" />
        );
      case "Teams":
        return (
          <Building2 className="h-4 w-4" />
        );
      case "Labels":
        return (
          <Tag className="h-4 w-4" />
        );
      case "Reporter":
        return (
          <UserRound className="h-4 w-4" />
        );
      default:
        return null;
    }
  };

  /* ==============================================================
     RENDER
  ============================================================== */

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-white text-gray-800 dark:bg-zinc-950 dark:text-gray-100">

      {/* ========================================================
          SIDEBAR
      ================================================        */}

      <div
        className={`shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
          isSidebarOpen
            ? "w-64 max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:h-screen max-lg:shadow-2xl"
            : "w-0 border-none"
        }`}
      >
        <div className="h-full w-64">
          <Sidebar />
        </div>
      </div>

      {/* ========================================================
          MAIN
      ======================================================== */}

      <div className="flex flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-950">

        {/* HEADER */}

       <header className="flex items-center gap-3 border-b border-gray-200 px-3 py-3 sm:px-5 lg:px-6 dark:border-zinc-800">
  <button
    type="button"
    onClick={() =>
      setIsSidebarOpen((previous) => !previous)
    }
    className="relative z-[70] shrink-0 text-gray-500 hover:text-gray-700 focus:outline-none dark:hover:text-gray-300"
    title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
  >
    <PanelLeft className="h-4 w-4" />
  </button>

  {projectId && projectName ? (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <button
        type="button"
        onClick={() => window.location.assign("/projects")}
        className="text-gray-500 transition hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white"
      >
        Projects
      </button>

      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />

      <span className="truncate font-medium text-gray-900 dark:text-white">
        {projectName}
      </span>
    </div>
  ) : (
    <span className="text-sm font-medium text-gray-500 dark:text-zinc-400">
      Tasks
    </span>
  )}
</header>

{/* CONTENT */}

<div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5 lg:p-8">

          {/* TOOLBAR */}
         <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5 lg:p-8">

          <TaskToolbar
            searchQuery={
              searchQuery
            }

            setSearchQuery={
              setSearchQuery
            }

            isFieldsOpen={
              isFieldsOpen
            }

            setIsFieldsOpen={
              setIsFieldsOpen
            }

            viewMode={
              viewMode
            }

            setViewMode={
              setViewMode
            }

            columns={
              columns
            }

            toggleColumn={
              toggleColumn
            }

            fieldsRef={
              fieldsRef
            }

            onAddTask={
              openCreateTaskModal
            }

            onToggleFilter={
              (button) => {
                const rect =
                  button.getBoundingClientRect();

                setIsFieldsOpen(false);

                setTaskFilterMenu((previous) => ({
                  ...previous,
                  open: !previous.open,
                  category: previous.open
                    ? null
                    : previous.category,
                  left: Math.max(
                    8,
                    Math.min(
                      window.innerWidth - 390,
                      rect.right - 194,
                    ),
                  ),
                  top: rect.bottom + 8,
                }));
              }
            }
          />

          {taskFilterMenu.open && (
            <div
              ref={taskFilterMenuRef}
              className="fixed z-[100] flex flex-row-reverse items-start"
              style={{
                left: `${taskFilterMenu.left}px`,
                top: `${taskFilterMenu.top}px`,
              }}
            >
              <div className="w-48 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
                <div className="px-2.5 py-2 text-[11px] font-medium text-gray-400 dark:text-zinc-500">
                  Filter by
                </div>

                {taskFilterCategories.map((category) => {
                  const selected = taskFilterValues[category] !== "all";

                  return (
                    <button
                      key={category}
                      type="button"
                      onMouseEnter={() =>
                        setTaskFilterMenu((previous) => ({
                          ...previous,
                          category,
                        }))
                      }
                      onClick={() =>
                        setTaskFilterMenu((previous) => ({
                          ...previous,
                          category:
                            previous.category === category ? null : category,
                        }))
                      }
                      className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                        taskFilterMenu.category === category
                          ? "bg-gray-50 text-gray-900 dark:bg-zinc-800 dark:text-white"
                          : "text-gray-700 hover:bg-gray-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <span className="text-gray-500 dark:text-zinc-400">
                        {getFilterIcon(category)}
                      </span>
                      <span className="flex-1">{category}</span>
                      {selected && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--app-accent)]" />
                      )}
                      <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                  );
                })}

                {hasTaskFilters && (
                  <>
                    <div className="my-1.5 border-t border-gray-100 dark:border-zinc-800" />
                    <button
                      type="button"
                      onClick={clearTaskFilters}
                      className="w-full rounded-lg px-2.5 py-2 text-left text-xs font-medium text-gray-500 hover:bg-gray-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      Clear all filters
                    </button>
                  </>
                )}
              </div>

              {taskFilterMenu.category && (
                <div className="mr-1.5 w-48 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="px-2.5 py-2 text-[11px] font-medium text-gray-400 dark:text-zinc-500">
                    {taskFilterMenu.category}
                  </div>

                  {getFilterOptions(taskFilterMenu.category).map((value) => {
                    const selected =
                      taskFilterValues[
                        taskFilterMenu.category!
                      ] === value;

                    const isPriority =
                      taskFilterMenu.category ===
                      "Priority";

                    const priorityClass =
                      value === "Urgent"
                        ? "text-red-500"
                        : value === "High"
                          ? "text-orange-500"
                          : value === "Medium"
                            ? "text-amber-500"
                            : value === "Low"
                              ? "text-gray-400"
                              : "text-gray-400";

                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          applyTaskFilter(
                            taskFilterMenu.category!,
                            value,
                          )
                        }
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                          selected
                            ? "bg-gray-50 text-gray-900 dark:bg-zinc-800 dark:text-white"
                            : "text-gray-700 hover:bg-gray-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <span className="flex w-5 shrink-0 items-center justify-center">
                          {isPriority &&
                          value !== "all" ? (
                            value === "Urgent" ||
                            value === "High" ? (
                              <SignalHigh
                                className={`h-3.5 w-3.5 ${priorityClass}`}
                              />
                            ) : value === "Medium" ? (
                              <SignalMedium
                                className={`h-3.5 w-3.5 ${priorityClass}`}
                              />
                            ) : (
                              <SignalLow
                                className={`h-3.5 w-3.5 ${priorityClass}`}
                              />
                            )
                          ) : selected ? (
                            <Check className="h-3.5 w-3.5 text-gray-500" />
                          ) : null}
                        </span>

                        <span
                          className={
                            isPriority
                              ? priorityClass
                              : ""
                          }
                        >
                          {formatFilterOption(
                            taskFilterMenu.category!,
                            value,
                          )}
                        </span>

                        {selected && (
                          <Check className="ml-auto h-3.5 w-3.5 text-gray-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* LIST / BOARD */}

          {viewMode === "list" ? (
            <TaskListView
              tasks={
                filteredTasks
              }

              searchQuery={
                searchQuery
              }

              columns={
                columns
              }

              collapsedGroups={
                collapsedGroups
              }

              toggleGroup={
                toggleGroup
              }

              onSelectTask={
                setSelectedTask
              }

              onAddTask={
                openCreateTaskModal
              }

              onEditTask={
                handleEditTask
              }

              onDeleteTask={
                handleDeleteTask
              }
            />
          ) : (
            <TaskBoardView
              tasks={
                filteredTasks
              }

              searchQuery={
                searchQuery
              }

              columns={
                columns
              }

              onSelectTask={
                setSelectedTask
              }

              onAddTask={
                openCreateTaskModal
              }

              onEditTask={
                handleEditTask
              }

              onDeleteTask={
                handleDeleteTask
              }
            />
          )}
        </div>
      </div>

      {/* ========================================================
          TASK DETAILS
      ======================================================== */}

      {synchronizedSelectedTask && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">

          <div className="h-full w-full max-w-3xl overflow-y-auto bg-white shadow-2xl dark:bg-zinc-950">

          <TaskDetailsModal
  key={synchronizedSelectedTask.id}
  isOpen={Boolean(synchronizedSelectedTask)}
  task={synchronizedSelectedTask}
  onClose={() => setSelectedTask(null)}
  onUpdateTask={handleUpdateTask}
  currentUserId={currentUserId}
  currentUsername={currentUsername}
  teamId={currentTeamId}
  teamMembers={teamMembers}
/>

          </div>
        </div>
      )}

      {/* ========================================================
          CREATE / EDIT TASK MODAL
      ======================================================== */}

      <CreateTaskModal
        isOpen={
          isModalOpen
        }

        taskForm={
          taskForm
        }

        setTaskForm={
          setTaskForm
        }

        teamMembers={
          teamMembers
        }

        onClose={() => {
          setIsModalOpen(
            false
          );

          setEditingTask(
            null
          );

          setTaskForm({
            ...defaultTaskForm,
          });
        }}

        onSubmit={
          handleFormSubmit
        }
      />

    </div>
  </div>
  );
}