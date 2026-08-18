import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";

@Controller("teams")
export class TeamsController {
  @Post("create")
  @HttpCode(HttpStatus.CREATED)
  async createTeam(
    @Body() body: { name: string },
    @Headers("authorization") authHeader: string,
  ) {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing or invalid token");
    }

    const token = authHeader.split(" ")[1];

    if (!body || !body.name) {
      throw new BadRequestException("Team name is required");
    }

    // TODO: Add your database logic to create the team and associate it with the user
    // Example response structure:
    const teamId = "team_" + Date.now();

    return {
      message: "Team created successfully",
      teamId: teamId,
      name: body.name,
    };
  }

  @Post("join")
  @HttpCode(HttpStatus.OK)
  async joinTeam(
    @Body() body: { inviteCode: string },
    @Headers("authorization") authHeader: string,
  ) {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing or invalid token");
    }

    if (!body || !body.inviteCode) {
      throw new BadRequestException("Invite code is required");
    }

    // TODO: Add your database logic to join the team
    return {
      message: "Joined team successfully",
      teamId: "team_joined_id",
      name: "Joined Team",
    };
  }
}