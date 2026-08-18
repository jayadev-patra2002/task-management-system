import{
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";

import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { CreateSubtaskDto } from "./dto/create-subtask.dto";
import { UpdateSubtaskDto } from "./dto/update-subtask.dto";
import { CreateResourceDto } from "./dto/create-resource.dto";
import { RealtimeGateway } from "../realtime/realtime.gateway";

import { existsSync, unlinkSync } from "fs";
import { relative, resolve } from "path";

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  // =====================================================
  // GET ALL TASKS FOR USER
  // =====================================================

  async findAllByUser(userId: string, projectId?: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        teamId: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (!user.teamId) {
      return [];
    }

    const tasks = await this.prisma.task.findMany({
      where: {
        user: {
          teamId: user.teamId,
        },

        ...(projectId
          ? {
              projectId,
            }
          : {}),
      },

      include: {
        subtasks: true,

        resources: {
          orderBy: {
            createdAt: "asc",
          },
        },

        project: {
          select: {
            id: true,
            name: true,
          },
        },

        editLock: {
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
        },

        activityLogs: {
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
          orderBy: {
            createdAt: "desc",
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return tasks.map((task) =>
      this.formatTask(task),
    );
  }

  // =====================================================
  // GET SINGLE TASK
  // =====================================================

  async findOne(
    id: string,
    userId: string,
  ) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          teamId: true,
        },
      });

    if (!user) {
      throw new NotFoundException(
        "User not found",
      );
    }

    if (!user.teamId) {
      throw new NotFoundException(
        "User does not belong to a team",
      );
    }

    const task =
      await this.prisma.task.findUnique({
        where: {
          id,
        },

        include: {
          subtasks: true,

          resources: {
            orderBy: {
              createdAt: "asc",
            },
          },

          project: {
            select: {
              id: true,
              name: true,
            },
          },

          editLock: {
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
          },

          activityLogs: {
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
            orderBy: {
              createdAt: "desc",
            },
          },

          comments: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatar: true,
                },
              },

              reactions: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      avatar: true,
                    },
                  },
                },
              },

              replies: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      avatar: true,
                    },
                  },

                  reactions: {
                    include: {
                      user: {
                        select: {
                          id: true,
                          name: true,
                          avatar: true,
                        },
                      },
                    },
                  },
                },

                orderBy: {
                  createdAt: "asc",
                },
              },
            },

            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

    if (!task) {
      throw new NotFoundException(
        "Task not found",
      );
    }

    // ===================================================
    // TEAM ACCESS
    // ===================================================

    if (task.userId !== userId) {
      const taskOwner =
        await this.prisma.user.findUnique({
          where: {
            id: task.userId,
          },
          select: {
            teamId: true,
          },
        });

      if (
        !taskOwner ||
        taskOwner.teamId !== user.teamId
      ) {
        throw new NotFoundException(
          "Task does not belong to your team",
        );
      }
    }

    return this.formatTask(task);
  }

  // =====================================================
  // CREATE TASK
  // =====================================================

  async createTask(
    dto: CreateTaskDto,
  ) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          id: dto.userId,
        },

        select: {
          id: true,
          name: true,
          teamId: true,
        },
      });

    if (!user) {
      throw new NotFoundException(
        "User not found",
      );
    }

    // ===================================================
    // VALIDATE PROJECT (IF PROVIDED)
    // ===================================================

    if (dto.projectId) {
      const project =
        await this.prisma.project.findUnique({
          where: {
            id: dto.projectId,
          },
          select: {
            id: true,
            teamId: true,
          },
        });

      if (
        !project ||
        project.teamId !== user.teamId
      ) {
        throw new NotFoundException(
          "Project not found in your team",
        );
      }
    }

    const newTask =
      await this.prisma.task.create({
        data: {
          userId: dto.userId,

          projectId: dto.projectId || null,

          title: dto.title,

          description:
            dto.description || "",

          status:
            dto.status || "To Do",

          priority:
            dto.priority || "Medium",

          assignee:
            dto.assignee || "",

          avatarType:
            dto.avatarType || "text",

          reporter:
            dto.reporter || "",

          startDate: dto.startDate
            ? this.parseDueDate(
                dto.startDate,
              )
            : null,

          dueDate: dto.dueDate
            ? this.parseDueDate(
                dto.dueDate,
              )
            : null,

          tags:
            dto.tags &&
            dto.tags.length > 0
              ? dto.tags.join(",")
              : "",
        },

        include: {
          subtasks: true,

          resources: {
            orderBy: {
              createdAt: "asc",
            },
          },

          project: {
            select: {
              id: true,
              name: true,
            },
          },

          editLock: {
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
          },

          activityLogs: {
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

            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

    // ===================================================
    // CREATE ACTIVITY
    // ===================================================

    await this.prisma.activityLog.create({
      data: {
        action: "created this task",
        userId: dto.userId,
        taskId: newTask.id,
      },
    });

    // ===================================================
    // RELOAD TASK
    // ===================================================

    const finalTask =
      await this.prisma.task.findUnique({
        where: {
          id: newTask.id,
        },

        include: {
          subtasks: true,

          resources: {
            orderBy: {
              createdAt: "asc",
            },
          },

          project: {
            select: {
              id: true,
              name: true,
            },
          },

          editLock: {
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
          },

          activityLogs: {
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

            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

    if (!finalTask) {
      throw new NotFoundException(
        "Created task could not be loaded",
      );
    }

    const formattedTask =
      this.formatTask(finalTask);

    // ===================================================
    // REALTIME
    // ===================================================

    if (user.teamId) {
      this.realtimeGateway.emitTaskCreated(
        user.teamId,
        formattedTask,
        dto.userId,
      );
    }

    return formattedTask;
  }

  // =====================================================
  // UPDATE TASK
  // =====================================================

  async updateTask(
    id: string,
    dto: UpdateTaskDto,
  ) {
    // ===================================================
    // FIND USER
    // ===================================================

    const user =
      await this.prisma.user.findUnique({
        where: {
          id: dto.userId,
        },

        select: {
          id: true,
          name: true,
          teamId: true,
        },
      });

    if (!user) {
      throw new NotFoundException(
        "User not found",
      );
    }

    if (!user.teamId) {
      throw new NotFoundException(
        "User does not belong to a team",
      );
    }

    // ===================================================
    // FIND TASK
    // ===================================================

    const existingTask =
      await this.prisma.task.findUnique({
        where: {
          id,
        },

        include: {
          user: {
            select: {
              id: true,
              teamId: true,
            },
          },

          editLock: {
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
          },
        },
      });

    if (!existingTask) {
      throw new NotFoundException(
        "Task not found",
      );
    }

    // ===================================================
    // TEAM CHECK
    // ===================================================

    if (
      existingTask.user.teamId !==
      user.teamId
    ) {
      throw new NotFoundException(
        "Task does not belong to your team",
      );
    }

    // ===================================================
    // PERSISTENT DATABASE LOCK CHECK
    // ===================================================

    const databaseLock =
      await this.prisma.taskEditLock.findUnique({
        where: {
          taskId: id,
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

    if (
      databaseLock &&
      databaseLock.userId !== user.id
    ) {
      throw new ConflictException({
        message: `Task is locked by ${
          databaseLock.user?.name ||
          databaseLock.user?.email ||
          "another team member"
        }`,
        code: "TASK_LOCKED",
        taskId: id,
        locked: true,
        lock: {
          taskId: id,
          userId:
            databaseLock.userId,
          userName:
            databaseLock.user?.name ||
            "Team Member",
          lockedAt:
            databaseLock.lockedAt,
        },
      });
    }

    // ===================================================
    // BUILD UPDATE
    // ===================================================

    const updateData:
      Prisma.TaskUpdateInput = {};

    const activities: string[] = [];

    if (
      dto.title !== undefined &&
      dto.title !== existingTask.title
    ) {
      updateData.title =
        dto.title;

      activities.push(
        "changed the task title",
      );
    }

    if (
      dto.description !==
        undefined &&
      dto.description !==
        existingTask.description
    ) {
      updateData.description =
        dto.description;

      activities.push(
        "updated the task description",
      );
    }

    if (
      dto.status !== undefined &&
      dto.status !==
        existingTask.status
    ) {
      updateData.status =
        dto.status;

      activities.push(
        `changed status from ${existingTask.status} to ${dto.status}`,
      );
    }

    if (
      dto.priority !== undefined &&
      dto.priority !==
        existingTask.priority
    ) {
      updateData.priority =
        dto.priority;

      activities.push(
        `changed priority from ${existingTask.priority} to ${dto.priority}`,
      );
    }

    if (
      dto.assignee !== undefined &&
      dto.assignee !==
        existingTask.assignee
    ) {
      updateData.assignee =
        dto.assignee;

      activities.push(
        "changed the assignee",
      );
    }

    if (
      dto.avatarType !== undefined &&
      dto.avatarType !==
        existingTask.avatarType
    ) {
      updateData.avatarType =
        dto.avatarType;

      activities.push(
        "changed the task avatar",
      );
    }

    if (
      dto.reporter !== undefined &&
      dto.reporter !==
        existingTask.reporter
    ) {
      updateData.reporter =
        dto.reporter;

      activities.push(
        "changed the reporter",
      );
    }

    if (
      dto.startDate !== undefined
    ) {
      const parsedDate =
        dto.startDate
          ? this.parseDueDate(
              dto.startDate,
            )
          : null;

      const oldDate =
        existingTask.startDate
          ? this.formatDueDate(
              existingTask.startDate,
            )
          : "";

      if (
        oldDate !==
        (dto.startDate || "")
      ) {
        updateData.startDate =
          parsedDate;

        activities.push(
          "changed the start date",
        );
      }
    }

    if (
      dto.dueDate !== undefined
    ) {
      const parsedDate =
        dto.dueDate
          ? this.parseDueDate(
              dto.dueDate,
            )
          : null;

      const oldDate =
        existingTask.dueDate
          ? this.formatDueDate(
              existingTask.dueDate,
            )
          : "";

      if (
        oldDate !==
        (dto.dueDate || "")
      ) {
        updateData.dueDate =
          parsedDate;

        activities.push(
          "changed the due date",
        );
      }
    }

    if (
      dto.tags !== undefined
    ) {
      const newTags =
        dto.tags.length > 0
          ? dto.tags.join(",")
          : "";

      if (
        newTags !==
        (existingTask.tags || "")
      ) {
        updateData.tags =
          newTags;

        activities.push(
          "updated the task labels",
        );
      }
    }

    // ===================================================
    // PROJECT ASSIGNMENT
    // ===================================================

    if (
      dto.projectId !== undefined &&
      dto.projectId !==
        (existingTask.projectId || null)
    ) {
      if (dto.projectId) {
        const project =
          await this.prisma.project.findUnique({
            where: {
              id: dto.projectId,
            },
            select: {
              id: true,
              name: true,
              teamId: true,
            },
          });

        if (
          !project ||
          project.teamId !== user.teamId
        ) {
          throw new NotFoundException(
            "Project not found in your team",
          );
        }

        updateData.project = {
          connect: {
            id: dto.projectId,
          },
        };

        activities.push(
          `moved this task to ${project.name}`,
        );
      } else {
        updateData.project = {
          disconnect: true,
        };

        activities.push(
          "removed this task from its project",
        );
      }
    }

    // ===================================================
    // NOTHING CHANGED
    // ===================================================

    if (
      Object.keys(updateData).length ===
      0
    ) {
      return this.findOne(
        id,
        user.id,
      );
    }

    // ===================================================
    // UPDATE TASK
    // ===================================================

    await this.prisma.task.update({
      where: {
        id,
      },

      data: updateData,
    });

    // ===================================================
    // ACTIVITY LOG
    // ===================================================

    let taskActivityId: string | undefined;

    if (activities.length > 0) {
      const activity =
        await this.prisma.activityLog.create({
          data: {
            action:
              activities.join(", "),

            userId:
              user.id,

            taskId:
              id,
          },
        });

      taskActivityId = activity.id;
    }

    // ===================================================
    // LOAD UPDATED TASK
    // ===================================================

    const finalTask =
      await this.prisma.task.findUnique({
        where: {
          id,
        },

        include: {
          subtasks: true,

          resources: {
            orderBy: {
              createdAt: "asc",
            },
          },

          project: {
            select: {
              id: true,
              name: true,
            },
          },

          editLock: {
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
          },

          activityLogs: {
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

            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

    if (!finalTask) {
      throw new NotFoundException(
        "Updated task could not be loaded",
      );
    }

    const formattedTask =
      this.formatTask(finalTask);

    // ===================================================
    // GLOBAL TASK UPDATE
    // ===================================================

    this.realtimeGateway.emitTaskUpdated(
      user.teamId,
      formattedTask,
      user.id,
    );

    // ===================================================
    // GLOBAL ACTIVITY UPDATE
    // ===================================================

    if (taskActivityId) {
      const activity =
        await this.prisma.activityLog.findUnique({
          where: {
            id: taskActivityId,
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

      if (activity) {
        this.realtimeGateway.emitTaskActivity(
          user.teamId,
          activity,
        );
      }
    }

    return formattedTask;
  }

  // =====================================================
// CREATE COMMENT
// =====================================================

async createComment(
  taskId: string,
  userId: string,
  content: string,
) {
  const value = content.trim();

  if (!value) {
    throw new ConflictException(
      "Comment cannot be empty",
    );
  }

  // ---------------------------------------------------
  // FIND USER
  // ---------------------------------------------------

  const user =
    await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        teamId: true,
      },
    });

  if (!user) {
    throw new NotFoundException(
      "User not found",
    );
  }

  if (!user.teamId) {
    throw new NotFoundException(
      "User does not belong to a team",
    );
  }

  // ---------------------------------------------------
  // VERIFY TASK BELONGS TO USER'S TEAM
  // ---------------------------------------------------

  const task =
    await this.prisma.task.findUnique({
      where: {
        id: taskId,
      },
      select: {
        id: true,
        user: {
          select: {
            teamId: true,
          },
        },
      },
    });

  if (!task) {
    throw new NotFoundException(
      "Task not found",
    );
  }

  if (
    task.user.teamId !==
    user.teamId
  ) {
    throw new ConflictException(
      "This task does not belong to your team",
    );
  }

  // ---------------------------------------------------
  // CREATE COMMENT
  // ---------------------------------------------------

  const comment =
    await this.prisma.comment.create({
      data: {
        content: value,
        userId,
        taskId,
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

  // ---------------------------------------------------
  // CREATE ACTIVITY LOG
  // ---------------------------------------------------

  const activity =
    await this.prisma.activityLog.create({
      data: {
        action:
          `commented: ${value}`,

        userId,

        taskId,
        commentId: comment.id,
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

  // ---------------------------------------------------
  // REALTIME ACTIVITY
  // ---------------------------------------------------

  this.realtimeGateway.emitTaskActivity(
    user.teamId,
    activity,
  );

  return {
    comment,
    activity,
  };
}
// =====================================================
// CREATE REPLY
// =====================================================

async createReply(
  taskId: string,
  commentId: string,
  userId: string,
  content: string,
) {
  const value = content.trim();

  if (!value) {
    throw new ConflictException(
      "Reply cannot be empty",
    );
  }

  // ---------------------------------------------------
  // FIND USER
  // ---------------------------------------------------

  const user =
    await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        teamId: true,
      },
    });

  if (!user) {
    throw new NotFoundException(
      "User not found",
    );
  }

  if (!user.teamId) {
    throw new NotFoundException(
      "User does not belong to a team",
    );
  }

  // ---------------------------------------------------
  // VERIFY TASK
  // ---------------------------------------------------

  const task =
    await this.prisma.task.findUnique({
      where: {
        id: taskId,
      },
      select: {
        id: true,
        user: {
          select: {
            teamId: true,
          },
        },
      },
    });

  if (!task) {
    throw new NotFoundException(
      "Task not found",
    );
  }

  if (
    task.user.teamId !==
    user.teamId
  ) {
    throw new ConflictException(
      "This task does not belong to your team",
    );
  }

  // ---------------------------------------------------
  // VERIFY PARENT COMMENT
  // ---------------------------------------------------

  const parentComment =
    await this.prisma.comment.findFirst({
      where: {
        id: commentId,
        taskId,
      },
      select: {
        id: true,
      },
    });

  if (!parentComment) {
    throw new NotFoundException(
      "Parent comment not found",
    );
  }

  // ---------------------------------------------------
  // CREATE REPLY
  // ---------------------------------------------------

  const reply =
    await this.prisma.comment.create({
      data: {
        content: value,
        userId,
        taskId,
        parentId: commentId,
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

  // ---------------------------------------------------
  // CREATE ACTIVITY LOG
  // ---------------------------------------------------

const activity =
  await this.prisma.activityLog.create({
    data: {
      action: `replied: ${value}`,
      userId,
      taskId,
      commentId: commentId,
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
  // ---------------------------------------------------
  // REALTIME ACTIVITY
  // ---------------------------------------------------

  this.realtimeGateway.emitTaskActivity(
    user.teamId,
    activity,
  );

  return {
    reply,
    activity,
  };
}

  // =====================================================
  // CREATE SUBTASK
  // =====================================================

  async createSubtask(
    taskId: string,
    dto: CreateSubtaskDto,
  ) {
    const user = await this.getTeamUserOrThrow(dto.userId);

    const task = await this.getTeamTaskOrThrow(
      taskId,
      user.teamId,
    );

    await this.prisma.subtask.create({
      data: {
        title: dto.title,
        priority: dto.priority || "Medium",
        assignee: dto.assignee || "",
        dueDate: dto.dueDate || null,
        taskId: task.id,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        action: `added a subtask: ${dto.title}`,
        userId: dto.userId,
        taskId: task.id,
      },
    });

    return this.reloadAndBroadcast(taskId, user.teamId!, dto.userId);
  }

  // =====================================================
  // UPDATE SUBTASK
  // =====================================================

  async updateSubtask(
    taskId: string,
    subtaskId: string,
    dto: UpdateSubtaskDto,
  ) {
    const user = await this.getTeamUserOrThrow(dto.userId);

    await this.getTeamTaskOrThrow(taskId, user.teamId);

    const existingSubtask =
      await this.prisma.subtask.findFirst({
        where: {
          id: subtaskId,
          taskId,
        },
      });

    if (!existingSubtask) {
      throw new NotFoundException("Subtask not found");
    }

    const updateData: Prisma.SubtaskUpdateInput = {};
    const activities: string[] = [];

    if (
      dto.title !== undefined &&
      dto.title !== existingSubtask.title
    ) {
      updateData.title = dto.title;
      activities.push("changed the subtask title");
    }

    if (
      dto.priority !== undefined &&
      dto.priority !== existingSubtask.priority
    ) {
      updateData.priority = dto.priority;
      activities.push(
        `changed subtask priority from ${existingSubtask.priority} to ${dto.priority}`,
      );
    }

    if (
      dto.assignee !== undefined &&
      dto.assignee !== existingSubtask.assignee
    ) {
      updateData.assignee = dto.assignee;
      activities.push("changed the subtask assignee");
    }

    if (
      dto.dueDate !== undefined &&
      dto.dueDate !== existingSubtask.dueDate
    ) {
      updateData.dueDate = dto.dueDate;
      activities.push("changed the subtask due date");
    }

    if (
      dto.completed !== undefined &&
      dto.completed !== existingSubtask.completed
    ) {
      updateData.completed = dto.completed;
      activities.push(
        dto.completed
          ? `completed subtask: ${existingSubtask.title}`
          : `reopened subtask: ${existingSubtask.title}`,
      );
    }

    // Nothing actually changed.
    if (Object.keys(updateData).length === 0) {
      return this.reloadAndBroadcast(
        taskId,
        user.teamId!,
        dto.userId,
      );
    }

    await this.prisma.subtask.update({
      where: {
        id: subtaskId,
      },
      data: updateData,
    });

    // Create the exact activity generated by this update.
    // The activity ID is passed to reloadAndBroadcast so it
    // never falls back to an older activity such as a resource
    // deletion/addition.
    const activity =
      await this.prisma.activityLog.create({
        data: {
          action: activities.join(", "),
          userId: dto.userId,
          taskId,
        },
      });

    return this.reloadAndBroadcast(
      taskId,
      user.teamId!,
      dto.userId,
      activity.id,
    );
  }

  // =====================================================
  // DELETE SUBTASK
  // =====================================================

  async deleteSubtask(
    taskId: string,
    subtaskId: string,
    userId: string,
  ) {
    const user = await this.getTeamUserOrThrow(userId);

    await this.getTeamTaskOrThrow(taskId, user.teamId);

    const existingSubtask =
      await this.prisma.subtask.findFirst({
        where: {
          id: subtaskId,
          taskId,
        },
      });

    if (!existingSubtask) {
      throw new NotFoundException("Subtask not found");
    }

    await this.prisma.subtask.delete({
      where: {
        id: subtaskId,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        action: `removed subtask: ${existingSubtask.title}`,
        userId,
        taskId,
      },
    });

    return this.reloadAndBroadcast(taskId, user.teamId!, userId);
  }

  // =====================================================
  // CREATE RESOURCE (link / document)
  // =====================================================

  async createResource(
    taskId: string,
    dto: CreateResourceDto,
  ) {
    const user = await this.getTeamUserOrThrow(dto.userId);

    const task = await this.getTeamTaskOrThrow(
      taskId,
      user.teamId,
    );

    const normalizedUrl = this.normalizeResourceUrl(dto.url);

    await this.prisma.resource.create({
      data: {
        name: dto.name,
        url: normalizedUrl,
        type: "link",
        taskId: task.id,
        userId: dto.userId,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        action: `added a resource: ${dto.name}`,
        userId: dto.userId,
        taskId: task.id,
      },
    });

    return this.reloadAndBroadcast(
      taskId,
      user.teamId!,
      dto.userId,
    );
  }

  // =====================================================
  // CREATE FILE RESOURCE
  // =====================================================

  async createFileResource(
    taskId: string,
    userId: string,
    file: Express.Multer.File,
    name?: string,
  ) {
    const user = await this.getTeamUserOrThrow(userId);

    const task = await this.getTeamTaskOrThrow(
      taskId,
      user.teamId,
    );

    if (!file) {
      throw new ConflictException(
        "No file was uploaded",
      );
    }

    const relativePath = relative(
      process.cwd(),
      file.path,
    );

    const resource =
      await this.prisma.resource.create({
        data: {
          name:
            name?.trim() ||
            file.originalname,

          // Resource.url is retained for backwards
          // compatibility with the existing frontend.
          // The actual physical file is stored in filePath.
          url: "",

          type: "file",
          filePath: relativePath,
          mimeType:
            file.mimetype ||
            "application/octet-stream",
          fileSize: file.size,

          taskId: task.id,
          userId,
        },
      });

    const fileUrl =
      `/api/tasks/${taskId}/resources/${resource.id}/file`;

    await this.prisma.resource.update({
      where: {
        id: resource.id,
      },
      data: {
        url: fileUrl,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        action: `added a resource: ${resource.name}`,
        userId,
        taskId,
      },
    });

    return this.reloadAndBroadcast(
      taskId,
      user.teamId!,
      userId,
    );
  }

  // =====================================================
  // CREATE MULTIPLE FILE RESOURCES
  // =====================================================
  //
  // Used for folder/multiple-file selection.
  // Each uploaded file is stored as an individual
  // Resource record attached to the same task.
  // =====================================================

  async createFileResources(
    taskId: string,
    userId: string,
    files: Express.Multer.File[],
  ) {
    const user = await this.getTeamUserOrThrow(userId);

    const task = await this.getTeamTaskOrThrow(
      taskId,
      user.teamId,
    );

    if (!files || files.length === 0) {
      throw new ConflictException(
        "No files were uploaded",
      );
    }

    for (const file of files) {
      const relativePath = relative(
        process.cwd(),
        file.path,
      );

      const resource =
        await this.prisma.resource.create({
          data: {
            name: file.originalname,
            url: "",
            type: "file",
            filePath: relativePath,
            mimeType:
              file.mimetype ||
              "application/octet-stream",
            fileSize: file.size,
            taskId: task.id,
            userId,
          },
        });

      await this.prisma.resource.update({
        where: {
          id: resource.id,
        },
        data: {
          url:
            `/api/tasks/${taskId}/resources/${resource.id}/file`,
        },
      });

      await this.prisma.activityLog.create({
        data: {
          action: `added a resource: ${resource.name}`,
          userId,
          taskId,
        },
      });
    }

    return this.reloadAndBroadcast(
      taskId,
      user.teamId!,
      userId,
    );
  }

  // =====================================================
  // UPDATE RESOURCE
  // =====================================================
  //
  // Existing team members can edit the resource name.
  // External links can also have their URL changed.
  // Uploaded files keep their physical file path.
  // =====================================================

  async updateResource(
    taskId: string,
    resourceId: string,
    userId: string,
    name?: string,
    url?: string,
  ) {
    const user = await this.getTeamUserOrThrow(userId);

    await this.getTeamTaskOrThrow(
      taskId,
      user.teamId,
    );

    const existingResource =
      await this.prisma.resource.findFirst({
        where: {
          id: resourceId,
          taskId,
        },
      });

    if (!existingResource) {
      throw new NotFoundException(
        "Resource not found",
      );
    }

    const updateData: Prisma.ResourceUpdateInput = {};

    if (name !== undefined) {
      const trimmedName = name.trim();

      if (!trimmedName) {
        throw new ConflictException(
          "Resource name cannot be empty",
        );
      }

      updateData.name = trimmedName;
    }

    // Only external-link resources should change their URL.
    // Uploaded files keep their generated internal URL.
    if (
      url !== undefined &&
      existingResource.type !== "file"
    ) {
      updateData.url =
        this.normalizeResourceUrl(url);
    }

    if (
      Object.keys(updateData).length === 0
    ) {
      return this.reloadAndBroadcast(
        taskId,
        user.teamId!,
        userId,
      );
    }

    await this.prisma.resource.update({
      where: {
        id: resourceId,
      },
      data: updateData,
    });

    await this.prisma.activityLog.create({
      data: {
        action: `updated resource: ${existingResource.name}`,
        userId,
        taskId,
      },
    });

    return this.reloadAndBroadcast(
      taskId,
      user.teamId!,
      userId,
    );
  }

  // =====================================================
  // GET RESOURCE FILE
  // =====================================================
  //
  // Only members of the task's team can access an
  // uploaded resource.
  // =====================================================

  async getResourceFile(
    taskId: string,
    resourceId: string,
    userId: string,
  ) {
    const user = await this.getTeamUserOrThrow(userId);

    await this.getTeamTaskOrThrow(
      taskId,
      user.teamId,
    );

    const resource =
      await this.prisma.resource.findFirst({
        where: {
          id: resourceId,
          taskId,
        },
      });

    if (!resource) {
      throw new NotFoundException(
        "Resource not found",
      );
    }

    if (
      resource.type !== "file" ||
      !resource.filePath
    ) {
      throw new NotFoundException(
        "This resource is not an uploaded file",
      );
    }

    const filePath = resolve(
      process.cwd(),
      resource.filePath,
    );

    if (!existsSync(filePath)) {
      throw new NotFoundException(
        "Resource file is missing from the server",
      );
    }

    return {
      ...resource,
      filePath,
    };
  }

  // =====================================================
  // DELETE RESOURCE
  // =====================================================

  async deleteResource(
    taskId: string,
    resourceId: string,
    userId: string,
  ) {
    const user = await this.getTeamUserOrThrow(userId);

    await this.getTeamTaskOrThrow(
      taskId,
      user.teamId,
    );

    const existingResource =
      await this.prisma.resource.findFirst({
        where: {
          id: resourceId,
          taskId,
        },
      });

    if (!existingResource) {
      throw new NotFoundException(
        "Resource not found",
      );
    }

    // Remove the physical uploaded file as well.
    // External links have no filePath and are unaffected.
    if (
      existingResource.type === "file" &&
      existingResource.filePath
    ) {
      const filePath = resolve(
        process.cwd(),
        existingResource.filePath,
      );

      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    }

    await this.prisma.resource.delete({
      where: {
        id: resourceId,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        action: `removed a resource: ${existingResource.name}`,
        userId,
        taskId,
      },
    });

    return this.reloadAndBroadcast(
      taskId,
      user.teamId!,
      userId,
    );
  }

  // =====================================================
  // DELETE TASK
  // =====================================================

  async deleteTask(
    id: string,
    userId: string,
  ) {
    const existingTask =
      await this.prisma.task.findFirst({
        where: {
          id,
          userId,
        },

        include: {
          user: true,
          editLock: true,
        },
      });

    if (!existingTask) {
      throw new NotFoundException(
        "Task not found or does not belong to this user",
      );
    }

    // ===================================================
    // LOCK CHECK
    // ===================================================

    if (
      existingTask.editLock &&
      existingTask.editLock.userId !==
        userId
    ) {
      const lockOwner =
        await this.prisma.user.findUnique({
          where: {
            id:
              existingTask.editLock.userId,
          },

          select: {
            name: true,
            email: true,
          },
        });

      throw new ConflictException(
        `Task is currently being edited by ${
          lockOwner?.name ||
          lockOwner?.email ||
          "another team member"
        }`,
      );
    }

    const teamId =
      existingTask.user.teamId;

    // ===================================================
    // ACTIVITY
    // ===================================================

    await this.prisma.activityLog.create({
      data: {
        action:
          "deleted this task",
        userId,
        taskId: id,
      },
    });

    // ===================================================
    // DELETE
    // ===================================================

    await this.prisma.task.delete({
      where: {
        id,
      },
    });

    // ===================================================
    // REALTIME
    // ===================================================

    if (teamId) {
      this.realtimeGateway.emitTaskDeleted(
        teamId,
        id,
        userId,
      );
    }

    return {
      success: true,
      message:
        "Task deleted successfully",
      taskId: id,
    };
  }

  // =====================================================
  // SHARED HELPERS (subtasks / resources)
  // =====================================================

  private async getTeamUserOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        teamId: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (!user.teamId) {
      throw new NotFoundException(
        "User does not belong to a team",
      );
    }

    return {
      ...user,
      teamId: user.teamId,
    };
  }

  private async getTeamTaskOrThrow(
    taskId: string,
    teamId: string,
  ) {
    const task = await this.prisma.task.findUnique({
      where: {
        id: taskId,
      },
      include: {
        user: {
          select: {
            teamId: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException("Task not found");
    }

    if (task.user.teamId !== teamId) {
      throw new NotFoundException(
        "Task does not belong to your team",
      );
    }

    return task;
  }

  private normalizeResourceUrl(url: string): string {
    const trimmed = url.trim();

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    return `https://${trimmed}`;
  }

  // =====================================================
  // RELOAD TASK + BROADCAST TO TEAM
  //
  // Used after subtask/resource changes so every
  // connected client (including anyone with the task
  // open) receives the updated task in realtime.
  // =====================================================

  private async reloadAndBroadcast(
    taskId: string,
    teamId: string,
    userId: string,
    activityId?: string,
  ) {
    const finalTask = await this.prisma.task.findUnique({
      where: {
        id: taskId,
      },

      include: {
        subtasks: true,

        resources: {
          orderBy: {
            createdAt: "asc",
          },
        },

        project: {
          select: {
            id: true,
            name: true,
          },
        },

        editLock: {
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
        },

        activityLogs: {
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

          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!finalTask) {
      throw new NotFoundException(
        "Task could not be reloaded",
      );
    }

    const formattedTask = this.formatTask(finalTask);

    this.realtimeGateway.emitTaskUpdated(
      teamId,
      formattedTask,
      userId,
    );

    // Emit only the exact activity created by the mutation.
    // Never query for "latest activity" here because an older
    // resource/comment/subtask activity could otherwise be
    // incorrectly shown as the current toast/update.
    if (activityId) {
      const activity =
        await this.prisma.activityLog.findUnique({
          where: {
            id: activityId,
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

      if (activity) {
        this.realtimeGateway.emitTaskActivity(
          teamId,
          activity,
        );
      }
    }

    return formattedTask;
  }

  // =====================================================
  // FORMAT TASK
  // =====================================================

  private formatTask<
    T extends {
      startDate: Date | null;
      dueDate: Date | null;
      tags: string | null;
    },
  >(task: T) {
    return {
      ...task,

      startDate: task.startDate
        ? this.formatDueDate(
            task.startDate,
          )
        : "",

      dueDate: task.dueDate
        ? this.formatDueDate(
            task.dueDate,
          )
        : "",

      tags: task.tags
        ? task.tags
            .split(",")
            .filter(Boolean)
        : [],

      // Persisted edit-lock state exposed to the client.
      isLocked: Boolean((task as any).editLock),
      lockedByUserId: (task as any).editLock?.userId ?? null,
      lockedBy: (task as any).editLock?.user?.name ?? null,
    };
  }

  // =====================================================
  // PARSE DATE
  // =====================================================

  private parseDueDate(
    value: string,
  ): Date | null {
    const match =
      value.match(
        /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/,
      );

    if (!match) {
      return null;
    }

    const day =
      Number(match[1]);

    const monthNames = [
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
      monthNames.indexOf(
        match[2],
      );

    const year =
      Number(match[3]);

    if (
      month < 0 ||
      day < 1 ||
      day > 31
    ) {
      return null;
    }

    return new Date(
      year,
      month,
      day,
    );
  }

  // =====================================================
  // FORMAT DATE
  // =====================================================

  private formatDueDate(
    date: Date,
  ): string {
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

    const day =
      String(
        date.getDate(),
      ).padStart(2, "0");

    return `${day} ${
      months[date.getMonth()]
    } ${date.getFullYear()}`;
  }
}