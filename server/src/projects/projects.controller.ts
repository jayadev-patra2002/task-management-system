import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";

import { ProjectsService } from "./projects.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

@Controller("projects")
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
  ) {}

  // =====================================================
  // GET ALL PROJECTS FOR USER'S TEAM
  // =====================================================

  @Get()
  async getProjects(
    @Query("userId") userId: string,
  ) {
    return this.projectsService.findAllByUser(userId);
  }

  // =====================================================
  // GET SINGLE PROJECT (WITH ITS TASKS)
  // =====================================================

  @Get(":id")
  async getProject(
    @Param("id") id: string,
    @Query("userId") userId: string,
  ) {
    return this.projectsService.findOne(id, userId);
  }

  // =====================================================
  // CREATE PROJECT
  // =====================================================

  @Post()
  async createProject(
    @Body() createProjectDto: CreateProjectDto,
  ) {
    return this.projectsService.createProject(
      createProjectDto,
    );
  }

  // =====================================================
  // UPDATE PROJECT
  // =====================================================

  @Put(":id")
  async updateProject(
    @Param("id") id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectsService.updateProject(
      id,
      updateProjectDto,
    );
  }

  // =====================================================
  // DELETE PROJECT
  // =====================================================

  @Delete(":id")
  async deleteProject(
    @Param("id") id: string,
    @Body("userId") userId: string,
  ) {
    return this.projectsService.deleteProject(id, userId);
  }
}
