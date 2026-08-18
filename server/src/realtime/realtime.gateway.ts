import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";

import { Server, Socket } from "socket.io";

import { PrismaService } from "../prisma/prisma.service";

/* =========================================================
   TYPES
========================================================= */

interface TeamJoinPayload {
  teamId: string;
  userId: string;
  userName?: string;
}

interface TaskViewerPayload {
  taskId: string;
  teamId: string;
  userId: string;
  userName?: string;
}

interface ViewerInfo {
  userId: string;
  userName: string;
  connections: number;
}

/* =========================================================
   EDITING LOCK
========================================================= */

export interface TaskLockInfo {
  taskId: string;
  userId: string;
  userName: string;
  socketId: string;
}

/* =========================================================
   REALTIME GATEWAY
========================================================= */

@WebSocketGateway({
  namespace: "/",
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  @WebSocketServer()
  server!: Server;

  /* =========================================================
     SOCKET -> TEAM
  ========================================================= */

  private socketTeams = new Map<string, string>();

  /* =========================================================
     SOCKET -> USER
  ========================================================= */

  private socketUsers = new Map<
    string,
    {
      userId: string;
      userName: string;
    }
  >();

  /* =========================================================
     SOCKET -> TASKS

     One socket can view multiple tasks.
  ========================================================= */

  private socketTasks = new Map<
    string,
    Set<string>
  >();

  /* =========================================================
     TASK -> USERS VIEWING

     taskId
       -> userId
          -> ViewerInfo
  ========================================================= */

  private taskViewers = new Map<
    string,
    Map<string, ViewerInfo>
  >();

  /* =========================================================
     TASK -> EDITING LOCK

     MEMORY CACHE

     Database is the permanent source of truth.

     taskId
       -> TaskLockInfo
  ========================================================= */

  private taskLocks = new Map<
    string,
    TaskLockInfo
  >();

  /* =========================================================
     CONNECTION
  ========================================================= */

  handleConnection(socket: Socket) {
    console.log(
      "========================================",
    );

    console.log(
      `Realtime socket connected: ${socket.id}`,
    );

    console.log(
      "========================================",
    );
  }

  /* =========================================================
     DISCONNECT
     
     IMPORTANT:
     
     We DO NOT release task locks here.
     
     Locks are persistent and must remain until the
     owner explicitly unlocks the task.
  ========================================================= */

  async handleDisconnect(socket: Socket) {
    console.log(
      `Realtime socket disconnected: ${socket.id}`,
    );

    const user =
      this.socketUsers.get(socket.id);

    /*
     * IMPORTANT:
     *
     * Do NOT release task locks.
     *
     * The database lock must survive:
     *
     * - modal close
     * - browser refresh
     * - socket reconnect
     * - temporary network disconnect
     */

    /*
     * Remove viewer presence.
     */

    if (user) {
      this.removeSocketFromTasks(
        socket.id,
        user,
      );
    }

    this.socketTasks.delete(
      socket.id,
    );

    this.socketTeams.delete(
      socket.id,
    );

    this.socketUsers.delete(
      socket.id,
    );
  }

  /* =========================================================
     TEAM JOIN
  ========================================================= */

  @SubscribeMessage("team.join")
  handleTeamJoin(
    @ConnectedSocket()
    socket: Socket,

    @MessageBody()
    payload: TeamJoinPayload,
  ) {
    if (
      !payload?.teamId ||
      !payload?.userId
    ) {
      console.warn(
        "Invalid team.join payload:",
        payload,
      );

      return;
    }

    const teamId =
      String(payload.teamId);

    const userId =
      String(payload.userId);

    const userName =
      payload.userName?.trim() ||
      "Team Member";

    /* -------------------------------------------------------
       Check previous team
    ------------------------------------------------------- */

    const previousTeam =
      this.socketTeams.get(socket.id);

    if (
      previousTeam &&
      previousTeam !== teamId
    ) {
      const user =
        this.socketUsers.get(socket.id);

      if (user) {
        this.removeSocketFromTasks(
          socket.id,
          user,
        );
      }

      /*
       * IMPORTANT:
       *
       * Do NOT release locks here.
       *
       * Persistent locks survive team/socket
       * movement.
       */

      socket.leave(
        `team:${previousTeam}`,
      );
    }

    /* -------------------------------------------------------
       Join team
    ------------------------------------------------------- */

    socket.join(
      `team:${teamId}`,
    );

    this.socketTeams.set(
      socket.id,
      teamId,
    );

    this.socketUsers.set(
      socket.id,
      {
        userId,
        userName,
      },
    );

    console.log(
      `User ${userId} joined team ${teamId}`,
    );

    console.log(
      `Socket ${socket.id} is now in team:${teamId}`,
    );
  }

  /* =========================================================
     TEAM LEAVE
     
     IMPORTANT:
     
     Leaving team does NOT release a persistent task lock.
  ========================================================= */

  @SubscribeMessage("team.leave")
  handleTeamLeave(
    @ConnectedSocket()
    socket: Socket,

    @MessageBody()
    payload: {
      teamId?: string;
    },
  ) {
    const teamId =
      payload?.teamId ||
      this.socketTeams.get(socket.id);

    if (!teamId) {
      return;
    }

    const user =
      this.socketUsers.get(socket.id);

    /*
     * Remove task presence.
     */

    if (user) {
      this.removeSocketFromTasks(
        socket.id,
        user,
      );
    }

    /*
     * IMPORTANT:
     *
     * Do NOT release persistent locks.
     */

    socket.leave(
      `team:${teamId}`,
    );

    this.socketTeams.delete(
      socket.id,
    );

    console.log(
      `Socket ${socket.id} left team ${teamId}`,
    );
  }

  /* =========================================================
     TASK CREATED
  ========================================================= */

  emitTaskCreated(
    teamId: string,
    task: unknown,
    userId: string,
  ) {
    if (
      !this.server ||
      !teamId ||
      !task
    ) {
      return;
    }

    this.server
      .to(`team:${teamId}`)
      .emit(
        "task.created",
        {
          task,
          userId,
        },
      );
  }

  /* =========================================================
     TASK UPDATED
  ========================================================= */

  emitTaskUpdated(
    teamId: string,
    task: unknown,
    userId: string,
  ) {
    if (
      !this.server ||
      !teamId ||
      !task
    ) {
      return;
    }

    this.server
      .to(`team:${teamId}`)
      .emit(
        "task.updated",
        {
          task,
          userId,
        },
      );
  }
  
  // =========================================================
// TASK ACTIVITY CREATED
// =========================================================

emitTaskActivity(
  teamId: string,
  activity: {
    id: string;
    taskId: string;
    userId: string;
    action: string;
    createdAt: Date;
    commentId?: string | null;
    user?: {
      id: string;
      name: string | null;
      avatar: string | null;
    } | null;
  },
) {
  if (
    !this.server ||
    !teamId ||
    !activity
  ) {
    return;
  }

  const activityData = {
    id: activity.id,
    taskId: activity.taskId,
    userId: activity.userId,
    userName:
      activity.user?.name ||
      "Team Member",
    avatar:
      activity.user?.avatar ||
      null,
    action: activity.action,
    createdAt: activity.createdAt,
    commentId:
      activity.commentId ?? null,
  };

  // -------------------------------------------------------
  // USERS CURRENTLY VIEWING THIS TASK
  // -------------------------------------------------------

  this.server
    .to(`task:${activity.taskId}`)
    .emit(
      "task.activity.created",
      activityData,
    );

  // -------------------------------------------------------
  // OTHER TEAM MEMBERS
  //
  // .except(task:...) prevents users already viewing the
  // task from receiving the same event a second time.
  // -------------------------------------------------------

  this.server
    .to(`team:${teamId}`)
    .except(`task:${activity.taskId}`)
    .emit(
      "task.activity.created",
      activityData,
    );
}
  /* =========================================================
     TASK DELETED
  ========================================================= */

  emitTaskDeleted(
    teamId: string,
    taskId: string,
    userId: string,
  ) {
    if (
      !this.server ||
      !teamId ||
      !taskId
    ) {
      return;
    }

    this.server
      .to(`team:${teamId}`)
      .emit(
        "task.deleted",
        {
          taskId,
          userId,
        },
      );
  }

  /* =========================================================
     TASK VIEWER JOIN
  ========================================================= */

  @SubscribeMessage(
    "task.viewers.join",
  )
  handleTaskViewerJoin(
    @ConnectedSocket()
    socket: Socket,

    @MessageBody()
    payload: TaskViewerPayload,
  ) {
    console.log(
      "----------------------------------------",
    );

    console.log(
      "TASK VIEWER JOIN RECEIVED:",
      payload,
    );

    console.log(
      "Socket:",
      socket.id,
    );

    console.log(
      "----------------------------------------",
    );

    if (
      !payload?.taskId ||
      !payload?.teamId ||
      !payload?.userId
    ) {
      console.warn(
        "Invalid task.viewers.join payload:",
        payload,
      );

      return;
    }

    const taskId =
      String(payload.taskId);

    const teamId =
      String(payload.teamId);

    const userId =
      String(payload.userId);

    const userName =
      payload.userName?.trim() ||
      "Team Member";

    /* -------------------------------------------------------
       Verify team
    ------------------------------------------------------- */

    const socketTeam =
      this.socketTeams.get(socket.id);

    if (
      socketTeam &&
      socketTeam !== teamId
    ) {
      console.warn(
        `Socket ${socket.id} attempted task presence in another team`,
      );

      return;
    }

    /*
     * Automatically join team if necessary.
     */

    if (!socketTeam) {
      socket.join(
        `team:${teamId}`,
      );

      this.socketTeams.set(
        socket.id,
        teamId,
      );
    }

    /* -------------------------------------------------------
       Store user
    ------------------------------------------------------- */

    this.socketUsers.set(
      socket.id,
      {
        userId,
        userName,
      },
    );

    /* -------------------------------------------------------
       Create socket task set
    ------------------------------------------------------- */

    if (
      !this.socketTasks.has(
        socket.id,
      )
    ) {
      this.socketTasks.set(
        socket.id,
        new Set<string>(),
      );
    }

    const socketTaskSet =
      this.socketTasks.get(
        socket.id,
      )!;

    /* -------------------------------------------------------
       Prevent duplicate join
    ------------------------------------------------------- */

    if (
      socketTaskSet.has(taskId)
    ) {
      socket.join(
        `task:${taskId}`,
      );

      this.broadcastTaskViewers(
        taskId,
        teamId,
      );

      /*
       * Also send current persistent lock.
       */

      console.log(

        "[LOCK INITIAL SYNC REQUEST]",

        {

          socketId: socket.id,

          taskId,

          teamId,

          userId,

          reason: "task.viewers.join",

          timestamp: new Date().toISOString(),

        },

      );


      void this.broadcastCurrentTaskLock(

        taskId,

        teamId,

      );

      return;
    }

    /* -------------------------------------------------------
       Create task viewer map
    ------------------------------------------------------- */

    if (
      !this.taskViewers.has(
        taskId,
      )
    ) {
      this.taskViewers.set(
        taskId,
        new Map<string, ViewerInfo>(),
      );
    }

    const viewers =
      this.taskViewers.get(
        taskId,
      )!;

    /* -------------------------------------------------------
       Add / update user
    ------------------------------------------------------- */

    const existing =
      viewers.get(userId);

    if (existing) {
      existing.connections += 1;

      existing.userName =
        userName;
    } else {
      viewers.set(
        userId,
        {
          userId,
          userName,
          connections: 1,
        },
      );
    }

    /* -------------------------------------------------------
       Remember socket -> task
    ------------------------------------------------------- */

    socketTaskSet.add(
      taskId,
    );

    /* -------------------------------------------------------
       Join task room
    ------------------------------------------------------- */

    socket.join(
      `task:${taskId}`,
    );

    console.log(
      "[TASK ROOM JOIN]",
      {
        socketId: socket.id,
        taskId,
        teamId,
        userId,
        rooms: Array.from(socket.rooms),
        timestamp: new Date().toISOString(),
      },
    );

    console.log(
      `User ${userId} started viewing task ${taskId}`,
    );

    console.log(
      `Task ${taskId} viewers:`,
      this.getViewerList(taskId),
    );

    /* -------------------------------------------------------
       Broadcast updated viewer list
    ------------------------------------------------------- */

    this.broadcastTaskViewers(
      taskId,
      teamId,
    );

    /*
     * Send current persistent lock.
     */

    console.log(

      "[LOCK INITIAL SYNC REQUEST]",

      {

        socketId: socket.id,

        taskId,

        teamId,

        userId,

        reason: "task.viewers.join",

        timestamp: new Date().toISOString(),

      },

    );


    void this.broadcastCurrentTaskLock(

      taskId,

      teamId,

    );
  }

  /* =========================================================
     TASK VIEWER LEAVE
  ========================================================= */

  @SubscribeMessage(
    "task.viewers.leave",
  )
  handleTaskViewerLeave(
    @ConnectedSocket()
    socket: Socket,

    @MessageBody()
    payload: {
      taskId?: string;
      teamId?: string;
      userId?: string;
    },
  ) {
    console.log(
      "TASK VIEWER LEAVE RECEIVED:",
      payload,
    );

    if (!payload?.taskId) {
      return;
    }

    const taskId =
      String(payload.taskId);

    const teamId =
      payload.teamId ||
      this.socketTeams.get(
        socket.id,
      );

    const user =
      this.socketUsers.get(
        socket.id,
      );

    if (!user) {
      return;
    }

    this.removeSocketFromTask(
      socket.id,
      taskId,
      user,
      teamId,
    );

    socket.leave(
      `task:${taskId}`,
    );

    /*
     * IMPORTANT:
     *
     * Viewer leaving does NOT release task lock.
     */

    console.log(
      `User ${user.userId} stopped viewing task ${taskId}`,
    );
  }

  /* =========================================================
     EDITING LOCK - ACQUIRE
     
     IMPORTANT:
     
     This is now DATABASE PERSISTENT.
  ========================================================= */

  @SubscribeMessage(
    "task.lock.acquire",
  )
  async handleTaskLockAcquire(
    @ConnectedSocket()
    socket: Socket,

    @MessageBody()
    payload: {
      taskId?: string;
      teamId?: string;
      userId?: string;
      userName?: string;
    },
  ) {
    if (
      !payload?.taskId ||
      !payload?.teamId ||
      !payload?.userId
    ) {
      socket.emit(
        "task.lock.denied",
        {
          taskId:
            payload?.taskId || "",
          reason:
            "Invalid lock request.",
        },
      );

      return;
    }

    const taskId =
      String(payload.taskId);

    const teamId =
      String(payload.teamId);

    const userId =
      String(payload.userId);

    const userName =
      payload.userName?.trim() ||
      "Team Member";

    console.log(
      "[LOCK ACQUIRE REQUEST]",
      {
        socketId: socket.id,
        taskId,
        teamId,
        userId,
        userName,
        timestamp: new Date().toISOString(),
      },
    );

    /* -------------------------------------------------------
       Verify socket team
    ------------------------------------------------------- */

    const socketTeam =
      this.socketTeams.get(socket.id);

    if (
      socketTeam &&
      socketTeam !== teamId
    ) {
      socket.emit(
        "task.lock.denied",
        {
          taskId,
          reason:
            "You are not a member of this team.",
        },
      );

      return;
    }

    /*
     * Make sure the socket is in the correct team.
     */

    if (!socketTeam) {
      socket.join(
        `team:${teamId}`,
      );

      this.socketTeams.set(
        socket.id,
        teamId,
      );
    }

    /*
     * Store user.
     */

    this.socketUsers.set(
      socket.id,
      {
        userId,
        userName,
      },
    );

    /* -------------------------------------------------------
       Verify task exists
    ------------------------------------------------------- */

    const task =
      await this.prisma.task.findUnique({
        where: {
          id: taskId,
        },

        include: {
          user: {
            select: {
              id: true,
              teamId: true,
            },
          },
        },
      });

    if (!task) {
      socket.emit(
        "task.lock.denied",
        {
          taskId,
          reason:
            "Task not found.",
        },
      );

      return;
    }

    /* -------------------------------------------------------
       Verify task belongs to same team
    ------------------------------------------------------- */

    if (
      task.user.teamId !== teamId
    ) {
      socket.emit(
        "task.lock.denied",
        {
          taskId,
          reason:
            "This task does not belong to your team.",
        },
      );

      return;
    }

    /* -------------------------------------------------------
       DATABASE LOCK
       
       Database is source of truth.
    ------------------------------------------------------- */

    const databaseLock =
      await this.prisma.taskEditLock.findUnique({
        where: {
          taskId,
        },

        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

    /* -------------------------------------------------------
       Existing database lock
    ------------------------------------------------------- */

    if (databaseLock) {
      /*
       * Same user already owns the lock.
       *
       * This is important after:
       *
       * - refresh
       * - reconnect
       * - modal reopen
       */

      if (
        databaseLock.userId ===
        userId
      ) {
        const lock: TaskLockInfo = {
          taskId,
          userId,
          userName:
            userName ||
            databaseLock.user?.name ||
            "Team Member",
          socketId: socket.id,
        };

        this.taskLocks.set(
          taskId,
          lock,
        );

        socket.join(
          `task:${taskId}`,
        );

        await this.broadcastTaskLock(
          taskId,
          teamId,
        );

        return;
      }

      /*
       * Another user owns the lock.
       */

      const existingUserName =
        databaseLock.user?.name ||
        "Team Member";

      const lockData = {
        taskId,
        userId:
          databaseLock.userId,
        userName:
          existingUserName,
      };

      /*
       * Refresh memory cache.
       */

      this.taskLocks.set(
        taskId,
        {
          taskId,
          userId:
            databaseLock.userId,
          userName:
            existingUserName,
          socketId: "",
        },
      );

      socket.emit(
        "task.lock.denied",
        {
          taskId,

          reason:
            "This task is currently locked by another user.",

          lock: lockData,
        },
      );

      /*
       * Make sure team members have
       * the current lock state.
       */

      await this.broadcastTaskLock(
        taskId,
        teamId,
      );

      return;
    }

    /* -------------------------------------------------------
       CREATE PERMANENT DATABASE LOCK
       
       Your Prisma schema currently requires expiresAt.
       
       We use a very distant date because this lock is
       intended to remain until explicitly released.
    ------------------------------------------------------- */



  const createdLock = await this.prisma.taskEditLock.create({
  data: {
    taskId,
    userId,
  },
  include: {
    user: {
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      },
    },
  },
});

    /* -------------------------------------------------------
       Store memory cache
    ------------------------------------------------------- */

    const lock: TaskLockInfo = {
      taskId,

      userId,

      userName:
        userName ||
        createdLock.user?.name ||
        "Team Member",

      socketId:
        socket.id,
    };

    this.taskLocks.set(
      taskId,
      lock,
    );

    /* -------------------------------------------------------
       Join task room
    ------------------------------------------------------- */

    socket.join(
      `task:${taskId}`,
    );

    console.log(
      `User ${userId} acquired persistent edit lock for task ${taskId}`,
    );

    /* -------------------------------------------------------
       CREATE ACTIVITY LOG
    ------------------------------------------------------- */

    await this.createActivityLog(
      taskId,
      userId,
      "locked the task",
    );

    /* -------------------------------------------------------
       BROADCAST LOCK
    ------------------------------------------------------- */

    await this.broadcastTaskLock(
      taskId,
      teamId,
    );

    /* -------------------------------------------------------
       BROADCAST ACTIVITY
    ------------------------------------------------------- */

    await this.broadcastTaskActivity(
      taskId,
      teamId,
      userId,
      "locked the task",
    );
  }

  /* =========================================================
     EDITING LOCK - RELEASE
     
     ONLY EXPLICIT RELEASE REMOVES THE DATABASE LOCK.
  ========================================================= */

  @SubscribeMessage(
    "task.lock.release",
  )
  async handleTaskLockRelease(
    @ConnectedSocket()
    socket: Socket,

    @MessageBody()
    payload: {
      taskId?: string;
      teamId?: string;
      userId?: string;
    },
  ) {
    if (!payload?.taskId) {
      return;
    }

    const taskId =
      String(payload.taskId);

    const teamId =
      payload.teamId ||
      this.socketTeams.get(
        socket.id,
      );

    const userId =
      payload.userId ||
      this.socketUsers.get(
        socket.id,
      )?.userId;

    if (!userId) {
      return;
    }

    console.log(
      "[LOCK RELEASE REQUEST]",
      {
        socketId: socket.id,
        taskId,
        teamId,
        userId,
        timestamp: new Date().toISOString(),
      },
    );

    /* -------------------------------------------------------
       Get database lock
    ------------------------------------------------------- */

    const databaseLock =
      await this.prisma.taskEditLock.findUnique({
        where: {
          taskId,
        },
      });

    if (!databaseLock) {
      this.taskLocks.delete(
        taskId,
      );

      if (teamId) {
        await this.broadcastTaskLock(
          taskId,
          teamId,
        );
      }

      return;
    }

    /* -------------------------------------------------------
       ONLY OWNER CAN RELEASE
    ------------------------------------------------------- */

    if (
      databaseLock.userId !==
      userId
    ) {
      socket.emit(
        "task.lock.release.denied",
        {
          taskId,

          reason:
            "Only the user who locked this task can unlock it.",

          lock: {
            taskId,
            userId:
              databaseLock.userId,
          },
        },
      );

      return;
    }

    /* -------------------------------------------------------
       DELETE DATABASE LOCK
    ------------------------------------------------------- */

    await this.prisma.taskEditLock.delete({
      where: {
        taskId,
      },
    });

    /* -------------------------------------------------------
       Remove memory cache
    ------------------------------------------------------- */

    this.taskLocks.delete(
      taskId,
    );

    console.log(
      `User ${userId} released persistent edit lock for task ${taskId}`,
    );

    /* -------------------------------------------------------
       ACTIVITY LOG
    ------------------------------------------------------- */

    await this.createActivityLog(
      taskId,
      userId,
      "unlocked the task",
    );

    /* -------------------------------------------------------
       BROADCAST LOCK
    ------------------------------------------------------- */

    if (teamId) {
      await this.broadcastTaskLock(
        taskId,
        teamId,
      );

      /* -----------------------------------------------------
         BROADCAST ACTIVITY
      ----------------------------------------------------- */

      await this.broadcastTaskActivity(
        taskId,
        teamId,
        userId,
        "unlocked the task",
      );
    }
  }

  /* =========================================================
     GET TASK LOCK
     
     DATABASE IS SOURCE OF TRUTH.
  ========================================================= */

  async getTaskLock(
    taskId: string,
  ): Promise<TaskLockInfo | null> {
    /*
     * First check memory.
     */

    const memoryLock =
      this.taskLocks.get(
        taskId,
      );

    if (memoryLock) {
      return memoryLock;
    }

    /*
     * Then check database.
     *
     * This allows the lock to survive:
     *
     * - server restart
     * - browser refresh
     * - gateway recreation
     */

    const databaseLock =
      await this.prisma.taskEditLock.findUnique({
        where: {
          taskId,
        },

        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

    if (!databaseLock) {
      return null;
    }

    const lock: TaskLockInfo = {
      taskId:
        databaseLock.taskId,

      userId:
        databaseLock.userId,

      userName:
        databaseLock.user?.name ||
        "Team Member",

      /*
       * Socket may not currently be connected.
       */
      socketId: "",
    };

    this.taskLocks.set(
      taskId,
      lock,
    );

    return lock;
  }

  /* =========================================================
     CHECK IF USER CAN EDIT TASK
     
     DATABASE-AWARE VERSION.
  ========================================================= */

  async canUserEditTask(
    taskId: string,
    userId: string,
  ): Promise<boolean> {
    const lock =
      await this.getTaskLock(
        taskId,
      );

    /*
     * No lock means editing is allowed.
     */

    if (!lock) {
      return true;
    }

    /*
     * Only lock owner can edit.
     */

    return (
      lock.userId === userId
    );
  }

  /* =========================================================
     BROADCAST TASK LOCK
  ========================================================= */

  private async broadcastTaskLock(
    taskId: string,
    teamId: string,
    initialSync = false,
  ) {
    if (
      !this.server ||
      !taskId ||
      !teamId
    ) {
      return;
    }

    /*
     * Always read database.
     */

    const databaseLock =
      await this.prisma.taskEditLock.findUnique({
        where: {
          taskId,
        },

        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

    let lockData:
      | {
          taskId: string;
          userId: string;
          userName: string;
        }
      | null = null;

    if (databaseLock) {
      lockData = {
        taskId:
          databaseLock.taskId,

        userId:
          databaseLock.userId,

        userName:
          databaseLock.user?.name ||
          "Team Member",
      };

      /*
       * Refresh memory cache.
       */

      this.taskLocks.set(
        taskId,
        {
          taskId:
            databaseLock.taskId,

          userId:
            databaseLock.userId,

          userName:
            databaseLock.user?.name ||
            "Team Member",

          socketId:
            this.taskLocks.get(
              taskId,
            )?.socketId || "",
        },
      );
    } else {
      /*
       * No persistent lock.
       */

      this.taskLocks.delete(
        taskId,
      );
    }

    console.log(
      "[LOCK BROADCAST]",
      {
        taskId,
        teamId,
        initialSync,
        locked: !!lockData,
        lockOwnerId: lockData?.userId ?? null,
        lockOwnerName: lockData?.userName ?? null,
        taskRoom: `task:${taskId}`,
        teamRoom: `team:${teamId}`,
        teamRoomExcludesTaskRoom: true,
        timestamp: new Date().toISOString(),
      },
    );

    const eventData = {
      taskId,

      teamId,

      locked:
        !!lockData,

      lock:
        lockData,

      // Explicitly identifies a state synchronization event.
      // The client must not infer this from event order.
      initialSync,

      emittedAt: new Date().toISOString(),
    };

    /* -------------------------------------------------------
       Task room
    ------------------------------------------------------- */

    this.server
      .to(`task:${taskId}`)
      .emit(
        "task.lock.updated",
        eventData,
      );

    /* -------------------------------------------------------
       Team room
    ------------------------------------------------------- */

    this.server
      .to(`team:${teamId}`)
      .except(`task:${taskId}`)
      .emit(
        "task.lock.updated",
        eventData,
      );
  }

  /* =========================================================
     BROADCAST CURRENT TASK LOCK
     
     Used when somebody opens/reopens a task.
  ========================================================= */

  private async broadcastCurrentTaskLock(
    taskId: string,
    teamId: string,
  ) {
    await this.broadcastTaskLock(
      taskId,
      teamId,
      true,
    );
  }

  /* =========================================================
     CREATE ACTIVITY LOG
  ========================================================= */

  private async createActivityLog(
    taskId: string,
    userId: string,
    action: string,
  ) {
    try {
      const activity =
        await this.prisma.activityLog.create({
          data: {
            taskId,

            userId,

            action,
          },

          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        });

      console.log(
        "Activity log created:",
        activity.id,
      );

      return activity;
    } catch (error) {
      console.error(
        "Failed to create activity log:",
        error,
      );

      return null;
    }
  }

  /* =========================================================
     BROADCAST TASK ACTIVITY
     
     Sends the newly created activity to everyone
     viewing the task/team.
  ========================================================= */

  private async broadcastTaskActivity(
    taskId: string,
    teamId: string,
    userId: string,
    action: string,
  ) {
    if (
      !this.server ||
      !taskId ||
      !teamId
    ) {
      return;
    }

    /*
     * Get latest activity.
     */

    const activity =
      await this.prisma.activityLog.findFirst({
        where: {
          taskId,

          userId,

          action,
        },

        orderBy: {
          createdAt: "desc",
        },

        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      });

    if (!activity) {
      return;
    }

    const activityData = {
      id:
        activity.id,

      taskId:
        activity.taskId,

      userId:
        activity.userId,

      userName:
        activity.user?.name ||
        "Team Member",

      avatar:
        activity.user?.avatar ||
        null,

      action:
        activity.action,

      createdAt:
        activity.createdAt,
    };

    /* -------------------------------------------------------
       Task room
    ------------------------------------------------------- */

    this.server
      .to(`task:${taskId}`)
      .emit(
        "task.activity.created",
        activityData,
      );

    /* -------------------------------------------------------
       Team room
    ------------------------------------------------------- */

    this.server
      .to(`team:${teamId}`)
      .except(`task:${taskId}`)
      .emit(
        "task.activity.created",
        activityData,
      );
  }

  /* =========================================================
     REMOVE ONE SOCKET FROM ONE TASK
  ========================================================= */

  private removeSocketFromTask(
    socketId: string,
    taskId: string,
    user: {
      userId: string;
      userName: string;
    },
    teamId?: string,
  ) {
    const socketTaskSet =
      this.socketTasks.get(
        socketId,
      );

    if (
      !socketTaskSet?.has(
        taskId,
      )
    ) {
      return;
    }

    socketTaskSet.delete(
      taskId,
    );

    const viewers =
      this.taskViewers.get(
        taskId,
      );

    if (!viewers) {
      return;
    }

    const viewer =
      viewers.get(
        user.userId,
      );

    if (!viewer) {
      return;
    }

    viewer.connections -= 1;

    if (
      viewer.connections <= 0
    ) {
      viewers.delete(
        user.userId,
      );
    }

    if (
      viewers.size === 0
    ) {
      this.taskViewers.delete(
        taskId,
      );
    }

    const resolvedTeamId =
      teamId ||
      this.socketTeams.get(
        socketId,
      );

    if (resolvedTeamId) {
      this.broadcastTaskViewers(
        taskId,
        resolvedTeamId,
      );
    }

    console.log(
      `Removed socket ${socketId} from task ${taskId}`,
    );
  }

  /* =========================================================
     REMOVE SOCKET FROM ALL TASKS
  ========================================================= */

  private removeSocketFromTasks(
    socketId: string,
    user: {
      userId: string;
      userName: string;
    },
  ) {
    const socketTaskSet =
      this.socketTasks.get(
        socketId,
      );

    if (!socketTaskSet) {
      return;
    }

    const taskIds =
      Array.from(
        socketTaskSet,
      );

    const teamId =
      this.socketTeams.get(
        socketId,
      );

    for (
      const taskId of taskIds
    ) {
      this.removeSocketFromTask(
        socketId,
        taskId,
        user,
        teamId,
      );
    }

    this.socketTasks.delete(
      socketId,
    );
  }

  /* =========================================================
     GET VIEWER LIST
  ========================================================= */

  private getViewerList(
    taskId: string,
  ) {
    const viewers =
      this.taskViewers.get(
        taskId,
      );

    if (!viewers) {
      return [];
    }

    return Array.from(
      viewers.values(),
    ).map(
      ({
        userId,
        userName,
      }) => ({
        userId,
        userName,
      }),
    );
  }

  /* =========================================================
     BROADCAST VIEWERS
  ========================================================= */

  private broadcastTaskViewers(
    taskId: string,
    teamId: string,
  ) {
    if (
      !this.server ||
      !taskId ||
      !teamId
    ) {
      return;
    }

    const viewerList =
      this.getViewerList(
        taskId,
      );

    console.log(
      `Broadcasting viewers for task ${taskId}:`,
      viewerList,
    );

    /* -------------------------------------------------------
       Task room
    ------------------------------------------------------- */

    this.server
      .to(`task:${taskId}`)
      .emit(
        "task.viewers.updated",
        {
          taskId,
          teamId,
          viewers:
            viewerList,
        },
      );

    /* -------------------------------------------------------
       Team room
    ------------------------------------------------------- */

    this.server
      .to(`team:${teamId}`)
      .emit(
        "task.viewers.updated",
        {
          taskId,
          teamId,
          viewers:
            viewerList,
        },
      );
  }
}