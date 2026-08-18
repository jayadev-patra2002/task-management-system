import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";

import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // =====================================================
  // GET ALL PROJECTS FOR USER'S TEAM
  // =====================================================

  async findAllByUser(userId: string) {
    const user = await this.getTeamUser(userId);

    if (!user.teamId) {
      return [];
    }

    const projects = await this.prisma.project.findMany({
      where: {
        teamId: user.teamId,
      },

      include: {
        tasks: {
          include: {
            subtasks: true,
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

    return projects.map((project) =>
      this.formatProject(project),
    );
  }

  // =====================================================
  // GET SINGLE PROJECT (WITH ITS TASKS)
  // =====================================================

  async findOne(id: string, userId: string) {
    const user = await this.getTeamUser(userId);

    const project = await this.prisma.project.findUnique({
      where: {
        id,
      },

      include: {
        tasks: {
          include: {
            subtasks: true,

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

          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    if (
      !user.teamId ||
      project.teamId !== user.teamId
    ) {
      throw new NotFoundException(
        "Project does not belong to your team",
      );
    }

    return this.formatProject(project);
  }

  // =====================================================
  // CREATE PROJECT
  // =====================================================

  async createProject(dto: CreateProjectDto) {
    const user = await this.getTeamUser(dto.userId);

    if (!user.teamId) {
      throw new NotFoundException(
        "User does not belong to a team",
      );
    }

    const project = await this.prisma.project.create({
      data: {
        name: dto.name,

        priority: dto.priority || "Medium",

        status: dto.status || "To Do",

        lead: dto.lead || null,

        // IMPORTANT:
        // Accepts YYYY-MM-DD from the frontend
        dueDate: dto.dueDate
          ? this.parseDueDate(dto.dueDate)
          : null,

        teamId: user.teamId,
      },

      include: {
        tasks: {
          include: {
            subtasks: true,
          },
        },
      },
    });

    return this.formatProject(project);
  }

  // =====================================================
  // UPDATE PROJECT
  // =====================================================

  async updateProject(
    id: string,
    dto: UpdateProjectDto,
  ) {
    const user = await this.getTeamUser(dto.userId);

    const existingProject =
      await this.prisma.project.findUnique({
        where: {
          id,
        },
      });

    if (!existingProject) {
      throw new NotFoundException(
        "Project not found",
      );
    }

    if (
      !user.teamId ||
      existingProject.teamId !== user.teamId
    ) {
      throw new NotFoundException(
        "Project does not belong to your team",
      );
    }

    const updateData: Prisma.ProjectUpdateInput = {};

    // =====================================================
    // NAME
    // =====================================================

    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }

    // =====================================================
    // PRIORITY
    // =====================================================

    if (dto.priority !== undefined) {
      updateData.priority = dto.priority;
    }

    // =====================================================
    // STATUS
    // =====================================================

    if (dto.status !== undefined) {
      updateData.status = dto.status;
    }

    // =====================================================
    // LEAD
    // =====================================================

    if (dto.lead !== undefined) {
      updateData.lead = dto.lead || null;
    }

    // =====================================================
    // DUE DATE
    // =====================================================

    if (dto.dueDate !== undefined) {
      updateData.dueDate =
        dto.dueDate && dto.dueDate.trim()
          ? this.parseDueDate(dto.dueDate)
          : null;
    }

    // =====================================================
    // UPDATE DATABASE
    // =====================================================

    const updatedProject =
      await this.prisma.project.update({
        where: {
          id,
        },

        data: updateData,

        include: {
          tasks: {
            include: {
              subtasks: true,
            },

            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

    return this.formatProject(updatedProject);
  }

  // =====================================================
  // DELETE PROJECT
  //
  // Tasks are NOT deleted — schema uses onDelete: SetNull,
  // so tasks simply become unassigned from any project.
  // =====================================================

  async deleteProject(
    id: string,
    userId: string,
  ) {
    const user = await this.getTeamUser(userId);

    const existingProject =
      await this.prisma.project.findUnique({
        where: {
          id,
        },
      });

    if (!existingProject) {
      throw new NotFoundException(
        "Project not found",
      );
    }

    if (
      !user.teamId ||
      existingProject.teamId !== user.teamId
    ) {
      throw new NotFoundException(
        "Project does not belong to your team",
      );
    }

    await this.prisma.project.delete({
      where: {
        id,
      },
    });

    return {
      success: true,
      message: "Project deleted successfully",
      projectId: id,
    };
  }

  // =====================================================
  // HELPERS
  // =====================================================

  private async getTeamUser(userId: string) {
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

    return user;
  }

  // =====================================================
  // FORMAT PROJECT
  // =====================================================

  private formatProject<
    T extends {
      dueDate: Date | null;

      tasks?: Array<{
        dueDate: Date | null;
        tags: string | null;
        [key: string]: unknown;
      }>;
    },
  >(project: T) {
    return {
      ...project,

      // Database DateTime
      // ↓
      // "25 Aug 2026"
      dueDate: project.dueDate
        ? this.formatDueDate(project.dueDate)
        : "",

      tasks: (project.tasks || []).map(
        (task) => ({
          ...task,

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
        }),
      ),
    };
  }

  // =====================================================
  // PARSE DUE DATE
  //
  // Accepts:
  //
  // 1. "2026-08-25"
  // 2. "25 Aug 2026"
  // 3. "2026-08-25T00:00:00.000Z"
  //
  // Returns:
  // JavaScript Date | null
  // =====================================================

  private parseDueDate(
    value: string,
  ): Date | null {
    if (!value) {
      return null;
    }

    const trimmed = value.trim();

    // ===================================================
    // FORMAT 1:
    // YYYY-MM-DD
    //
    // Example:
    // 2026-08-25
    // ===================================================

    const isoDateMatch =
      trimmed.match(
        /^(\d{4})-(\d{2})-(\d{2})$/,
      );

    if (isoDateMatch) {
      const year = Number(
        isoDateMatch[1],
      );

      const month = Number(
        isoDateMatch[2],
      );

      const day = Number(
        isoDateMatch[3],
      );

      return this.createValidDate(
        year,
        month - 1,
        day,
      );
    }

    // ===================================================
    // FORMAT 2:
    // ISO DATETIME
    //
    // Example:
    // 2026-08-25T00:00:00.000Z
    // ===================================================

    const isoDateTimeMatch =
      trimmed.match(
        /^(\d{4})-(\d{2})-(\d{2})T/,
      );

    if (isoDateTimeMatch) {
      const year = Number(
        isoDateTimeMatch[1],
      );

      const month = Number(
        isoDateTimeMatch[2],
      );

      const day = Number(
        isoDateTimeMatch[3],
      );

      return this.createValidDate(
        year,
        month - 1,
        day,
      );
    }

    // ===================================================
    // FORMAT 3:
    // DD Mon YYYY
    //
    // Example:
    // 25 Aug 2026
    // ===================================================

    const displayDateMatch =
      trimmed.match(
        /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/,
      );

    if (displayDateMatch) {
      const day = Number(
        displayDateMatch[1],
      );

      const monthName =
        displayDateMatch[2];

      const year = Number(
        displayDateMatch[3],
      );

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
          monthName,
        );

      return this.createValidDate(
        year,
        month,
        day,
      );
    }

    // ===================================================
    // UNKNOWN FORMAT
    // ===================================================

    return null;
  }

  // =====================================================
  // CREATE VALID DATE
  // =====================================================

  private createValidDate(
    year: number,
    month: number,
    day: number,
  ): Date | null {
    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(day)
    ) {
      return null;
    }

    if (
      month < 0 ||
      month > 11 ||
      day < 1 ||
      day > 31
    ) {
      return null;
    }

    const date = new Date(
      year,
      month,
      day,
    );

    // Prevent invalid dates such as:
    // 31 Feb 2026
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  // =====================================================
  // FORMAT DUE DATE
  //
  // Date:
  // 2026-08-25
  //
  // Returns:
  // 25 Aug 2026
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

    const day = String(
      date.getDate(),
    ).padStart(2, "0");

    return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }
}