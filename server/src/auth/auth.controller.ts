import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";

import { AuthGuard } from "@nestjs/passport";
import { Request, Response } from "express";

import { AuthService } from "./auth.service";
import { GoogleAuthGuard } from "./google-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  // =====================================================
  // AUTH TOKEN HELPER
  // =====================================================
private getUserIdFromReq(req: Request): string {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedException("No token provided");
  }

  const token = authHeader
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) {
    throw new UnauthorizedException("Invalid token");
  }

  try {
    console.log("[AUTH] Token prefix:", token.slice(0, 30));

    let base64Part: string;

    if (token.startsWith("google-token-")) {
      base64Part = token.slice("google-token-".length);
    } else if (token.startsWith("guest-token-")) {
      base64Part = token.slice("guest-token-".length);
    } else {
      console.error(
        "[AUTH] Unsupported token prefix:",
        token.slice(0, 50),
      );

      throw new UnauthorizedException(
        "Unsupported token",
      );
    }

    base64Part = base64Part.trim();

    if (!base64Part) {
      throw new UnauthorizedException(
        "Token payload is empty",
      );
    }

    const decodedString = Buffer.from(
      base64Part,
      "base64",
    ).toString("utf8");

    console.log(
      "[AUTH] Decoded token:",
      decodedString,
    );

    const parsed: unknown =
      JSON.parse(decodedString);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("userId" in parsed)
    ) {
      throw new UnauthorizedException(
        "Token does not contain userId",
      );
    }

    const userId =
      (parsed as { userId?: unknown }).userId;

    if (
      typeof userId !== "string" ||
      !userId.trim()
    ) {
      throw new UnauthorizedException(
        "Invalid userId in token",
      );
    }

    return userId;
  } catch (error) {
    console.error(
      "[AUTH] Token decode error:",
      error,
    );

    if (error instanceof UnauthorizedException) {
      throw error;
    }

    throw new UnauthorizedException(
      "Invalid token",
    );
  }
}

  // =====================================================
  // GUEST LOGIN
  // =====================================================

  @Post("guest")
  async guestLogin() {
    return this.authService.handleGuestLogin();
  }

  // =====================================================
  // GOOGLE LOGIN
  // =====================================================

  @Get("google")
  @UseGuards(GoogleAuthGuard)
  async googleAuth(@Req() req: Request) {
    // Google OAuth starts here.
  }

  // =====================================================
  // GOOGLE CALLBACK
  // =====================================================

  @Get("google/callback")
  @UseGuards(AuthGuard("google"))
  async googleAuthRedirect(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = req.user as any;

    if (!user) {
      return res.redirect(
        "http://localhost:3000/?error=auth_failed",
      );
    }

    const payload = JSON.stringify({
      userId: user.id,
      email: user.email,
      picture: user.avatar || user.picture,
      name: user.name,
      teamId: user.teamId || null,
    });

    const token =
      "google-token-" +
      Buffer.from(payload).toString("base64");

    return res.redirect(
      `http://localhost:3000/?token=${encodeURIComponent(
        token,
      )}`,
    );
  }

  // =====================================================
  // PROFILE
  // =====================================================

  @Get("profile")
  async getProfile(@Req() req: Request) {
    try {
      const userId =
        this.getUserIdFromReq(req);

      const userProfile =
        await this.authService.getUserProfile(
          userId,
        );

      return {
        userId: userProfile.id,
        email: userProfile.email,
        name: userProfile.name,
        avatar: userProfile.avatar || null,
        teamId: userProfile.teamId || null,
        teamName:
          userProfile.teamName || null,
        inviteCode:
          userProfile.inviteCode || null,
        isOwner:
          userProfile.isOwner || false,
      };
    } catch (error) {
      console.error(
        "Profile fetch error:",
        error,
      );

      return {
        error:
          "Invalid token or unauthorized",
      };
    }
  }
  @Patch("profile")
  async updateProfile(
    @Req() req: Request,
    @Body() body: { name?: string; title?: string; username?: string; email?: string },
  ) {
    const userId = this.getUserIdFromReq(req);
    return this.authService.updateProfile(userId, body);
  }

  // =====================================================
  // WORKSPACE CREATE
  // =====================================================

  @Post("team/create")
  async createTeam(
    @Req() req: Request,
    @Body("name") name: string,
  ) {
    const userId =
      this.getUserIdFromReq(req);

    return this.authService.createTeam(
      userId,
      name,
    );
  }

  // =====================================================
  // WORKSPACE JOIN
  // =====================================================

  @Post("team/join")
  async joinTeam(
    @Req() req: Request,
    @Body("inviteCode") inviteCode: string,
  ) {
    const userId =
      this.getUserIdFromReq(req);

    return this.authService.joinTeamByInviteCode(
      userId,
      inviteCode,
    );
  }

  // =====================================================
  // WORKSPACE MEMBERS
  // =====================================================

  @Get("team/members")
  async getTeamMembers(
    @Req() req: Request,
  ) {
    const userId =
      this.getUserIdFromReq(req);

    return this.authService.getTeamMembersForUser(
      userId,
    );
  }

  // =====================================================
  // LEAVE WORKSPACE
  // =====================================================

  @Post("team/leave")
  async leaveTeam(
    @Req() req: Request,
  ) {
    const userId =
      this.getUserIdFromReq(req);

    return this.authService.leaveTeam(
      userId,
    );
  }
}