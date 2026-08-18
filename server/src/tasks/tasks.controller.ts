import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  Res,
  NotFoundException,
} from "@nestjs/common";

import {
  FileInterceptor,
  FilesInterceptor,
} from "@nestjs/platform-express";

import {
  diskStorage,
} from "multer";

import {
  extname,
  join,
} from "path";

import {
  existsSync,
  mkdirSync,
} from "fs";

import type {
  Response,
} from "express";

import {
  randomUUID,
} from "crypto";

import { TasksService } from "./tasks.service";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { CreateSubtaskDto } from "./dto/create-subtask.dto";
import { UpdateSubtaskDto } from "./dto/update-subtask.dto";
import { CreateResourceDto } from "./dto/create-resource.dto";


/*
 * =====================================================
 * RESOURCE UPLOAD DIRECTORY
 * =====================================================
 *
 * Files uploaded for tasks are stored here:
 *
 * server/uploads/tasks/
 *
 * The directory is created automatically if it
 * doesn't already exist.
 *
 * IMPORTANT:
 * Do not change the existing UI for this.
 * This only adds backend upload capability.
 * =====================================================
 */

const taskUploadDirectory = join(
  process.cwd(),
  "uploads",
  "tasks",
);

if (!existsSync(taskUploadDirectory)) {
  mkdirSync(
    taskUploadDirectory,
    {
      recursive: true,
    },
  );
}


@Controller("tasks")
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
  ) {}


  // =====================================================
  // GET ALL TASKS FOR USER
  // =====================================================

  @Get()
  async getTasks(
    @Query("userId") userId: string,
    @Query("projectId") projectId?: string,
  ) {
    return this.tasksService.findAllByUser(
      userId,
      projectId,
    );
  }


  // =====================================================
  // CREATE TASK
  // =====================================================

  @Post()
  async createTask(
    @Body() createTaskDto: CreateTaskDto,
  ) {
    return this.tasksService.createTask(
      createTaskDto,
    );
  }


  // =====================================================
  // UPDATE TASK
  // =====================================================

  @Put(":id")
  async updateTask(
    @Param("id") id: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    return this.tasksService.updateTask(
      id,
      updateTaskDto,
    );
  }


  // =====================================================
  // CREATE COMMENT
  // =====================================================

  @Post(":id/comments")
  async createComment(
    @Param("id") taskId: string,
    @Body()
    body: {
      userId: string;
      content: string;
    },
  ) {
    return this.tasksService.createComment(
      taskId,
      body.userId,
      body.content,
    );
  }


  // =====================================================
  // CREATE REPLY
  // =====================================================

  @Post(":id/comments/:commentId/replies")
  async createReply(
    @Param("id") taskId: string,
    @Param("commentId") commentId: string,
    @Body()
    body: {
      userId: string;
      content: string;
    },
  ) {
    return this.tasksService.createReply(
      taskId,
      commentId,
      body.userId,
      body.content,
    );
  }


  // =====================================================
  // CREATE SUBTASK
  // =====================================================

  @Post(":id/subtasks")
  async createSubtask(
    @Param("id") taskId: string,
    @Body() createSubtaskDto: CreateSubtaskDto,
  ) {
    return this.tasksService.createSubtask(
      taskId,
      createSubtaskDto,
    );
  }


  // =====================================================
  // UPDATE SUBTASK
  // =====================================================

  @Put(":id/subtasks/:subtaskId")
  async updateSubtask(
    @Param("id") taskId: string,
    @Param("subtaskId") subtaskId: string,
    @Body() updateSubtaskDto: UpdateSubtaskDto,
  ) {
    return this.tasksService.updateSubtask(
      taskId,
      subtaskId,
      updateSubtaskDto,
    );
  }


  // =====================================================
  // DELETE SUBTASK
  // =====================================================

  @Delete(":id/subtasks/:subtaskId")
  async deleteSubtask(
    @Param("id") taskId: string,
    @Param("subtaskId") subtaskId: string,
    @Body("userId") userId: string,
  ) {
    return this.tasksService.deleteSubtask(
      taskId,
      subtaskId,
      userId,
    );
  }


  // =====================================================
  // CREATE RESOURCE
  //
  // Existing functionality:
  // Add an external link.
  //
  // Example:
  // Google Docs
  // Figma
  // GitHub
  // Jira
  // Any external URL
  // =====================================================

  @Post(":id/resources")
  async createResource(
    @Param("id") taskId: string,
    @Body() createResourceDto: CreateResourceDto,
  ) {
    return this.tasksService.createResource(
      taskId,
      createResourceDto,
    );
  }


  // =====================================================
  // UPLOAD SINGLE RESOURCE FILE
  // =====================================================
  //
  // Used when user selects:
  //
  // "Choose file from computer"
  //
  // Frontend sends:
  //
  // FormData:
  //   file
  //   userId
  //   name (optional)
  //
  // =====================================================

  @Post(":id/resources/upload")
  @UseInterceptors(
    FileInterceptor(
      "file",
      {
        storage: diskStorage({
          destination: (
            req,
            file,
            callback,
          ) => {
            callback(
              null,
              taskUploadDirectory,
            );
          },

          filename: (
            req,
            file,
            callback,
          ) => {
            const extension =
              extname(
                file.originalname,
              );

            callback(
              null,
              `${randomUUID()}${extension}`,
            );
          },
        }),

        limits: {
          /*
           * 100 MB maximum per file.
           *
           * You can change this later.
           */
          fileSize:
            100 * 1024 * 1024,
        },
      },
    ),
  )
  async uploadResource(
    @Param("id") taskId: string,

    @UploadedFile()
    file: Express.Multer.File,

    @Body("userId")
    userId: string,

    @Body("name")
    name?: string,
  ) {
    if (!file) {
      throw new NotFoundException(
        "No file was uploaded",
      );
    }

    return this.tasksService.createFileResource(
      taskId,
      userId,
      file,
      name,
    );
  }


  // =====================================================
  // UPLOAD MULTIPLE RESOURCE FILES
  // =====================================================
  //
  // Used by:
  //
  // "Choose folder"
  //
  // Browsers send the files inside the selected
  // directory as multiple files.
  //
  // Each file becomes an individual Resource record.
  //
  // =====================================================

  @Post(":id/resources/upload-many")
  @UseInterceptors(
    FilesInterceptor(
      "files",
      100,
      {
        storage: diskStorage({
          destination: (
            req,
            file,
            callback,
          ) => {
            callback(
              null,
              taskUploadDirectory,
            );
          },

          filename: (
            req,
            file,
            callback,
          ) => {
            const extension =
              extname(
                file.originalname,
              );

            callback(
              null,
              `${randomUUID()}${extension}`,
            );
          },
        }),

        limits: {
          fileSize:
            100 * 1024 * 1024,
        },
      },
    ),
  )
  async uploadResources(
    @Param("id") taskId: string,

    @UploadedFiles()
    files: Express.Multer.File[],

    @Body("userId")
    userId: string,
  ) {
    if (
      !files ||
      files.length === 0
    ) {
      throw new NotFoundException(
        "No files were uploaded",
      );
    }

    return this.tasksService.createFileResources(
      taskId,
      userId,
      files,
    );
  }


  // =====================================================
  // UPDATE RESOURCE
  // =====================================================
  //
  // Allows the resource creator/team member to edit:
  //
  // - Resource name
  // - External URL
  //
  // Uploaded physical files can also be renamed
  // through the service.
  //
  // =====================================================

  @Put(":id/resources/:resourceId")
  async updateResource(
    @Param("id") taskId: string,

    @Param("resourceId")
    resourceId: string,

    @Body()
    body: {
      userId: string;
      name?: string;
      url?: string;
    },
  ) {
    return this.tasksService.updateResource(
      taskId,
      resourceId,
      body.userId,
      body.name,
      body.url,
    );
  }


  // =====================================================
  // VIEW / DOWNLOAD RESOURCE FILE
  // =====================================================
  //
  // The frontend can use:
  //
  // GET /api/tasks/:taskId/resources/:resourceId/file
  //
  // The backend verifies the user before returning
  // the file.
  //
  // query:
  //
  // ?userId=xxxxx
  //
  // ?download=true
  //
  // =====================================================

  @Get(":id/resources/:resourceId/file")
  async getResourceFile(
    @Param("id") taskId: string,

    @Param("resourceId")
    resourceId: string,

    @Query("userId")
    userId: string,

    @Query("download")
    download: string,

    @Res()
    response: Response,
  ) {
    const resource =
      await this.tasksService.getResourceFile(
        taskId,
        resourceId,
        userId,
      );

    if (!resource) {
      throw new NotFoundException(
        "Resource file not found",
      );
    }

    /*
     * download=true
     *
     * forces browser download.
     *
     * Otherwise the browser is allowed to preview
     * supported files such as PDF/images.
     */

    if (
      download === "true"
    ) {
      return response.download(
        resource.filePath,
        resource.name,
      );
    }

    return response.sendFile(
      resource.filePath,
    );
  }


  // =====================================================
  // DELETE RESOURCE
  // =====================================================

  @Delete(":id/resources/:resourceId")
  async deleteResource(
    @Param("id") taskId: string,
    @Param("resourceId") resourceId: string,
    @Body("userId") userId: string,
  ) {
    return this.tasksService.deleteResource(
      taskId,
      resourceId,
      userId,
    );
  }


  // =====================================================
  // DELETE TASK
  // =====================================================

  @Delete(":id")
  async deleteTask(
    @Param("id") id: string,
    @Body("userId") userId: string,
  ) {
    return this.tasksService.deleteTask(
      id,
      userId,
    );
  }
}