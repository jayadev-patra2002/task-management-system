"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  File,
  FileText,
  FolderOpen,
  Link2,
  Lock,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Settings,
  Share2,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Smile,
  Tag,
  Trash2,
  Unlock,
  UserPlus,
  X,
} from "lucide-react";

import { io, Socket } from "socket.io-client";

import {
  PriorityType,
  Subtask,
  TaskItem,
  TaskResource,
  TaskStatus,
} from "../../types/task-types";

/* =====================================================
   TYPES
===================================================== */

export interface UpdateLog {
  user: string;
  text: string;
  time: string;
  type:
    | "priority"
    | "status"
    | "member"
    | "general"
    | "date"
    | "comment"
    | "reply";

  id?: string;
  commentId?: string;
  isComment?: boolean;
  avatar?: string | null;
}

interface TaskActivityLog {
  id: string;
  action: string;
  createdAt: string;

  commentId?: string | null;

  user?: {
    id?: string;
    name: string;
    avatar?: string;
  };
}

export interface TeamMember {
  id?: string;
  name?: string;
  email: string;
}

type ExtendedTaskItem = TaskItem & {
  teams?: string;
  updates?: UpdateLog[];
  activityLogs?: TaskActivityLog[];
};

export interface TaskViewer {
  userId: string;
  userName: string;
}

interface TaskViewerUpdatedPayload {
  taskId: string;
  teamId: string;
  viewers: TaskViewer[];
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

  // Backend explicitly marks state synchronization events.
  initialSync?: boolean;
  emittedAt?: string;
}

interface TaskLockDeniedPayload {
  taskId: string;
  reason: string;
  lock?: {
    taskId: string;
    userId: string;
    userName: string;
  } | null;
}

interface TaskDetailsModalProps {
  isOpen: boolean;
  task: TaskItem | null;
  onClose: () => void;

  onUpdateTask?: (
    updatedTask: TaskItem,
  ) => Promise<void> | void;

  currentUserId?: string;
  currentUsername?: string;
  teamId?: string;

  teamMembers?: TeamMember[];

  viewers?: TaskViewer[];

  onViewerJoin?: (
    taskId: string,
  ) => void;

  onViewerLeave?: (
    taskId: string,
  ) => void;

  onDeleteTask?: (
    taskId: string,
  ) => Promise<void> | void;

  onArchiveTask?: (
    taskId: string,
  ) => Promise<void> | void;

  onDuplicateTask?: (
    task: TaskItem,
  ) => Promise<void> | void;

  onShareTask?: (
    taskId: string,
    permission: SharePermission,
  ) => Promise<void> | void;
}

/* =====================================================
   SHARE TYPES
===================================================== */

type SharePermission =
  | "view"
  | "comment"
  | "edit";

/* =====================================================
   SOCKET EVENT PAYLOADS
===================================================== */

interface TeamJoinPayload {
  teamId: string;
  userId: string;
  userName: string;
}

interface TaskViewerJoinPayload {
  taskId: string;
  teamId: string;
  userId: string;
  userName: string;
}

interface TaskViewerLeavePayload {
  taskId: string;
  teamId: string;
  userId: string;
}

interface TaskActivityCreatedPayload {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  avatar?: string | null;
  action: string;
  commentId?: string | null;
  createdAt: string | Date;
}

/* =====================================================
   PRIORITY OPTIONS
===================================================== */

const taskPriorityOptions: PriorityType[] = [
  "Urgent",
  "High",
  "Medium",
  "Low",
  "No Priority",
];

/* =====================================================
   WRAPPER
===================================================== */

export default function TaskDetailsModal(
  props: TaskDetailsModalProps,
) {
  if (
    !props.isOpen ||
    !props.task
  ) {
    return null;
  }

  return (
    <TaskDetailsModalContent
      key={props.task.id}
      {...props}
      task={props.task}
    />
  );
}

/* =====================================================
   MODAL CONTENT
===================================================== */

function TaskDetailsModalContent({
  isOpen,
  task,
  onClose,
  onUpdateTask,
  currentUserId,
  currentUsername,
  teamId,
  teamMembers = [],
  viewers: initialViewers = [],
  onViewerJoin,
  onViewerLeave,
  onDeleteTask,
  onArchiveTask,
  onDuplicateTask,
  onShareTask,
}: TaskDetailsModalProps & {
  task: TaskItem;
}) {
  /* ===================================================
     USER INFORMATION
  =================================================== */

  const activeUsername =
    currentUsername?.trim() ||
    "Current User";

  const activeUserId =
    currentUserId?.trim() || "";

  const extTask =
    task as ExtendedTaskItem;

  /* ===================================================
     ACTIVITY MAPPER
  =================================================== */

  const mapActivityLogsToUpdates = (
    logs: TaskActivityLog[] | undefined,
  ): UpdateLog[] => {
    if (!Array.isArray(logs)) {
      return [];
    }

    return logs.map((log) => {
      const action = log.action || "";
      const lowerAction =
        action.toLowerCase();

      const isComment =
        lowerAction.startsWith(
          "commented:",
        );

      const isReply =
        lowerAction.startsWith(
          "replied:",
        );

      return {
        id: log.id,

        user:
          log.user?.name ||
          "Team Member",

        text: action,

        time:
          new Date(
            log.createdAt,
          ).toLocaleString(),

        type:
          lowerAction.includes(
            "priority",
          )
            ? "priority"
            : lowerAction.includes(
                  "status",
                )
              ? "status"
              : lowerAction.includes(
                    "assignee",
                  )
                ? "member"
                : lowerAction.includes(
                      "due date",
                    ) ||
                    lowerAction.includes(
                      "start date",
                    )
                  ? "date"
                  : isComment
                    ? "comment"
                    : isReply
                      ? "reply"
                      : "general",

        commentId:
          log.commentId ??
          undefined,

        isComment:
          isComment && !isReply,

        avatar:
          log.user?.avatar ??
          null,
      };
    });
  };

  /* ===================================================
     DYNAMIC TASK VALUES

     IMPORTANT:
     These values are derived directly from `task`.

     Because the parent updates Zustand and passes the
     updated task back into this component, the modal,
     task list and task board all stay synchronized.

     No useEffect is needed here.
  =================================================== */

  const currentStatus: TaskStatus =
    task.status || "Doing";

  const currentPriority: PriorityType =
    task.priority || "Medium";

  const currentAssignee =
    task.assignee?.trim() || "";

  const currentReporter =
    task.reporter?.trim() ||
    activeUsername;

  const currentTeams =
    extTask.teams?.trim() || "-";

  /*
   * Persisted task dates.
   * The backend stores/returns "DD Mon YYYY".
   * The modal keeps that value internally and renders the UI as "DD Mon".
   */
const [startDate, setStartDate] =
  useState<string>(
    typeof task.startDate === "string"
      ? task.startDate.trim()
      : "",
  );

const [endDate, setEndDate] =
  useState<string>(
    typeof task.dueDate === "string"
      ? task.dueDate.trim()
      : "",
  );

const [activeDateField, setActiveDateField] =
  useState<"start" | "end">("end");

 

  /* ===================================================
     LOCAL STATE
  =================================================== */

  const [isSubtasksOpen, setIsSubtasksOpen] =
    useState(true);

  // Details and Updates keep their own collapse state.
  // They intentionally default to open so the existing UI layout is preserved.
  const [isDetailsOpen, setIsDetailsOpen] =
    useState(true);

  const [isUpdatesOpen, setIsUpdatesOpen] =
    useState(true);

  const [currentDate, setCurrentDate] =
    useState<Date>(() => new Date());

  const [isPriorityOpen, setIsPriorityOpen] =
    useState(false);

  const [isDatePickerOpen, setIsDatePickerOpen] =
    useState(false);

  const [isMemberOpen, setIsMemberOpen] =
    useState(false);

  const [isViewerListOpen, setIsViewerListOpen] =
    useState(false);

  const [selectedComment, setSelectedComment] =
    useState<{
      id: string;
      user: string;
      text: string;
      avatar?: string | null;
    } | null>(null);

  /* ===================================================
     LOCK STATE
  =================================================== */

  const [isLocked, setIsLocked] =
    useState<boolean>(
      () => Boolean(task.isLocked),
    );

  const [lockedByUserId, setLockedByUserId] =
    useState<string | null>(
      () =>
        task.lockedByUserId ??
        null,
    );

  const [lockedBy, setLockedBy] =
    useState<string | null>(
      () =>
        task.lockedBy ??
        null,
    );

  /* ===================================================
     SHARE STATE
  =================================================== */

  const [isShareOpen, setIsShareOpen] =
    useState(false);

  const [sharePermission, setSharePermission] =
    useState<SharePermission>("view");

  const [shareCopied, setShareCopied] =
    useState(false);

  const [shareLoading, setShareLoading] =
    useState(false);

  /* ===================================================
     MORE MENU STATE
  =================================================== */

  const [isMoreOpen, setIsMoreOpen] =
    useState(false);

  const [moreActionLoading, setMoreActionLoading] =
    useState(false);

  const [actionMessage, setActionMessage] =
    useState<string | null>(null);

  /*
   * ACTION MESSAGE RESET
   *
   * Do not let a message from a previous interaction appear when
   * the task modal is opened again. The reset is intentionally
   * asynchronous so React does not flag a synchronous setState
   * inside an effect as a cascading render.
   */
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      setActionMessage(null);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isOpen, task.id]);

  /* ===================================================
     REFS
  =================================================== */

  const shareRef =
    useRef<HTMLDivElement>(null);

  const moreRef =
    useRef<HTMLDivElement>(null);

  const viewerRef =
    useRef<HTMLDivElement>(null);

  const lockRef =
    useRef<HTMLDivElement>(null);

  const datePickerRef =
    useRef<HTMLDivElement>(null);

  const commentFileInputRef =
    useRef<HTMLInputElement>(null);

  const resourceFileInputRef =
    useRef<HTMLInputElement>(null);

  const resourceFolderInputRef =
    useRef<HTMLInputElement>(null);

  /* ===================================================
     REALTIME VIEWERS
  =================================================== */

  const [liveViewers, setLiveViewers] =
    useState<TaskViewer[]>(
      () => initialViewers,
    );

  const [isRealtimeConnected, setIsRealtimeConnected] =
    useState(false);

  const socketRef =
    useRef<Socket | null>(null);

  const hasJoinedRealtimeRef =
    useRef(false);

  // Subtask CRUD is handled through the REST endpoints below.
  // A task.updated socket event can arrive immediately afterwards with an
  // older parent-task snapshot. Keep a short-lived guard so that stale
  // realtime data cannot overwrite the authoritative REST result.
  const subtaskLocalMutationUntilRef =
    useRef(0);

  /* ===================================================
     COMMENT / REPLY STATE
  =================================================== */

  const [commentText, setCommentText] =
    useState("");

  const [replyText, setReplyText] =
    useState("");

  const [
    commentEmojiPickerOpen,
    setCommentEmojiPickerOpen,
  ] = useState(false);

  const [
    replyEmojiPickerOpen,
    setReplyEmojiPickerOpen,
  ] = useState(false);

  /* ===================================================
     SUBTASK FORM

     Subtasks intentionally use only the fields that exist in
     the Create Task form and are visible in the Subtasks table:
     Title, Priority, Members and Due Date.
  =================================================== */

  const [subtasks, setSubtasks] =
    useState<Subtask[]>(() =>
      Array.isArray(task.subtasks)
        ? task.subtasks
        : [],
    );

  const [isAddingSubtask, setIsAddingSubtask] =
    useState(false);

  const [editingSubtaskId, setEditingSubtaskId] =
    useState<string | null>(null);

  const [subtaskForm, setSubtaskForm] =
    useState<{
      title: string;
      priority: PriorityType;
      assignee: string;
      dueDate: string;
    }>({
      title: "",
      priority: "Medium",
      assignee: "",
      dueDate: "",
    });

  const [isSubtaskSaving, setIsSubtaskSaving] =
    useState(false);

  const [subtaskActionError, setSubtaskActionError] =
    useState<string | null>(null);

  const [openSubtaskMenuId, setOpenSubtaskMenuId] =
    useState<string | null>(null);

  /* ===================================================
     RESOURCE FORM
  =================================================== */

  const [
    isAddingResourceLink,
    setIsAddingResourceLink,
  ] = useState(false);

  const [newResourceName, setNewResourceName] =
    useState("");

  const [newResourceUrl, setNewResourceUrl] =
    useState("");

  const [isResourceSaving, setIsResourceSaving] =
    useState(false);

  const [
    resourceActionError,
    setResourceActionError,
  ] = useState<string | null>(null);

  const [isResourceMenuOpen, setIsResourceMenuOpen] =
    useState(false);

  const [isResourceUploading, setIsResourceUploading] =
    useState(false);

  const [editingResourceId, setEditingResourceId] =
    useState<string | null>(null);

  const [editingResourceName, setEditingResourceName] =
    useState("");

  const [editingResourceUrl, setEditingResourceUrl] =
    useState("");

  const [resourceEditSaving, setResourceEditSaving] =
    useState(false);

  const [resourceItems, setResourceItems] =
    useState<TaskResource[]>(() =>
      Array.isArray(task.resources)
        ? task.resources
        : [],
    );

  /* ===================================================
     SELECTED COMMENT
  =================================================== */

  const [selectedCommentId, setSelectedCommentId] =
    useState<string | null>(null);

  const [
    selectedCommentText,
    setSelectedCommentText,
  ] = useState("");

  /* ===================================================
     UPDATES
  =================================================== */

  const [updatesList, setUpdatesList] =
    useState<UpdateLog[]>(() =>
      mapActivityLogsToUpdates(
        extTask.activityLogs,
      ),
    );

  /* ===================================================
     CALLBACK REFS
  =================================================== */

  const onViewerJoinRef =
    useRef(onViewerJoin);

  const onViewerLeaveRef =
    useRef(onViewerLeave);

  useEffect(() => {
    onViewerJoinRef.current =
      onViewerJoin;
  }, [onViewerJoin]);

  useEffect(() => {
    onViewerLeaveRef.current =
      onViewerLeave;
  }, [onViewerLeave]);


useEffect(() => {
  const resources = Array.isArray(task.resources)
    ? task.resources
    : [];

  const timer = setTimeout(() => {
    setResourceItems(resources);
  }, 0);

  return () => clearTimeout(timer);
}, [task.resources]);
  /* ===================================================
     TASK SHARE URL
  =================================================== */

  const taskShareUrl = useMemo(() => {
    if (
      typeof window === "undefined"
    ) {
      return "";
    }

    return `${window.location.origin}/dashboard/tasks?taskId=${encodeURIComponent(
      String(task.id),
    )}`;
  }, [task.id]);

  /* ===================================================
     REALTIME PRESENCE + ACTIVITY + LOCK
  =================================================== */

  useEffect(() => {
    if (
      !isOpen ||
      !task.id ||
      !activeUserId ||
      !teamId
    ) {
      return;
    }

    if (socketRef.current) {
      return;
    }

    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      "http://localhost:4000";

    const socket = io(
      socketUrl,
      {
        autoConnect: false,
        transports: ["websocket"],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      },
    );

    socketRef.current = socket;

    const handleConnect = () => {
      setIsRealtimeConnected(
        true,
      );

      if (
        hasJoinedRealtimeRef.current
      ) {
        return;
      }

      hasJoinedRealtimeRef.current =
        true;

      const teamJoinPayload:
        TeamJoinPayload = {
        teamId: String(teamId),
        userId: String(activeUserId),
        userName:
          activeUsername,
      };

      socket.emit(
        "team.join",
        teamJoinPayload,
      );

      const viewerJoinPayload:
        TaskViewerJoinPayload = {
        taskId: String(task.id),
        teamId: String(teamId),
        userId: String(activeUserId),
        userName:
          activeUsername,
      };

      socket.emit(
        "task.viewers.join",
        viewerJoinPayload,
      );

      onViewerJoinRef.current?.(
        task.id,
      );
    };

    const handleViewerUpdate = (
      payload: TaskViewerUpdatedPayload,
    ) => {
      if (!payload) {
        return;
      }

      if (
        String(payload.taskId) !==
        String(task.id)
      ) {
        return;
      }

      if (
        String(payload.teamId) !==
        String(teamId)
      ) {
        return;
      }

      setLiveViewers(
        Array.isArray(
          payload.viewers,
        )
          ? payload.viewers
          : [],
      );
    };

    const handleTaskUpdated = (payload: {
      taskId: string;
      task?: ExtendedTaskItem;
    }) => {
      if (
        !payload ||
        String(payload.taskId) !==
          String(task.id)
      ) {
        return;
      }

      if (payload.task) {
        setResourceItems(
          Array.isArray(payload.task.resources)
            ? payload.task.resources
            : [],
        );

        // Do not let an older task.updated snapshot replace a subtask result
        // that was just returned by the REST CRUD request. Resource syncing
        // remains unchanged.
        if (
          Date.now() >=
          subtaskLocalMutationUntilRef.current
        ) {
          setSubtasks(
            Array.isArray(payload.task.subtasks)
              ? payload.task.subtasks
              : [],
          );
        }
      }
    };

    const handleTaskActivityCreated = (
      payload: TaskActivityCreatedPayload,
    ) => {
      if (!payload) {
        return;
      }

      if (
        String(payload.taskId) !==
        String(task.id)
      ) {
        return;
      }

      const userName =
        payload.userName?.trim() ||
        "Team Member";

      const action =
        payload.action ||
        "updated the task";

      const createdAt =
        new Date(payload.createdAt);

      const time =
        Number.isNaN(
          createdAt.getTime(),
        )
          ? "Just now"
          : createdAt.toLocaleTimeString(
              [],
              {
                hour: "2-digit",
                minute: "2-digit",
              },
            );

      setUpdatesList(
        (previous) => {
          /*
           * Gateway sends activity to both:
           *
           * team:${teamId}
           * task:${taskId}
           *
           * Since this socket is in both rooms, the
           * same activity can arrive twice.
           *
           * Activity database ID is the reliable
           * deduplication key.
           */
          if (
            payload.id &&
            previous.some(
              (item) =>
                item.id ===
                payload.id,
            )
          ) {
            return previous;
          }

          return [
            {
              id: payload.id,

              user: userName,

              text: action,

              time,

              type:
                action
                  .toLowerCase()
                  .startsWith(
                    "commented:",
                  )
                  ? "comment"
                  : action
                      .toLowerCase()
                      .startsWith(
                        "replied:",
                      )
                    ? "reply"
                    : action
                        .toLowerCase()
                        .includes(
                          "priority",
                        )
                      ? "priority"
                      : action
                          .toLowerCase()
                          .includes(
                            "assignee",
                          )
                        ? "member"
                        : action
                            .toLowerCase()
                            .includes(
                              "due date",
                            )
                          ? "date"
                          : "general",

              commentId:
                payload.commentId ??
                undefined,

              isComment:
                action
                  .toLowerCase()
                  .startsWith(
                    "commented:",
                  ),

              avatar:
                payload.avatar ??
                null,
            },

            ...previous,
          ];
        },
      );

      setActionMessage(
        `${userName} ${action}`,
      );
    };

    const handleConnectError = (
      error: unknown,
    ) => {
      console.error(
        "[Realtime] Connection error:",
        error,
      );

      setIsRealtimeConnected(
        false,
      );
    };

    const handleDisconnect = (
      reason: string,
    ) => {
      console.log(
        "[Realtime] Socket disconnected:",
        reason,
      );

      setIsRealtimeConnected(
        false,
      );

      hasJoinedRealtimeRef.current =
        false;
};

    const handleReconnect = () => {
      setIsRealtimeConnected(
        true,
      );

      hasJoinedRealtimeRef.current =
        false;
};

    const handleLockUpdate = (
      payload: TaskLockUpdatedPayload,
    ) => {
      if (!payload) {
        return;
      }

      if (
        String(payload.taskId) !==
        String(task.id)
      ) {
        return;
      }

      if (
        String(payload.teamId) !==
        String(teamId)
      ) {
        return;
      }

      const locked =
        Boolean(payload.locked);

      const nextLockedByUserId =
        payload.lock?.userId ??
        null;

      const nextLockedBy =
        payload.lock?.userName ??
        null;

      setIsLocked(locked);

      setLockedByUserId(
        nextLockedByUserId,
      );

      setLockedBy(
        nextLockedBy,
      );

      console.log(
        "[TaskDetails][LOCK EVENT]",
        {
          taskId: payload.taskId,
          teamId: payload.teamId,
          locked,
          initialSync: Boolean(payload.initialSync),
          lockOwnerId: nextLockedByUserId,
          lockOwnerName: nextLockedBy,
          emittedAt: payload.emittedAt ?? null,
          socketId: socket.id,
          receivedAt: new Date().toISOString(),
        },
      );

      // Initial state synchronization must update the UI but must NEVER
      // produce a user-action toast.
      if (payload.initialSync === true) {
        return;
      }

      // Only a real lock/unlock event reaches this branch.
      setActionMessage(
        locked
          ? `Task locked by ${
              nextLockedBy ||
              "Team Member"
            }`
          : "Task unlocked",
      );
    };

    const handleLockDenied = (
      payload: TaskLockDeniedPayload,
    ) => {
      if (!payload) {
        return;
      }

      if (
        String(payload.taskId) !==
        String(task.id)
      ) {
        return;
      }

      if (payload.lock) {
        setIsLocked(true);

        setLockedByUserId(
          payload.lock.userId ??
            null,
        );

        setLockedBy(
          payload.lock.userName ??
            null,
        );
      }

      setActionMessage(
        payload.reason ||
          "Task lock request denied",
      );
    };

    socket.on(
      "connect",
      handleConnect,
    );

    socket.on(
      "task.viewers.updated",
      handleViewerUpdate,
    );

    socket.on(
      "task.updated",
      handleTaskUpdated,
    );

    socket.on(
      "task.activity.created",
      handleTaskActivityCreated,
    );

    socket.on(
      "task.lock.updated",
      handleLockUpdate,
    );

    socket.on(
      "task.lock.denied",
      handleLockDenied,
    );

    socket.on(
      "task.lock.release.denied",
      handleLockDenied,
    );

    socket.on(
      "connect_error",
      handleConnectError,
    );

    socket.on(
      "disconnect",
      handleDisconnect,
    );

    socket.io.on(
      "reconnect",
      handleReconnect,
    );

    socket.connect();

    return () => {
      if (socket.connected) {
        const leavePayload:
          TaskViewerLeavePayload = {
          taskId: String(task.id),
          teamId: String(teamId),
          userId:
            String(activeUserId),
        };

        socket.emit(
          "task.viewers.leave",
          leavePayload,
        );

        socket.emit(
          "team.leave",
          {
            teamId: String(teamId),
          },
        );
      }

      onViewerLeaveRef.current?.(
        task.id,
      );

      socket.off(
        "connect",
        handleConnect,
      );

      socket.off(
        "task.viewers.updated",
        handleViewerUpdate,
      );

      socket.off(
        "task.updated",
        handleTaskUpdated,
      );

      socket.off(
        "task.activity.created",
        handleTaskActivityCreated,
      );

      socket.off(
        "task.lock.updated",
        handleLockUpdate,
      );

      socket.off(
        "task.lock.denied",
        handleLockDenied,
      );

      socket.off(
        "task.lock.release.denied",
        handleLockDenied,
      );

      socket.off(
        "connect_error",
        handleConnectError,
      );

      socket.off(
        "disconnect",
        handleDisconnect,
      );

      socket.io.off(
        "reconnect",
        handleReconnect,
      );

      socket.disconnect();

      socketRef.current =
        null;

      hasJoinedRealtimeRef.current =
        false;

      setIsRealtimeConnected(
        false,
      );
    };
  }, [
    isOpen,
    task.id,
    teamId,
    activeUserId,
    activeUsername,
  ]);

  /* ===================================================
     OUTSIDE CLICK
  =================================================== */

  useEffect(() => {
    const handleClickOutside = (
      event: MouseEvent,
    ) => {
      const target =
        event.target as Node;

      if (
        datePickerRef.current &&
        !datePickerRef.current.contains(
          target,
        )
      ) {
        setIsDatePickerOpen(
          false,
        );
      }

      if (
        shareRef.current &&
        !shareRef.current.contains(
          target,
        )
      ) {
        setIsShareOpen(false);
      }

      if (
        moreRef.current &&
        !moreRef.current.contains(
          target,
        )
      ) {
        setIsMoreOpen(false);
      }

      if (
        viewerRef.current &&
        !viewerRef.current.contains(
          target,
        )
      ) {
        setIsViewerListOpen(
          false,
        );
      }

      if (
        !(
          event.target instanceof
          Element
        )
      ) {
        return;
      }

      if (
        !(
          event.target as Element
        ).closest(
          "[data-priority-menu]",
        )
      ) {
        setIsPriorityOpen(
          false,
        );
      }

      if (
        !(
          event.target as Element
        ).closest(
          "[data-member-menu]",
        )
      ) {
        setIsMemberOpen(
          false,
        );
      }

      if (
        !(
          event.target as Element
        ).closest(
          "[data-subtask-menu]",
        )
      ) {
        setOpenSubtaskMenuId(null);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
    };
  }, []);

  /* ===================================================
     VIEWER DATA
  =================================================== */

  const visibleViewers =
    useMemo(
      () =>
        liveViewers.filter(
          (viewer) =>
            viewer.userId !==
            activeUserId,
        ),
      [
        liveViewers,
        activeUserId,
      ],
    );

  const viewerCount =
    liveViewers.length;

  const otherViewerCount =
    visibleViewers.length;

  /* ===================================================
     LOCK FUNCTIONALITY
  =================================================== */

  const handleToggleLock = () => {
    const socket =
      socketRef.current;

    if (!socket?.connected) {
      setActionMessage(
        "Realtime connection is unavailable",
      );
      return;
    }

    if (
      !activeUserId ||
      !teamId
    ) {
      setActionMessage(
        "User/team session is unavailable",
      );
      return;
    }

    const currentUserId =
      String(activeUserId);

    const currentTeamId =
      String(teamId);

    const taskId =
      String(task.id);

    if (isLocked) {
      if (
        String(
          lockedByUserId,
        ) !== currentUserId
      ) {
        setActionMessage(
          `Task is locked by ${
            lockedBy ||
            "another team member"
          }`,
        );

        return;
      }

      socket.emit(
        "task.lock.release",
        {
          taskId,
          teamId:
            currentTeamId,
          userId:
            currentUserId,
        },
      );

      return;
    }

    socket.emit(
      "task.lock.acquire",
      {
        taskId,
        teamId:
          currentTeamId,
        userId:
          currentUserId,
        userName:
          activeUsername ||
          "Team Member",
      },
    );
  };

  /* ===================================================
     PROPERTY UPDATE

     IMPORTANT:
     We do NOT manually add an UpdateLog here.

     The backend:
       1. saves task
       2. creates ActivityLog
       3. emits task.updated
       4. emits task.activity.created

     Therefore the Updates section receives the
     authoritative activity from the server.

     This avoids duplicate activity entries.
  =================================================== */

  const handlePropertyChange =
    useCallback(
      async (
        field: string,
        newValue:
          | TaskStatus
          | PriorityType
          | string,
        _updateText: string,
        _updateType: UpdateLog["type"],
      ) => {
        if (isLocked) {
          setActionMessage(
            `Task is locked${
              lockedBy
                ? ` by ${lockedBy}`
                : ""
            }`,
          );

          return;
        }

        const updatedStatus =
          field === "status"
            ? (newValue as TaskStatus)
            : currentStatus;

        const updatedPriority =
          field === "priority"
            ? (newValue as PriorityType)
            : currentPriority;

        const updatedAssignee =
          field === "assignee"
            ? String(newValue)
            : currentAssignee;

        const updatedReporter =
          field === "reporter"
            ? String(newValue)
            : currentReporter;

        const updatedTeams =
          field === "teams"
            ? String(newValue)
            : currentTeams;

        const updatedStartDate =
          field === "startDate"
            ? String(newValue)
            : startDate;

        const updatedDueDate =
          field === "endDate"
            ? String(newValue)
            : endDate;

        const updatedTask:
          ExtendedTaskItem = {
          ...task,

          status:
            updatedStatus,

          priority:
            updatedPriority,

          assignee:
            updatedAssignee,

          reporter:
            updatedReporter,

          startDate:
            updatedStartDate,

          dueDate:
            updatedDueDate,

          isLocked,

          lockedByUserId,

          lockedBy,
        };

        try {
          await onUpdateTask?.(
            updatedTask,
          );
        } catch (error) {
          console.error(
            "[TaskDetails] Property update failed:",
            error,
          );

          setActionMessage(
            error instanceof Error
              ? error.message
              : "Failed to update task",
          );
        }
      },
      [
        currentStatus,
        currentPriority,
        currentAssignee,
        currentReporter,
        currentTeams,
        startDate,
        endDate,
        task,
        onUpdateTask,
        isLocked,
        lockedBy,
        lockedByUserId,
      ],
    );

  /* ===================================================
     COPY TASK LINK
  =================================================== */

  const handleCopyTaskLink =
    async () => {
      try {
        if (!taskShareUrl) {
          return;
        }

        await navigator.clipboard.writeText(
          taskShareUrl,
        );

        setShareCopied(true);

        setActionMessage(
          "Task link copied",
        );

        window.setTimeout(() => {
          setShareCopied(false);
          setActionMessage(null);
        }, 2000);
      } catch (error) {
        console.error(
          "Failed to copy task link:",
          error,
        );

        setActionMessage(
          "Unable to copy link",
        );
      }
    };

  /* ===================================================
     SHARE TASK
  =================================================== */

  const handleShareTask =
    async () => {
      if (!taskShareUrl) {
        return;
      }

      setShareLoading(true);

      try {
        if (navigator.share) {
          await navigator.share({
            title: task.title,
            text: `Task: ${task.title}`,
            url: taskShareUrl,
          });

          setActionMessage(
            "Task shared successfully",
          );
        } else {
          await handleCopyTaskLink();
        }

        await onShareTask?.(
          String(task.id),
          sharePermission,
        );
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name ===
            "AbortError"
        ) {
          return;
        }

        console.error(
          "Share failed:",
          error,
        );

        setActionMessage(
          "Unable to share task",
        );
      } finally {
        setShareLoading(
          false,
        );
      }
    };

  /* ===================================================
     DELETE TASK

     The parent dashboard currently does not pass an onDeleteTask
     callback into this modal. Keep the callback path for callers that
     do provide it, but use the same backend DELETE endpoint as the
     dashboard as a safe fallback so Delete Task works from this menu.
  =================================================== */

  const handleDeleteTask =
    async () => {
      const confirmed =
        window.confirm(
          `Delete "${task.title}"?\n\nThis action cannot be undone.`,
        );

      if (!confirmed) {
        return;
      }

      setMoreActionLoading(true);

      try {
        if (onDeleteTask) {
          await onDeleteTask(
            String(task.id),
          );
        } else {
          const userId =
            activeUserId ||
            window.localStorage.getItem(
              "userId",
            ) ||
            "";

          const token =
            window.localStorage.getItem(
              "authToken",
            );

          if (!userId) {
            throw new Error(
              "User session not found.",
            );
          }

          const apiUrl =
            process.env.NEXT_PUBLIC_API_URL ||
            "http://localhost:4000/api";

          const response =
            await fetch(
              `${apiUrl}/tasks/${encodeURIComponent(
                String(task.id),
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
              },
            );

          if (!response.ok) {
            const errorData: unknown =
              await response
                .json()
                .catch(() => null);

            const message =
              errorData &&
              typeof errorData === "object" &&
              "message" in errorData &&
              typeof (errorData as {
                message?: unknown;
              }).message === "string"
                ? (errorData as {
                    message: string;
                  }).message
                : "Failed to delete task";

            throw new Error(message);
          }
        }

        setIsMoreOpen(false);
        setActionMessage(
          "Task deleted successfully",
        );
        onClose();
      } catch (error) {
        console.error(
          "Delete task failed:",
          error,
        );

        setActionMessage(
          error instanceof Error
            ? error.message
            : "Unable to delete task",
        );
      } finally {
        setMoreActionLoading(false);
      }
    };

  /* ===================================================
     CALENDAR
  =================================================== */

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const monthName =
    monthNames[
      currentDate.getMonth()
    ];

  const currentYear =
    currentDate.getFullYear();

  const daysInMonthCount =
    new Date(
      currentYear,
      currentDate.getMonth() + 1,
      0,
    ).getDate();

  const firstDayIndex =
    new Date(
      currentYear,
      currentDate.getMonth(),
      1,
    ).getDay();

  const handlePrevMonth =
    () => {
      setCurrentDate(
        new Date(
          currentYear,
          currentDate.getMonth() - 1,
          1,
        ),
      );
    };

  const handleNextMonth =
    () => {
      setCurrentDate(
        new Date(
          currentYear,
          currentDate.getMonth() + 1,
          1,
        ),
      );
    };

  /* ===================================================
     DATE PICKER

     Both startDate and endDate are persisted.
     The backend stores "DD Mon YYYY" while this modal
     intentionally displays only "DD Mon".
  =================================================== */

  const parsePersistedDate = (value: string): Date | null => {
    const match = value
      .trim()
      .match(
        /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/,
      );

    if (!match) return null;

    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    const monthIndex = months.indexOf(match[2]);
    if (monthIndex < 0) return null;

    return new Date(
      Number(match[3]),
      monthIndex,
      Number(match[1]),
    );
  };

  const formatDateForUi = (value: string): string => {
    const match = value
      .trim()
      .match(
        /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/,
      );

    if (!match) return value;

    return `${String(Number(match[1])).padStart(2, "0")} ${match[2]}`;
  };

  const openPickerFor = (
    field: "start" | "end",
  ) => {
    if (isLocked) {
      setActionMessage(
        `Task is locked${
          lockedBy
            ? ` by ${lockedBy}`
            : ""
        }`,
      );

      return;
    }

    setActiveDateField(field);

    const selectedValue =
      field === "start" ? startDate : endDate;

    const selectedDate = selectedValue
      ? parsePersistedDate(selectedValue)
      : null;

    setCurrentDate(
      selectedDate
        ? new Date(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            1,
          )
        : new Date(),
    );

    setIsDatePickerOpen(true);
  };

  const handleSelectDate = (day: number) => {
    if (isLocked) {
      setIsDatePickerOpen(false);
      return;
    }

    const formatted =
      `${String(day).padStart(2, "0")} ${monthName.substring(
        0,
        3,
      )} ${currentYear}`;

    setIsDatePickerOpen(false);

    if (activeDateField === "start") {
      setStartDate(formatted);

      void handlePropertyChange(
        "startDate",
        formatted,
        `changed start date to ${formatted}`,
        "date",
      );

      return;
    }

    setEndDate(formatted);

    void handlePropertyChange(
      "endDate",
      formatted,
      `changed due date to ${formatted}`,
      "date",
    );
  };

  /* ===================================================
     PRIORITY BADGE
  =================================================== */

  const renderPriorityBadge =
    (
      priority: PriorityType = "Medium",
    ) => {
      switch (priority) {
        case "Urgent":
          return (
            <span className="flex items-center gap-1 font-medium text-red-500">
              <SignalHigh className="h-3 w-3" />
              Urgent
            </span>
          );

        case "High":
          return (
            <span className="flex items-center gap-1 font-medium text-orange-500">
              <SignalHigh className="h-3 w-3" />
              High
            </span>
          );

        case "Medium":
          return (
            <span className="flex items-center gap-1 font-medium text-amber-500">
              <SignalMedium className="h-3 w-3" />
              Medium
            </span>
          );

        case "Low":
          return (
            <span className="flex items-center gap-1 font-medium text-gray-400">
              <SignalLow className="h-3 w-3" />
              Low
            </span>
          );

        default:
          return (
            <span className="flex items-center gap-1 font-medium text-gray-400">
              <SignalLow className="h-3 w-3" />
              No Priority
            </span>
          );
      }
    };

  /* ===================================================
     STATUS COLOR
  =================================================== */

  const getStatusColor =
    (
      status: TaskStatus | string,
    ) => {
      switch (status) {
        case "To Do":
          return {
            dot: "bg-gray-400",
            text: "text-gray-500",
          };

        case "Doing":
          return {
            dot: "bg-blue-500",
            text: "text-blue-500",
          };

        case "On Hold":
          return {
            dot: "bg-purple-500",
            text: "text-purple-500",
          };

        case "Completed":
          return {
            dot: "bg-emerald-500",
            text: "text-emerald-500",
          };

        default:
          return {
            dot: "bg-amber-500",
            text: "text-amber-500",
          };
      }
    };

  /* ===================================================
     EMOJI
  =================================================== */

  const emojis = [
    "😀",
    "😂",
    "😍",
    "😊",
    "👍",
    "👏",
    "🔥",
    "🎉",
    "❤️",
    "🚀",
    "✅",
    "👀",
    "💯",
    "🙏",
    "😎",
    "🤔",
  ];

  const handleCommentEmojiSelect =
    (emoji: string) => {
      setCommentText(
        (previous) =>
          `${previous}${emoji}`,
      );

      setCommentEmojiPickerOpen(
        false,
      );
    };

  const handleReplyEmojiSelect =
    (emoji: string) => {
      setReplyText(
        (previous) =>
          `${previous}${emoji}`,
      );

      setReplyEmojiPickerOpen(
        false,
      );
    };

  /* ===================================================
     FILE
  =================================================== */

  const handleCommentFileChange =
    (
      event: React.ChangeEvent<HTMLInputElement>,
    ) => {
      const file =
        event.target.files?.[0];

      if (!file) {
        return;
      }

      const url =
        URL.createObjectURL(
          file,
        );

      window.open(
        url,
        "_blank",
        "noopener,noreferrer",
      );

      event.target.value =
        "";
    };

  /* ===================================================
     REPLY
  =================================================== */

  const handleReplySubmit =
    async () => {
      const value =
        replyText.trim();

      if (!value) {
        return;
      }

      if (!selectedComment) {
        setActionMessage(
          "Please select a comment to reply to",
        );

        return;
      }

      if (!activeUserId) {
        setActionMessage(
          "User session not found",
        );

        return;
      }

      try {
        const response =
          await fetch(
            `http://localhost:4000/api/tasks/${task.id}/comments/${selectedComment.id}/replies`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                userId:
                  activeUserId,
                content: value,
              }),
            },
          );

        if (!response.ok) {
          const errorData =
            await response
              .json()
              .catch(
                () => null,
              );

          throw new Error(
            errorData?.message ||
              "Failed to add reply",
          );
        }

        setReplyText("");

        setSelectedComment(
          null,
        );

        setSelectedCommentId(
          null,
        );

        setSelectedCommentText(
          "",
        );

        setReplyEmojiPickerOpen(
          false,
        );

        setCommentEmojiPickerOpen(
          false,
        );
      } catch (error) {
        console.error(
          "[Reply] Failed:",
          error,
        );

        setActionMessage(
          error instanceof Error
            ? error.message
            : "Failed to add reply",
        );
      }
    };

  /* ===================================================
     COMMENT
  =================================================== */

  const handleCommentSubmit =
    async () => {
      const value =
        commentText.trim();

      if (!value) {
        return;
      }

      if (!activeUserId) {
        setActionMessage(
          "User session not found",
        );

        return;
      }

      try {
        const response =
          await fetch(
            `http://localhost:4000/api/tasks/${task.id}/comments`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                userId:
                  activeUserId,
                content: value,
              }),
            },
          );

        if (!response.ok) {
          const errorData =
            await response
              .json()
              .catch(
                () => null,
              );

          throw new Error(
            errorData?.message ||
              "Failed to add comment",
          );
        }

        setCommentText("");

        setCommentEmojiPickerOpen(
          false,
        );
      } catch (error) {
        console.error(
          "[Comment] Failed:",
          error,
        );

        setActionMessage(
          error instanceof Error
            ? error.message
            : "Failed to add comment",
        );
      }
    };

  /* ===================================================
     SUBTASKS
  =================================================== */

  const resetSubtaskForm = () => {
    setSubtaskForm({
      title: "",
      priority: "Medium",
      assignee: "",
      dueDate: "",
    });
    setEditingSubtaskId(null);
    setIsAddingSubtask(false);
    setOpenSubtaskMenuId(null);
    setSubtaskActionError(null);
  };

  const formatSubtaskDateForStorage = (value: string): string => {
    if (!value) return "";

    if (/^\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$/.test(value)) {
      return value;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-");
      const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];
      return `${day} ${months[Number(month) - 1]} ${year}`;
    }

    return value;
  };

  const formatSubtaskDateForInput = (value: string): string => {
    if (!value) return "";

    const match = value.trim().match(
      /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i,
    );

    if (!match) {
      return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
    }

    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const month = months.findIndex(
      (item) => item.toLowerCase() === match[2].toLowerCase(),
    ) + 1;

    return `${match[3]}-${String(month).padStart(2, "0")}-${String(
      Number(match[1]),
    ).padStart(2, "0")}`;
  };

  const getSubtaskAssigneeName = (assignee?: string): string => {
    const value = assignee?.trim() || "";
    if (!value) return "Unassigned";

    const member = teamMembers.find(
      (item) =>
        String(item.id ?? "") === value ||
        String(item.name ?? "") === value ||
        String(item.email ?? "") === value,
    );

    return member?.name || member?.email || value;
  };

  const openAddSubtask = () => {
    if (isLocked) {
      setActionMessage(
        `Task is locked${lockedBy ? ` by ${lockedBy}` : ""}`,
      );
      return;
    }

    setSubtaskForm({
      title: "",
      priority: "Medium",
      assignee: currentAssignee,
      dueDate: "",
    });
    setEditingSubtaskId(null);
    setSubtaskActionError(null);
    setOpenSubtaskMenuId(null);
    setIsAddingSubtask(true);
  };

  const openEditSubtask = (subtask: Subtask) => {
    if (!subtask.id) return;

    if (isLocked) {
      setActionMessage(
        `Task is locked${lockedBy ? ` by ${lockedBy}` : ""}`,
      );
      return;
    }

    setSubtaskForm({
      title: subtask.title || "",
      priority: subtask.priority || "Medium",
      assignee: subtask.assignee || currentAssignee,
      dueDate: formatSubtaskDateForInput(subtask.dueDate || ""),
    });
    setEditingSubtaskId(subtask.id);
    setSubtaskActionError(null);
    setOpenSubtaskMenuId(null);
    setIsAddingSubtask(true);
  };

  const handleSaveSubtask = async () => {
    const title = subtaskForm.title.trim();

    if (!title) {
      setSubtaskActionError("Subtask title is required");
      return;
    }

    if (!activeUserId) {
      setSubtaskActionError("User session not found");
      return;
    }

    setIsSubtaskSaving(true);
    setSubtaskActionError(null);

    const subtaskId = editingSubtaskId;
    const isEdit = Boolean(subtaskId);
    const dueDate = formatSubtaskDateForStorage(
      subtaskForm.dueDate,
    );

    try {
      const response = await fetch(
        isEdit
          ? `http://localhost:4000/api/tasks/${task.id}/subtasks/${subtaskId}`
          : `http://localhost:4000/api/tasks/${task.id}/subtasks`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            isEdit
              ? {
                  userId: activeUserId,
                  title,
                  priority: subtaskForm.priority,
                  assignee: subtaskForm.assignee,
                  dueDate,
                }
              : {
                  userId: activeUserId,
                  title,
                  priority: subtaskForm.priority,
                  assignee: subtaskForm.assignee,
                  dueDate,
                },
          ),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.message ||
            (isEdit
              ? "Failed to update subtask"
              : "Failed to add subtask"),
        );
      }

      const savedResponse: unknown = await response.json().catch(() => null);

      // The API returns the refreshed parent task. Use its subtasks when
      // available; otherwise update this modal optimistically.
      const refreshedTask =
        savedResponse &&
        typeof savedResponse === "object" &&
        Array.isArray(
          (savedResponse as { subtasks?: unknown }).subtasks,
        )
          ? (savedResponse as { subtasks: Subtask[] })
          : null;

      // Give the authoritative REST response a small window in which it
      // cannot be overwritten by the older task.updated socket snapshot.
      subtaskLocalMutationUntilRef.current =
        Date.now() + 5000;

      if (refreshedTask) {
        setSubtasks(refreshedTask.subtasks);
      } else if (isEdit && subtaskId) {
        setSubtasks((previous) =>
          previous.map((item) =>
            item.id === subtaskId
              ? {
                  ...item,
                  title,
                  priority: subtaskForm.priority,
                  assignee: subtaskForm.assignee,
                  dueDate,
                }
              : item,
          ),
        );
      } else {
        // createSubtask currently returns the refreshed task, but keep a
        // safe fallback for older backend responses.
        setSubtasks((previous) => [
          ...previous,
          {
            id: `local-${Date.now()}`,
            title,
            priority: subtaskForm.priority,
            assignee: subtaskForm.assignee,
            dueDate,
            completed: false,
          },
        ]);
      }

      resetSubtaskForm();
    } catch (error) {
      console.error(
        isEdit
          ? "[Subtask] Failed to update:"
          : "[Subtask] Failed to add:",
        error,
      );
      setSubtaskActionError(
        error instanceof Error
          ? error.message
          : isEdit
            ? "Failed to update subtask"
            : "Failed to add subtask",
      );
    } finally {
      setIsSubtaskSaving(false);
    }
  };

  const handleToggleSubtaskCompleted = async (
    subtaskId: string,
    completed: boolean,
  ) => {
    if (!activeUserId || !subtaskId) return;

    try {
      const response = await fetch(
        `http://localhost:4000/api/tasks/${task.id}/subtasks/${subtaskId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: activeUserId,
            completed,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.message || "Failed to update subtask",
        );
      }

      subtaskLocalMutationUntilRef.current =
        Date.now() + 5000;

      setSubtasks((previous) =>
        previous.map((item) =>
          item.id === subtaskId
            ? { ...item, completed }
            : item,
        ),
      );
    } catch (error) {
      console.error("[Subtask] Failed to update:", error);
      setSubtaskActionError(
        error instanceof Error
          ? error.message
          : "Failed to update subtask",
      );
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!activeUserId || !subtaskId) return;

    const subtask = subtasks.find((item) => item.id === subtaskId);
    const confirmed = window.confirm(
      `Delete subtask "${subtask?.title || "this subtask"}"?\n\nThis action cannot be undone.`,
    );

    if (!confirmed) return;

    setOpenSubtaskMenuId(null);
    setSubtaskActionError(null);
    setIsSubtaskSaving(true);

    try {
      const response = await fetch(
        `http://localhost:4000/api/tasks/${task.id}/subtasks/${subtaskId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: activeUserId,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.message || "Failed to remove subtask",
        );
      }

      subtaskLocalMutationUntilRef.current =
        Date.now() + 5000;

      setSubtasks((previous) =>
        previous.filter((item) => item.id !== subtaskId),
      );
    } catch (error) {
      console.error("[Subtask] Failed to remove:", error);
      setSubtaskActionError(
        error instanceof Error
          ? error.message
          : "Failed to remove subtask",
      );
    } finally {
      setIsSubtaskSaving(false);
    }
  };


  /* ===================================================
     RESOURCES
  =================================================== */

  const handleAddResourceLink =
    async () => {
      const name =
        newResourceName.trim();

      const url =
        newResourceUrl.trim();

      if (!name || !url) {
        setResourceActionError(
          "Name and link are both required",
        );

        return;
      }

      if (!activeUserId) {
        setResourceActionError(
          "User session not found",
        );

        return;
      }

      setIsResourceSaving(
        true,
      );

      setResourceActionError(
        null,
      );

      try {
        const response =
          await fetch(
            `http://localhost:4000/api/tasks/${task.id}/resources`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                userId:
                  activeUserId,
                name,
                url,
              }),
            },
          );

        if (!response.ok) {
          const errorData =
            await response
              .json()
              .catch(
                () => null,
              );

          throw new Error(
            errorData?.message ||
              "Failed to add resource",
          );
        }

        setNewResourceName(
          "",
        );

        setNewResourceUrl(
          "",
        );

        setIsAddingResourceLink(
          false,
        );
      } catch (error) {
        console.error(
          "[Resource] Failed to add:",
          error,
        );

        setResourceActionError(
          error instanceof Error
            ? error.message
            : "Failed to add resource",
        );
      } finally {
        setIsResourceSaving(
          false,
        );
      }
    };

  const handleDeleteResource =
    async (
      resourceId: string,
    ) => {
      if (
        !activeUserId ||
        !resourceId
      ) {
        return;
      }

      try {
        const response =
          await fetch(
            `http://localhost:4000/api/tasks/${task.id}/resources/${resourceId}`,
            {
              method: "DELETE",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                userId:
                  activeUserId,
              }),
            },
          );

        if (!response.ok) {
          const errorData =
            await response
              .json()
              .catch(
                () => null,
              );

          throw new Error(
            errorData?.message ||
              "Failed to remove resource",
          );
        }
      } catch (error) {
        console.error(
          "[Resource] Failed to remove:",
          error,
        );

        setResourceActionError(
          error instanceof Error
            ? error.message
            : "Failed to remove resource",
        );
      }
    };

  /* ===================================================
     RESOURCE FILE / FOLDER UPLOAD + EDITING
  =================================================== */

  type ResourceWithMeta = TaskResource & {
    type?: string;
    mimeType?: string | null;
    fileSize?: number | null;
  };

  const getResourceMeta = (
    resource: TaskResource,
  ) =>
    resource as ResourceWithMeta;

  const isFileResource = (
    resource: TaskResource,
  ) =>
    getResourceMeta(resource).type ===
    "file";

  const applyResourceResponse = (
    data: unknown,
  ) => {
    if (
      typeof data === "object" &&
      data !== null &&
      Array.isArray(
        (data as { resources?: unknown })
          .resources,
      )
    ) {
      setResourceItems(
        (data as {
          resources: TaskResource[];
        }).resources,
      );
    }
  };

  const getResourceFileUrl = (
    resource: TaskResource,
    download = false,
  ) => {
    const query =
      `userId=${encodeURIComponent(
        activeUserId,
      )}`;

    return `http://localhost:4000/api/tasks/${task.id}/resources/${resource.id}/file?${query}${
      download
        ? "&download=true"
        : ""
    }`;
  };

  const resetResourceForms = () => {
    setIsAddingResourceLink(false);
    setIsResourceMenuOpen(false);
    setNewResourceName("");
    setNewResourceUrl("");
    setResourceActionError(null);
  };

  const handleUploadResourceFile =
    async (file: File) => {
      if (!activeUserId) {
        setResourceActionError(
          "User session not found",
        );
        return;
      }

      setIsResourceUploading(true);
      setResourceActionError(null);

      try {
        const formData =
          new FormData();

        formData.append(
          "file",
          file,
        );
        formData.append(
          "userId",
          activeUserId,
        );
        formData.append(
          "name",
          file.name,
        );

        const response =
          await fetch(
            `http://localhost:4000/api/tasks/${task.id}/resources/upload`,
            {
              method: "POST",
              body: formData,
            },
          );

        const data =
          await response.json().catch(
            () => null,
          );

        if (!response.ok) {
          throw new Error(
            data?.message ||
              "Failed to upload file",
          );
        }

        applyResourceResponse(data);
        setIsResourceMenuOpen(false);
      } catch (error) {
        console.error(
          "[Resource] File upload failed:",
          error,
        );

        setResourceActionError(
          error instanceof Error
            ? error.message
            : "Failed to upload file",
        );
      } finally {
        setIsResourceUploading(false);
      }
    };

  const handleResourceFileChange =
    async (
      event: React.ChangeEvent<HTMLInputElement>,
    ) => {
      const file =
        event.target.files?.[0];

      event.target.value = "";

      if (file) {
        await handleUploadResourceFile(
          file,
        );
      }
    };

  const handleResourceFolderChange =
    async (
      event: React.ChangeEvent<HTMLInputElement>,
    ) => {
      const files: File[] =
        Array.from(
          event.target.files || [],
        ) as File[];

      event.target.value = "";

      if (!files.length) {
        return;
      }

      if (!activeUserId) {
        setResourceActionError(
          "User session not found",
        );
        return;
      }

      setIsResourceUploading(true);
      setResourceActionError(null);

      try {
        const formData =
          new FormData();

        files.forEach((file) =>
          formData.append(
            "files",
            file,
          ),
        );

        formData.append(
          "userId",
          activeUserId,
        );

        const response =
          await fetch(
            `http://localhost:4000/api/tasks/${task.id}/resources/upload-many`,
            {
              method: "POST",
              body: formData,
            },
          );

        const data =
          await response.json().catch(
            () => null,
          );

        if (!response.ok) {
          throw new Error(
            data?.message ||
              "Failed to upload folder",
          );
        }

        applyResourceResponse(data);
        setIsResourceMenuOpen(false);
      } catch (error) {
        console.error(
          "[Resource] Folder upload failed:",
          error,
        );

        setResourceActionError(
          error instanceof Error
            ? error.message
            : "Failed to upload folder",
        );
      } finally {
        setIsResourceUploading(false);
      }
    };

  const handleOpenResource =
    (resource: TaskResource) => {
      if (isFileResource(resource)) {
        if (!activeUserId) {
          setActionMessage(
            "User session not found",
          );
          return;
        }

        window.open(
          getResourceFileUrl(
            resource,
          ),
          "_blank",
          "noopener,noreferrer",
        );
        return;
      }

      if (resource.url) {
        window.open(
          resource.url,
          "_blank",
          "noopener,noreferrer",
        );
      }
    };

  const handleDownloadResource =
    (resource: TaskResource) => {
      if (
        !isFileResource(resource)
      ) {
        handleOpenResource(resource);
        return;
      }

      if (!activeUserId) {
        setActionMessage(
          "User session not found",
        );
        return;
      }

      window.open(
        getResourceFileUrl(
          resource,
          true,
        ),
        "_blank",
        "noopener,noreferrer",
      );
    };

  const handleStartResourceEdit =
    (resource: TaskResource) => {
      const meta =
        getResourceMeta(resource);

      setEditingResourceId(
        resource.id,
      );
      setEditingResourceName(
        resource.name || "",
      );
      setEditingResourceUrl(
        meta.type === "file"
          ? ""
          : resource.url || "",
      );
      setResourceActionError(null);
    };

  const handleCancelResourceEdit =
    () => {
      setEditingResourceId(null);
      setEditingResourceName("");
      setEditingResourceUrl("");
      setResourceActionError(null);
    };

  const handleSaveResourceEdit =
    async () => {
      if (
        !editingResourceId ||
        !activeUserId
      ) {
        return;
      }

      const name =
        editingResourceName.trim();

      if (!name) {
        setResourceActionError(
          "Resource name cannot be empty",
        );
        return;
      }

      const resource =
        resourceItems.find(
          (item) =>
            item.id ===
            editingResourceId,
        );

      if (!resource) {
        return;
      }

      setResourceEditSaving(true);
      setResourceActionError(null);

      try {
        const body: {
          userId: string;
          name: string;
          url?: string;
        } = {
          userId:
            activeUserId,
          name,
        };

        if (
          !isFileResource(resource)
        ) {
          body.url =
            editingResourceUrl.trim();
        }

        const response =
          await fetch(
            `http://localhost:4000/api/tasks/${task.id}/resources/${editingResourceId}`,
            {
              method: "PUT",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify(
                body,
              ),
            },
          );

        const data =
          await response.json().catch(
            () => null,
          );

        if (!response.ok) {
          throw new Error(
            data?.message ||
              "Failed to update resource",
          );
        }

        applyResourceResponse(data);
        handleCancelResourceEdit();
      } catch (error) {
        console.error(
          "[Resource] Update failed:",
          error,
        );

        setResourceActionError(
          error instanceof Error
            ? error.message
            : "Failed to update resource",
        );
      } finally {
        setResourceEditSaving(false);
      }
    };

  /* ===================================================
     RENDER GUARD
  =================================================== */

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-0 backdrop-blur-sm sm:p-3 md:p-8">
      {/* BACKDROP */}
      <div
        className="absolute inset-0"
        onClick={onClose}
      />

      {/* MODAL */}
      <div className="relative z-10 flex h-[100dvh] max-h-[100dvh] w-full max-w-6xl flex-col overflow-hidden rounded-none border sm:h-[92vh] sm:max-h-[92vh] sm:rounded-2xl border-gray-200 bg-white text-slate-800 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 dark:text-gray-100">

        {/* =================================================
            TOP BAR
        ================================================= */}

        <div className="flex items-center justify-end border-b border-gray-100 px-5 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">

            {/* LOCK */}
            <div
              className="relative"
              ref={lockRef}
            >
              <button
                type="button"
                onClick={
                  handleToggleLock
                }
                disabled={
                  isLocked &&
                  lockedByUserId !==
                    activeUserId
                }
                title={
                  isLocked
                    ? lockedByUserId ===
                      activeUserId
                      ? "Unlock task"
                      : `Task locked by ${
                          lockedBy ||
                          "another team member"
                        }`
                    : "Lock task"
                }
                className={`rounded-lg border p-1.5 transition ${
                  isLocked
                    ? "border-purple-300 bg-purple-50 text-purple-600 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                } ${
                  isLocked &&
                  lockedByUserId !==
                    activeUserId
                    ? "cursor-not-allowed opacity-60"
                    : ""
                }`}
              >
                {isLocked ? (
                  <Unlock className="h-3.5 w-3.5" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
              </button>

              {isLocked && (
                <div className="absolute right-0 top-9 z-50 whitespace-nowrap rounded-lg border border-purple-200 bg-white px-3 py-2 text-[10px] shadow-lg dark:border-purple-900 dark:bg-zinc-900">
                  <div className="font-semibold text-purple-600 dark:text-purple-300">
                    Task locked
                  </div>

                  <div className="mt-0.5 text-gray-400">
                    By{" "}
                    {lockedBy ||
                      "You"}
                  </div>
                </div>
              )}
            </div>

            {/* VIEWERS */}
            <div
              className="relative"
              ref={viewerRef}
            >
              <button
                type="button"
                onClick={() =>
                  setIsViewerListOpen(
                    (previous) =>
                      !previous,
                  )
                }
                title={
                  isRealtimeConnected
                    ? "People currently viewing"
                    : "Realtime connection unavailable"
                }
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-900"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>
                  {viewerCount}
                </span>

                <span
                  className={`ml-0.5 h-1.5 w-1.5 rounded-full ${
                    isRealtimeConnected
                      ? "bg-green-500"
                      : "bg-gray-400"
                  }`}
                />
              </button>

              {isViewerListOpen && (
                <div className="absolute right-0 top-9 z-50 w-56 rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold">
                      Currently viewing
                    </span>

                    <span className="text-[10px] text-gray-400">
                      {viewerCount}
                    </span>
                  </div>

                  {!isRealtimeConnected && (
                    <div className="mb-2 rounded-md bg-gray-50 px-2 py-1.5 text-[10px] text-gray-400 dark:bg-zinc-800">
                      Realtime connection unavailable
                    </div>
                  )}

                  {liveViewers.length ===
                  0 ? (
                    <div className="py-3 text-center text-xs text-gray-400">
                      No viewers
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {liveViewers.map(
                        (viewer) => (
                          <div
                            key={
                              viewer.userId
                            }
                            className="flex items-center gap-2"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white">
                              {viewer.userName
                                ?.charAt(
                                  0,
                                )
                                .toUpperCase() ||
                                "U"}
                            </span>

                            <span className="min-w-0 truncate text-xs">
                              {viewer.userId ===
                              activeUserId
                                ? "You"
                                : viewer.userName}
                            </span>

                            {viewer.userId ===
                              activeUserId && (
                              <span className="ml-auto text-[9px] text-green-500">
                                viewing
                              </span>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  )}

                  {otherViewerCount >
                    0 && (
                    <div className="mt-3 border-t border-gray-100 pt-2 text-[10px] text-gray-400 dark:border-zinc-800">
                      {
                        otherViewerCount
                      }{" "}
                      {otherViewerCount ===
                      1
                        ? "person"
                        : "people"}{" "}
                      viewing this task
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SHARE */}
            <div
              className="relative"
              ref={shareRef}
            >
              <button
                type="button"
                onClick={() => {
                  setIsShareOpen(
                    (previous) =>
                      !previous,
                  );

                  setIsMoreOpen(
                    false,
                  );

                  setIsViewerListOpen(
                    false,
                  );
                }}
                title="Share task"
                className={`rounded-lg border p-1.5 transition ${
                  isShareOpen
                    ? "border-purple-300 bg-purple-50 text-purple-600 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                }`}
              >
                <Share2 className="h-3.5 w-3.5" />
              </button>

              {isShareOpen && (
                <div className="absolute right-0 top-9 z-[60] w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">
                        Share task
                      </h3>

                      <p className="mt-0.5 text-[10px] text-gray-400">
                        Share this task with your team
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setIsShareOpen(
                          false,
                        )
                      }
                      className="rounded-md p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mb-4">
                    <label className="mb-1.5 block text-[10px] font-medium text-gray-500">
                      Task link
                    </label>

                    <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 p-1.5 dark:border-zinc-800">
                      <input
                        readOnly
                        value={
                          taskShareUrl
                        }
                        className="min-w-0 flex-1 bg-transparent px-1 text-[10px] outline-none"
                      />

                      <button
                        type="button"
                        onClick={
                          handleCopyTaskLink
                        }
                        className="flex shrink-0 items-center gap-1 rounded-md bg-gray-100 px-2 py-1.5 text-[10px] font-medium hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                      >
                        {shareCopied ? (
                          <>
                            <Check className="h-3 w-3" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={
                      shareLoading
                    }
                    onClick={
                      handleShareTask
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {shareLoading
                      ? "Sharing..."
                      : (
                        <>
                          <Share2 className="h-3.5 w-3.5" />
                          Share task
                        </>
                      )}
                  </button>
                </div>
              )}
            </div>

            {/* MORE */}
            <div
              className="relative"
              ref={moreRef}
            >
              <button
                type="button"
                onClick={() => {
                  setIsMoreOpen(
                    (previous) =>
                      !previous,
                  );

                  setIsShareOpen(
                    false,
                  );

                  setIsViewerListOpen(
                    false,
                  );
                }}
                title="More options"
                className={`rounded-lg border p-1.5 transition ${
                  isMoreOpen
                    ? "border-purple-300 bg-purple-50 text-purple-600 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                }`}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>

              {isMoreOpen && (
                <div className="absolute right-0 top-9 z-[60] w-52 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
                  <button
                    type="button"
                    onClick={
                      handleCopyTaskLink
                    }
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-zinc-800"
                  >
                    <Copy className="h-3.5 w-3.5 text-gray-400" />
                    Copy task link
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsShareOpen(
                        true,
                      );

                      setIsMoreOpen(
                        false,
                      );
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-zinc-800"
                  >
                    <UserPlus className="h-3.5 w-3.5 text-gray-400" />
                    Manage sharing
                  </button>

                  <div className="my-1 border-t border-gray-100 dark:border-zinc-800" />

                  <button
                    type="button"
                    onClick={
                      handleDeleteTask
                    }
                    disabled={
                      moreActionLoading
                    }
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-500 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete task
                  </button>
                </div>
              )}
            </div>

            {/* CLOSE */}
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="rounded-lg border border-gray-200 p-1.5 text-gray-500 transition hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ACTION MESSAGE */}
        {actionMessage && (
          <div className="absolute right-2 top-[60px] z-[70] max-w-[calc(100%-1rem)] sm:right-6 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[10px] font-medium text-gray-600 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:text-gray-300">
            {actionMessage}

            <button
              type="button"
              onClick={() =>
                setActionMessage(
                  null,
                )
              }
              className="ml-2 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        )}

        {/* LOCKED BANNER */}
        {isLocked && (
          <div className="flex flex-wrap items-center gap-2 border-b border-purple-100 bg-purple-50 px-3 py-2 sm:px-6 text-[10px] text-purple-700 dark:border-purple-950 dark:bg-purple-950/20 dark:text-purple-300">
            <Lock className="h-3 w-3" />

            <span>
              This task is locked by{" "}
              <strong>
                {lockedBy ||
                  "You"}
              </strong>
              . Property editing is disabled.
            </span>

            {lockedByUserId ===
              activeUserId && (
              <button
                type="button"
                onClick={
                  handleToggleLock
                }
                className="ml-auto font-semibold underline"
              >
                Unlock
              </button>
            )}
          </div>
        )}

        {/* BODY */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">

          {/* LEFT */}
          <div className="min-w-0 w-full flex-none overflow-visible px-4 py-5 sm:px-6 sm:py-6 lg:flex-1 lg:overflow-y-auto lg:px-8">
            <div className="space-y-5">

              <div>
                <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-slate-900 dark:text-white">
                  {task.title}
                </h1>

                <p className="mt-1.5 max-w-3xl text-xs leading-5 text-gray-500 dark:text-gray-400">
                  {task.description ||
                    "Create clear and detailed specifications to guide team members in completing this task effectively."}
                </p>
              </div>

              {/* PROPERTIES */}
              <div className="space-y-3 text-xs">

                <div className="flex items-center gap-4">
                  <span className="w-20 shrink-0 text-gray-400">
                    Properties
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 font-medium text-gray-700 dark:bg-zinc-900 dark:text-gray-200">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-100 text-[9px] font-medium text-gray-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {currentAssignee
                          ? currentAssignee
                              .charAt(
                                0,
                              )
                              .toUpperCase()
                          : "U"}
                      </span>

                      {currentAssignee ||
                        "Unassigned"}
                    </span>

                    {endDate && (
                      <span className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-red-500 dark:bg-red-950/40">
                        <CalendarIcon className="h-3 w-3" />
                        {formatDateForUi(endDate)}
                      </span>
                    )}
                  </div>
                </div>

                {/* LABELS */}
                <div className="flex items-start gap-4">
                  <span className="w-20 shrink-0 pt-1 text-gray-400">
                    Labels
                  </span>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {task.tags &&
                    task.tags.length >
                      0 ? (
                      task.tags.map(
                        (
                          label,
                        ) => (
                          <span
                            key={
                              label
                            }
                            className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50/70 px-2.5 py-1 text-[11px] text-gray-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-gray-300"
                          >
                            <Tag className="h-2.5 w-2.5 text-gray-400" />
                            {
                              label
                            }
                          </span>
                        ),
                      )
                    ) : (
                      <span className="text-gray-400">
                        -
                      </span>
                    )}
                  </div>
                </div>

                {/* RESOURCES */}
                <div className="flex items-start gap-4">
                  <span className="w-20 shrink-0 pt-1 text-gray-400">
                    Resources
                  </span>

                  <div className="min-w-0 flex-1 space-y-2">
                    {resourceItems.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        {resourceItems.map(
                          (resource: TaskResource) => {
                            const isFile =
                              isFileResource(
                                resource,
                              );

                            const isEditing =
                              editingResourceId ===
                              resource.id;

                            return (
                              <div
                                key={
                                  resource.id
                                }
                                className="group min-w-0 rounded-md border border-transparent px-1 py-1 transition hover:border-gray-200 hover:bg-gray-50/70 dark:hover:border-zinc-800 dark:hover:bg-zinc-900/60"
                              >
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <input
                                      type="text"
                                      value={
                                        editingResourceName
                                      }
                                      onChange={(
                                        event,
                                      ) =>
                                        setEditingResourceName(
                                          event
                                            .target
                                            .value,
                                        )
                                      }
                                      onKeyDown={(
                                        event,
                                      ) => {
                                        if (
                                          event.key ===
                                          "Enter"
                                        ) {
                                          void handleSaveResourceEdit();
                                        }

                                        if (
                                          event.key ===
                                          "Escape"
                                        ) {
                                          handleCancelResourceEdit();
                                        }
                                      }}
                                      className="w-full rounded-md border border-gray-200 bg-transparent px-2 py-1 text-xs outline-none focus:border-purple-400 dark:border-zinc-800"
                                      autoFocus
                                    />

                                    {!isFile && (
                                      <input
                                        type="text"
                                        value={
                                          editingResourceUrl
                                        }
                                        onChange={(
                                          event,
                                        ) =>
                                          setEditingResourceUrl(
                                            event
                                              .target
                                              .value,
                                          )
                                        }
                                        placeholder="https://..."
                                        className="w-full rounded-md border border-gray-200 bg-transparent px-2 py-1 text-xs outline-none focus:border-purple-400 dark:border-zinc-800"
                                      />
                                    )}

                                    <div className="flex justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={
                                          handleCancelResourceEdit
                                        }
                                        className="text-[11px] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        disabled={
                                          resourceEditSaving
                                        }
                                        onClick={() =>
                                          void handleSaveResourceEdit()
                                        }
                                        className="rounded-md bg-purple-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-purple-700 disabled:opacity-40"
                                      >
                                        {resourceEditSaving
                                          ? "Saving..."
                                          : "Save"}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex min-w-0 items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenResource(
                                          resource,
                                        )
                                      }
                                      className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left text-purple-600 hover:underline dark:text-purple-300"
                                    >
                                      {isFile ? (
                                        <FileText className="h-3.5 w-3.5 shrink-0" />
                                      ) : (
                                        <Link2 className="h-3.5 w-3.5 shrink-0" />
                                      )}
                                      <span className="truncate">
                                        {
                                          resource.name
                                        }
                                      </span>
                                    </button>

                                    <div className="flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                                      {isFile && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleDownloadResource(
                                              resource,
                                            )
                                          }
                                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-gray-200"
                                          title="Download"
                                        >
                                          <Download className="h-3.5 w-3.5" />
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleStartResourceEdit(
                                            resource,
                                          )
                                        }
                                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-gray-200"
                                        title="Edit"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          void handleDeleteResource(
                                            resource.id,
                                          )
                                        }
                                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-zinc-800"
                                        title="Delete"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          },
                        )}
                      </div>
                    )}

                    {resourceActionError && (
                      <p className="text-[10px] text-red-500">
                        {
                          resourceActionError
                        }
                      </p>
                    )}

                    {isAddingResourceLink ? (
                      <div className="space-y-2 rounded-lg border border-gray-200 p-2.5 dark:border-zinc-800">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                          <Link2 className="h-3.5 w-3.5" />
                          Add link
                        </div>

                        <input
                          type="text"
                          placeholder="Name"
                          value={
                            newResourceName
                          }
                          onChange={(
                            event,
                          ) =>
                            setNewResourceName(
                              event
                                .target
                                .value,
                            )
                          }
                          className="w-full rounded-md border border-gray-200 bg-transparent px-2 py-1 text-xs outline-none placeholder:text-gray-400 focus:border-purple-400 dark:border-zinc-800"
                        />

                        <input
                          type="text"
                          placeholder="https://..."
                          value={
                            newResourceUrl
                          }
                          onChange={(
                            event,
                          ) =>
                            setNewResourceUrl(
                              event
                                .target
                                .value,
                            )
                          }
                          onKeyDown={(
                            event,
                          ) => {
                            if (
                              event.key ===
                              "Enter"
                            ) {
                              void handleAddResourceLink();
                            }
                          }}
                          className="w-full rounded-md border border-gray-200 bg-transparent px-2 py-1 text-xs outline-none placeholder:text-gray-400 focus:border-purple-400 dark:border-zinc-800"
                        />

                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={
                              resetResourceForms
                            }
                            className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={
                              isResourceSaving ||
                              !newResourceName.trim() ||
                              !newResourceUrl.trim()
                            }
                            onClick={() =>
                              void handleAddResourceLink()
                            }
                            className="rounded-md bg-purple-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-purple-700 disabled:opacity-40"
                          >
                            {isResourceSaving
                              ? "Adding..."
                              : "Add"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <button
                          type="button"
                          disabled={
                            isResourceUploading
                          }
                          onClick={() =>
                            setIsResourceMenuOpen(
                              (previous) =>
                                !previous,
                            )
                          }
                          className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-50 dark:hover:text-gray-200"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add resource
                          <ChevronDown className="h-3 w-3" />
                        </button>

                        {isResourceMenuOpen && (
                          <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
                            <button
                              type="button"
                              onClick={() => {
                                setIsResourceMenuOpen(
                                  false,
                                );
                                setIsAddingResourceLink(
                                  true,
                                );
                                setResourceActionError(
                                  null,
                                );
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-zinc-900"
                            >
                              <Link2 className="h-3.5 w-3.5 text-purple-500" />
                              Add link
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                resourceFileInputRef.current?.click()
                              }
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-zinc-900"
                            >
                              <File className="h-3.5 w-3.5 text-blue-500" />
                              File from computer
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                resourceFolderInputRef.current?.click()
                              }
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-zinc-900"
                            >
                              <FolderOpen className="h-3.5 w-3.5 text-amber-500" />
                              Choose folder
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <input
                      ref={
                        resourceFileInputRef
                      }
                      type="file"
                      className="hidden"
                      onChange={
                        handleResourceFileChange
                      }
                    />

                    <input
                      ref={(node) => {
                        resourceFolderInputRef.current =
                          node;

                        if (node) {
                          const input =
                            node as HTMLInputElement & {
                              webkitdirectory?: boolean;
                              directory?: boolean;
                            };

                          input.webkitdirectory =
                            true;
                          input.directory =
                            true;
                        }
                      }}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={
                        handleResourceFolderChange
                      }
                    />

                    {isResourceUploading && (
                      <p className="text-[10px] text-gray-400">
                        Uploading resource...
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SUBTASKS */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() =>
                  setIsSubtasksOpen((previous) => !previous)
                }
                className="flex items-center gap-1.5 text-xs font-semibold"
              >
                {isSubtasksOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                Subtasks
              </button>

              {isSubtasksOpen && (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                  {/* IMPORTANT: only this area scrolls. The parent modal is not
                      used as the subtask scroll container. */}
                  <div className="max-h-[170px] overflow-auto overscroll-contain">
                    <table className="w-full min-w-[620px] text-left text-xs">
                      <thead className="sticky top-0 z-10 bg-gray-50/95 text-[11px] text-gray-500 backdrop-blur dark:bg-zinc-900/95 dark:text-gray-400">
                        <tr>
                          <th className="px-3 py-2.5 font-medium">Task</th>
                          <th className="px-3 py-2.5 font-medium">Priority</th>
                          <th className="px-3 py-2.5 font-medium">Members</th>
                          <th className="px-3 py-2.5 font-medium">Due Date</th>
                          <th className="px-3 py-2.5 text-right font-medium">Actions</th>
                        </tr>
                      </thead>

                      <tbody>
                        {subtasks.length > 0 ? (
                          subtasks.map((subtask: Subtask, idx: number) => {
                            const assigneeName = getSubtaskAssigneeName(
                              subtask.assignee,
                            );
                            const assigneeInitial =
                              assigneeName === "Unassigned"
                                ? "U"
                                : assigneeName.charAt(0).toUpperCase();

                            return (
                              <tr
                                key={subtask.id || `subtask-${idx}`}
                                className="border-t border-gray-100 dark:border-zinc-800"
                              >
                                <td className="max-w-[240px] px-3 py-3 font-medium">
                                  <span
                                    className={
                                      subtask.completed
                                        ? "text-gray-400 line-through"
                                        : ""
                                    }
                                    title={subtask.title}
                                  >
                                    {subtask.title}
                                  </span>
                                </td>

                                <td className="px-3 py-3">
                                  {renderPriorityBadge(
                                    subtask.priority || "Medium",
                                  )}
                                </td>

                                <td className="px-3 py-3">
                                  <div
                                    className="flex items-center gap-2"
                                    title={assigneeName}
                                  >
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white">
                                      {assigneeInitial}
                                    </span>
                                    <span className="max-w-[130px] truncate text-gray-600 dark:text-gray-300">
                                      {assigneeName}
                                    </span>
                                  </div>
                                </td>

                                <td className="whitespace-nowrap px-3 py-3 text-gray-500">
                                  {subtask.dueDate
                                    ? formatDateForUi(subtask.dueDate)
                                    : "-"}
                                </td>

                                <td className="relative px-3 py-3 text-right">
                                  <div
                                    className="relative inline-flex"
                                    data-subtask-menu
                                  >
                                    <button
                                      type="button"
                                      aria-label="Subtask actions"
                                      onClick={() =>
                                        setOpenSubtaskMenuId((previous) =>
                                          previous === subtask.id
                                            ? null
                                            : subtask.id || null,
                                        )
                                      }
                                      className="rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-900 dark:hover:text-gray-200"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </button>

                                    {openSubtaskMenuId === subtask.id && (
                                      <div className="absolute right-0 top-8 z-40 w-28 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                                        <button
                                          type="button"
                                          onClick={() => openEditSubtask(subtask)}
                                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-zinc-800"
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isSubtaskSaving}
                                          onClick={() =>
                                            subtask.id &&
                                            void handleDeleteSubtask(subtask.id)
                                          }
                                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-500 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                          Delete
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td
                              colSpan={5}
                              className="p-4 text-center text-gray-400"
                            >
                              No subtasks found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {subtaskActionError && (
                    <div className="border-t border-red-100 bg-red-50 px-3 py-2 text-[10px] text-red-500 dark:border-red-950 dark:bg-red-950/20">
                      {subtaskActionError}
                    </div>
                  )}

                  {isAddingSubtask ? (
                    <div className="space-y-3 border-t border-gray-100 p-3 dark:border-zinc-800">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-[10px] font-medium text-gray-500">
                            Task
                          </label>
                          <input
                            type="text"
                            autoFocus
                            placeholder="Subtask title"
                            value={subtaskForm.title}
                            onChange={(event) =>
                              setSubtaskForm((previous) => ({
                                ...previous,
                                title: event.target.value,
                              }))
                            }
                            className="w-full rounded-md border border-gray-200 bg-transparent px-2.5 py-2 text-xs outline-none placeholder:text-gray-400 focus:border-purple-400 dark:border-zinc-800"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-gray-500">
                            Priority
                          </label>
                          <select
                            value={subtaskForm.priority}
                            onChange={(event) =>
                              setSubtaskForm((previous) => ({
                                ...previous,
                                priority: event.target.value as PriorityType,
                              }))
                            }
                            className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-purple-400 dark:border-zinc-800 dark:bg-zinc-950"
                          >
                            {taskPriorityOptions.map((priority) => (
                              <option key={priority} value={priority}>
                                {priority}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-gray-500">
                            Members
                          </label>
                          <select
                            value={subtaskForm.assignee}
                            onChange={(event) =>
                              setSubtaskForm((previous) => ({
                                ...previous,
                                assignee: event.target.value,
                              }))
                            }
                            className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-purple-400 dark:border-zinc-800 dark:bg-zinc-950"
                          >
                            <option value="">Unassigned</option>
                            {teamMembers.map((member) => (
                              <option
                                key={String(member.id || member.email)}
                                value={member.id || member.name || member.email}
                              >
                                {member.name || member.email}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-gray-500">
                            Due Date
                          </label>
                          <input
                            type="date"
                            value={subtaskForm.dueDate}
                            onChange={(event) =>
                              setSubtaskForm((previous) => ({
                                ...previous,
                                dueDate: event.target.value,
                              }))
                            }
                         className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-900 outline-none focus:border-purple-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:[color-scheme:dark]"                            />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={resetSubtaskForm}
                          className="rounded-md px-2.5 py-1.5 text-[11px] text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-900"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isSubtaskSaving || !subtaskForm.title.trim()}
                          onClick={() => void handleSaveSubtask()}
                          className="rounded-md bg-purple-600 px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-purple-700 disabled:opacity-40"
                        >
                          {isSubtaskSaving
                            ? "Saving..."
                            : editingSubtaskId
                              ? "Save Changes"
                              : "Add Subtask"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={openAddSubtask}
                      className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2.5 text-xs font-medium text-gray-500 transition hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Subtasks
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ACTIVITY */}
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-semibold text-slate-800 dark:text-gray-100">
                Activity
              </h3>

              <div className="rounded-xl border border-gray-200 bg-white text-xs dark:border-zinc-800 dark:bg-zinc-950">

                {selectedCommentId ? (
                  <div>
                    {(() => {
                      const selectedUpdate =
                        updatesList.find(
                          (item) =>
                            item.commentId ===
                              selectedCommentId &&
                            item.isComment,
                        );

                      return (
                        <>
                          <div className="flex items-center justify-between px-4 py-3">
                            <div className="flex min-w-0 items-center gap-2">
                              {selectedUpdate?.avatar ? (
                                <img
                                  src={
                                    selectedUpdate.avatar
                                  }
                                  alt={
                                    selectedUpdate.user
                                  }
                                  className="h-6 w-6 shrink-0 rounded-full object-cover"
                                />
                              ) : (
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white">
                                  {selectedUpdate?.user
                                    ?.charAt(
                                      0,
                                    )
                                    .toUpperCase() ||
                                    "U"}
                                </span>
                              )}

                              <div className="min-w-0">
                                <div className="truncate font-semibold text-slate-800 dark:text-gray-100">
                                  {selectedUpdate?.user ||
                                    "Team Member"}
                                </div>

                                <div className="text-[10px] text-gray-400">
                                  {selectedUpdate?.time ||
                                    "Just now"}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 text-gray-400">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedComment(
                                    null,
                                  );

                                  setSelectedCommentId(
                                    null,
                                  );

                                  setSelectedCommentText(
                                    "",
                                  );

                                  setReplyText(
                                    "",
                                  );

                                  setReplyEmojiPickerOpen(
                                    false,
                                  );

                                  setCommentEmojiPickerOpen(
                                    false,
                                  );
                                }}
                                className="mr-1 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                              >
                                Cancel
                              </button>

                              {/* REPLY EMOJI */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyEmojiPickerOpen(
                                      (previous) =>
                                        !previous,
                                    );

                                    setCommentEmojiPickerOpen(
                                      false,
                                    );
                                  }}
                                  className={`rounded-md p-1 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-900 ${
                                    replyEmojiPickerOpen
                                      ? "bg-purple-50 text-purple-600 dark:bg-purple-950/40"
                                      : ""
                                  }`}
                                >
                                  <Smile className="h-3.5 w-3.5" />
                                </button>

                                {replyEmojiPickerOpen && (
                                  <div className="absolute right-0 top-8 z-50 grid w-40 grid-cols-8 gap-1 rounded-xl border border-gray-200 bg-white p-2 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
                                    {emojis.map(
                                      (
                                        emoji,
                                      ) => (
                                        <button
                                          key={
                                            emoji
                                          }
                                          type="button"
                                          onClick={() =>
                                            handleReplyEmojiSelect(
                                              emoji,
                                            )
                                          }
                                          className="flex h-7 w-7 items-center justify-center rounded-md text-base hover:bg-gray-100 dark:hover:bg-zinc-800"
                                        >
                                          {
                                            emoji
                                          }
                                        </button>
                                      ),
                                    )}
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                className="rounded-md p-1 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-900"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="border-t border-gray-100 px-4 py-3 dark:border-zinc-800">
                            <p className="text-[11px] leading-5 text-gray-700 dark:text-gray-300">
                              {
                                selectedCommentText
                              }
                            </p>
                          </div>

                          {(() => {
                            const threadReplies =
                              updatesList
                                .filter(
                                  (
                                    item,
                                  ) =>
                                    item.commentId ===
                                      selectedCommentId &&
                                    item.type ===
                                      "reply",
                                )
                                .slice()
                                .reverse();

                            if (
                              threadReplies.length ===
                              0
                            ) {
                              return null;
                            }

                            return (
                              <div className="max-h-[220px] space-y-3 overflow-y-auto border-t border-gray-100 px-4 py-3 dark:border-zinc-800">
                                {threadReplies.map(
                                  (
                                    reply,
                                    replyIdx,
                                  ) => (
                                    <div
                                      key={`${reply.id || reply.time}-${replyIdx}`}
                                      className="flex items-start gap-2"
                                    >
                                      {reply.avatar ? (
                                        <img
                                          src={
                                            reply.avatar
                                          }
                                          alt={
                                            reply.user
                                          }
                                          className="h-5 w-5 shrink-0 rounded-full object-cover"
                                        />
                                      ) : (
                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-100 text-[8px] font-bold text-purple-600 dark:bg-purple-950/50 dark:text-purple-300">
                                          {reply.user
                                            .charAt(
                                              0,
                                            )
                                            .toUpperCase()}
                                        </span>
                                      )}

                                      <div className="min-w-0">
                                        <p className="text-[11px] leading-5">
                                          <span className="font-medium">
                                            {reply.user ===
                                            activeUsername
                                              ? "You"
                                              : reply.user}
                                          </span>{" "}

                                          <span className="text-gray-500">
                                            {reply.text.replace(
                                              /^replied:\s*/i,
                                              "",
                                            )}
                                          </span>
                                        </p>

                                        <span className="text-[10px] text-gray-400">
                                          {
                                            reply.time
                                          }
                                        </span>
                                      </div>
                                    </div>
                                  ),
                                )}
                              </div>
                            );
                          })()}

                          <div className="border-t border-gray-100 px-4 py-2.5 dark:border-zinc-800">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-100 text-[9px] font-bold text-purple-600 dark:bg-purple-950/50 dark:text-purple-300">
                                {activeUsername
                                  .charAt(
                                    0,
                                  )
                                  .toUpperCase()}
                              </span>

                              <input
                                type="text"
                                placeholder="Leave a reply..."
                                value={
                                  replyText
                                }
                                disabled={
                                  !selectedCommentId
                                }
                                onChange={(
                                  event,
                                ) =>
                                  setReplyText(
                                    event
                                      .target
                                      .value,
                                  )
                                }
                                onKeyDown={(
                                  event,
                                ) => {
                                  if (
                                    event.key ===
                                      "Enter" &&
                                    selectedCommentId
                                  ) {
                                    void handleReplySubmit();
                                  }
                                }}
                                className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-gray-400 disabled:cursor-not-allowed"
                              />

                              <button
                                type="button"
                                disabled={
                                  !selectedCommentId ||
                                  !replyText.trim()
                                }
                                onClick={() =>
                                  void handleReplySubmit()
                                }
                                className="rounded-md p-1 text-gray-400 transition hover:text-purple-600 disabled:opacity-40"
                              >
                                <Send className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="px-4 py-5 text-[11px] text-gray-400">
                    Select a comment from the Updates section to reply.
                  </div>
                )}
              </div>

              {/* NEW COMMENT */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <textarea
                  rows={2}
                  placeholder="Add a comment..."
                  value={
                    commentText
                  }
                  onChange={(
                    event,
                  ) =>
                    setCommentText(
                      event.target
                        .value,
                    )
                  }
                  className="w-full resize-none bg-transparent text-xs leading-5 outline-none placeholder:text-gray-400"
                />

                <div className="mt-2 flex items-center justify-end gap-2">

                  {/* COMMENT EMOJI */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setCommentEmojiPickerOpen(
                          (previous) =>
                            !previous,
                        );

                        setReplyEmojiPickerOpen(
                          false,
                        );
                      }}
                      className={`rounded-md p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ${
                        commentEmojiPickerOpen
                          ? "bg-purple-50 text-purple-600 dark:bg-purple-950/40"
                          : ""
                      }`}
                    >
                      <Smile className="h-3.5 w-3.5" />
                    </button>

                    {commentEmojiPickerOpen && (
                      <div className="absolute bottom-8 right-0 z-50 grid w-40 grid-cols-8 gap-1 rounded-xl border border-gray-200 bg-white p-2 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
                        {emojis.map(
                          (
                            emoji,
                          ) => (
                            <button
                              key={
                                emoji
                              }
                              type="button"
                              onClick={() =>
                                handleCommentEmojiSelect(
                                  emoji,
                                )
                              }
                              className="flex h-7 w-7 items-center justify-center rounded-md text-base hover:bg-gray-100 dark:hover:bg-zinc-800"
                            >
                              {
                                emoji
                              }
                            </button>
                          ),
                        )}
                      </div>
                    )}
                  </div>

                  <input
                    ref={
                      commentFileInputRef
                    }
                    type="file"
                    className="hidden"
                    onChange={
                      handleCommentFileChange
                    }
                  />

                  <button
                    type="button"
                    onClick={() =>
                      commentFileInputRef.current?.click()
                    }
                    className="rounded-md p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    disabled={
                      !commentText.trim()
                    }
                    onClick={() =>
                      void handleCommentSubmit()
                    }
                    className="rounded-md p-1 text-gray-400 transition hover:text-purple-600 disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* =================================================
              RIGHT SIDEBAR
          ================================================= */}

          <div className="relative w-full max-h-[42vh] shrink-0 overflow-y-auto border-t border-gray-100 bg-gray-50/40 p-4 text-xs dark:border-zinc-800 dark:bg-zinc-950/60 lg:w-[316px] lg:max-h-none lg:border-l lg:border-t-0 dark:border-zinc-800 dark:bg-zinc-950/60">

            {/* DETAILS */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">

              <div className="mb-5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    setIsDetailsOpen((previous) => !previous)
                  }
                  aria-expanded={isDetailsOpen}
                  className="flex items-center gap-1 font-semibold"
                >
                  {isDetailsOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  Details
                </button>

                <div className="flex items-center gap-1.5 text-gray-400">
                  <Plus className="h-3.5 w-3.5" />
                  <Settings className="h-3.5 w-3.5" />
                </div>
              </div>

              {isDetailsOpen && (
                <div className="space-y-4">

                {/* STATUS DISPLAY ONLY */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">
                    Status
                  </span>

                  <div
                    className={`flex items-center gap-1.5 font-medium ${
                      getStatusColor(
                        currentStatus,
                      ).text
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        getStatusColor(
                          currentStatus,
                        ).dot
                      }`}
                    />

                    {currentStatus}
                  </div>
                </div>

                {/* PRIORITY */}
                <div
                  className="relative flex items-center justify-between"
                  data-priority-menu
                >
                  <span className="text-gray-400">
                    Priority
                  </span>

                  <button
                    type="button"
                    disabled={
                      isLocked
                    }
                    onClick={() => {
                      setIsMemberOpen(
                        false,
                      );

                      setIsPriorityOpen(
                        (previous) =>
                          !previous,
                      );
                    }}
                    className={`flex items-center gap-1 ${
                      isLocked
                        ? "cursor-not-allowed opacity-50"
                        : ""
                    }`}
                  >
                    {renderPriorityBadge(
                      currentPriority,
                    )}

                    <ChevronDown
                      className={`h-3 w-3 text-gray-400 transition-transform ${
                        isPriorityOpen
                          ? "rotate-180"
                          : ""
                      }`}
                    />
                  </button>

                  {isPriorityOpen &&
                    !isLocked && (
                      <div className="absolute right-0 top-7 z-30 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white py-1.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
                        <div className="px-3 pb-1.5 pt-0.5 text-[10px] font-medium text-gray-400">
                          Priority
                        </div>

                        {taskPriorityOptions.map(
                          (
                            priority,
                          ) => {
                            const isSelected =
                              priority ===
                              currentPriority;

                            const PriorityIcon =
                              priority ===
                                "Urgent" ||
                              priority ===
                                "High"
                                ? SignalHigh
                                : priority ===
                                    "Medium"
                                  ? SignalMedium
                                  : SignalLow;

                            const priorityColor =
                              priority ===
                              "Urgent"
                                ? "text-red-500"
                                : priority ===
                                    "High"
                                  ? "text-orange-500"
                                  : priority ===
                                      "Medium"
                                    ? "text-amber-500"
                                    : "text-gray-400";

                            return (
                              <button
                                key={
                                  priority
                                }
                                type="button"
                                onClick={() => {
                                  setIsPriorityOpen(
                                    false,
                                  );

                                  void handlePropertyChange(
                                    "priority",
                                    priority,
                                    `changed priority from ${
                                      currentPriority
                                    } to ${priority}`,
                                    "priority",
                                  );
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-gray-50 dark:hover:bg-zinc-800"
                              >
                                <PriorityIcon
                                  className={`h-3.5 w-3.5 shrink-0 ${priorityColor}`}
                                />

                                <span
                                  className={`flex-1 font-medium ${priorityColor}`}
                                >
                                  {
                                    priority
                                  }
                                </span>

                                {isSelected && (
                                  <Check className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                                )}
                              </button>
                            );
                          },
                        )}
                      </div>
                    )}
                </div>

                {/* MEMBERS */}
                <div
                  className="relative flex items-center justify-between"
                  data-member-menu
                >
                  <span className="text-gray-400">
                    Members
                  </span>

                  <button
                    type="button"
                    disabled={
                      isLocked
                    }
                    onClick={() => {
                      setIsPriorityOpen(
                        false,
                      );

                      setIsMemberOpen(
                        (previous) =>
                          !previous,
                      );
                    }}
                    className={`flex max-w-[175px] items-center gap-1.5 font-medium ${
                      isLocked
                        ? "cursor-not-allowed opacity-50"
                        : "hover:text-purple-600"
                    }`}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-600 text-[9px] font-bold text-white">
                      {currentAssignee
                        ? currentAssignee
                            .charAt(
                              0,
                            )
                            .toUpperCase()
                        : "U"}
                    </span>

                    <span className="max-w-[115px] truncate">
                      {currentAssignee ||
                        "Add members"}
                    </span>

                    <ChevronDown
                      className={`h-3 w-3 shrink-0 text-gray-400 transition-transform ${
                        isMemberOpen
                          ? "rotate-180"
                          : ""
                      }`}
                    />
                  </button>

                  {isMemberOpen &&
                    !isLocked && (
                      <div className="absolute right-0 top-7 z-40 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">

                        <div className="px-3 py-2 text-[10px] font-medium text-gray-400">
                          Assign member
                        </div>

                        {/* UNASSIGNED */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsMemberOpen(
                              false,
                            );

                            if (
                              currentAssignee
                            ) {
                              void handlePropertyChange(
                                "assignee",
                                "",
                                `changed assignee from ${currentAssignee} to Unassigned`,
                                "member",
                              );
                            }
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 dark:hover:bg-zinc-800"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[9px] font-bold text-gray-500 dark:bg-zinc-800 dark:text-gray-300">
                            -
                          </span>

                          <span className="flex-1">
                            Unassigned
                          </span>

                          {!currentAssignee && (
                            <Check className="h-3.5 w-3.5 text-gray-500" />
                          )}
                        </button>

                        {teamMembers.length ===
                        0 ? (
                          <div className="px-3 py-3 text-[11px] text-gray-400">
                            No team members found.
                          </div>
                        ) : (
                          teamMembers.map(
                            (
                              member,
                            ) => {
                              const memberName =
                                member.name?.trim() ||
                                member.email;

                              const isSelected =
                                memberName ===
                                currentAssignee;

                              return (
                                <button
                                  key={
                                    member.id ||
                                    member.email
                                  }
                                  type="button"
                                  onClick={() => {
                                    setIsMemberOpen(
                                      false,
                                    );

                                    if (
                                      memberName ===
                                      currentAssignee
                                    ) {
                                      return;
                                    }

                                    void handlePropertyChange(
                                      "assignee",
                                      memberName,
                                      `changed assignee from ${
                                        currentAssignee ||
                                        "Unassigned"
                                      } to ${memberName}`,
                                      "member",
                                    );
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-600 text-[9px] font-bold text-white">
                                    {memberName
                                      .charAt(
                                        0,
                                      )
                                      .toUpperCase()}
                                  </span>

                                  <span className="min-w-0 flex-1 truncate">
                                    {
                                      memberName
                                    }
                                  </span>

                                  {isSelected && (
                                    <Check className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                                  )}
                                </button>
                              );
                            },
                          )
                        )}
                      </div>
                    )}
                </div>

                {/* DATES */}
                <div className="relative flex items-center justify-between">
  <span className="text-gray-400">
    Dates
  </span>

  <div className="flex items-center gap-1">
    {/* START DATE */}
    <button
      type="button"
      disabled={isLocked}
      onClick={() => openPickerFor("start")}
      className={`flex items-center gap-1 rounded-md border px-2 py-0.5 ${
        isLocked
          ? "cursor-not-allowed opacity-50"
          : "hover:border-gray-400"
      }`}
    >
      <CalendarIcon className="h-3 w-3" />
      {startDate ? formatDateForUi(startDate) : "start"}
    </button>

    <span>→</span>

    {/* END / DUE DATE */}
    <button
      type="button"
      disabled={isLocked}
      onClick={() => openPickerFor("end")}
      className={`flex items-center gap-1 rounded-md border px-2 py-0.5 ${
        isLocked
          ? "cursor-not-allowed opacity-50"
          : "hover:border-gray-400"
      }`}
    >
      <CalendarIcon className="h-3 w-3" />
      {endDate ? formatDateForUi(endDate) : "End"}
    </button>
  </div>

  {isDatePickerOpen && !isLocked && (
    <div
      ref={datePickerRef}
      className="absolute right-0 top-7 z-50 w-56 rounded-xl border bg-white p-3 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrevMonth}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        <span className="text-xs font-semibold">
          {monthName} {currentYear}
        </span>

        <button
          type="button"
          onClick={handleNextMonth}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[10px] text-gray-400">
        <span>Su</span>
        <span>Mo</span>
        <span>Tu</span>
        <span>We</span>
        <span>Th</span>
        <span>Fr</span>
        <span>Sa</span>
      </div>

      <div className="mt-1 grid grid-cols-7 gap-y-1 text-center text-xs">
        {Array.from(
          { length: firstDayIndex },
          (_, index) => (
            <span key={`empty-${index}`} />
          ),
        )}

        {Array.from(
          { length: daysInMonthCount },
          (_, index) => index + 1,
        ).map((day) => (
          <button
            key={day}
            type="button"
            onClick={() =>
              handleSelectDate(day)
            }
            className="mx-auto flex h-6 w-6 items-center justify-center rounded-full hover:bg-purple-600 hover:text-white"
          >
            {day}
          </button>
        ))}
      </div>
    </div>
  )}
</div>
                {/* LABELS */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">
                    Labels
                  </span>

                  <span>
                    {task.tags?.[0] ||
                      "-"}
                  </span>
                </div>

                {/* TEAMS */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">
                    Teams
                  </span>

                  <span>
                    {currentTeams}
                  </span>
                </div>

                {/* REPORTER */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">
                    Reporter
                  </span>

                  <span>
                    {currentReporter}
                  </span>
                </div>
                </div>
              )}
            </div>

            {/* UPDATES */}
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <button
                type="button"
                onClick={() =>
                  setIsUpdatesOpen((previous) => !previous)
                }
                aria-expanded={isUpdatesOpen}
                className="mb-4 flex items-center gap-1.5 font-semibold text-slate-800 dark:text-gray-100"
              >
                {isUpdatesOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                Updates
              </button>

              {isUpdatesOpen && (
                <div className="max-h-[320px] space-y-2.5 overflow-y-auto pr-1 scrollbar-thin">
                {updatesList.map(
                  (
                    log,
                    index,
                  ) => {
                    const isYou =
                      log.user ===
                        activeUsername ||
                      log.user ===
                        "You";

                    const isSelected =
                      log.commentId ===
                      selectedCommentId;

                    return (
                      <div
                        key={`${log.id || log.time}-${index}`}
                        onClick={() => {
                          if (
                            !log.isComment ||
                            !log.commentId
                          ) {
                            return;
                          }

                          const commentTextValue =
                            log.text.replace(
                              /^commented:\s*/i,
                              "",
                            );

                          setSelectedCommentId(
                            log.commentId,
                          );

                          setSelectedCommentText(
                            commentTextValue,
                          );

                          setSelectedComment(
                            {
                              id: log.commentId,
                              user: log.user,
                              text: commentTextValue,
                              avatar:
                                log.avatar ??
                                null,
                            },
                          );

                          setReplyText(
                            "",
                          );

                          setReplyEmojiPickerOpen(
                            false,
                          );

                          setCommentEmojiPickerOpen(
                            false,
                          );
                        }}
                        className={`flex items-start gap-2 rounded-lg px-2.5 py-2 transition ${
                          log.isComment
                            ? "cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-950/20"
                            : ""
                        } ${
                          isSelected
                            ? "bg-purple-50 ring-1 ring-purple-400 dark:bg-purple-950/20"
                            : ""
                        }`}
                      >
                        {log.avatar ? (
                          <img
                            src={
                              log.avatar
                            }
                            alt={
                              log.user
                            }
                            className="h-5 w-5 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-100 text-[8px] font-bold text-purple-600 dark:bg-purple-950/50 dark:text-purple-300">
                            {log.user
                              .charAt(
                                0,
                              )
                              .toUpperCase()}
                          </span>
                        )}

                        <p className="text-[11px]">
                          <span className="font-medium">
                            {isYou
                              ? "You"
                              : log.user}
                          </span>{" "}

                          <span className="text-gray-500">
                            {
                              log.text
                            }
                          </span>
                        </p>
                      </div>
                    );
                  },
                )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}