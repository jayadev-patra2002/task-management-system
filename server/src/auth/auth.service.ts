import { Injectable, NotFoundException ,BadRequestException, UnauthorizedException} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findOrCreateUser(data: {
    email: string;
    name: string;
    avatar?: string | null;
  }) {
    const existingUser =
      await this.prisma.user.findUnique({
        where: {
          email: data.email,
        },
        include: {
          team: true,
        },
      });

    if (existingUser) {
      const updatedUser =
        await this.prisma.user.update({
          where: {
            id: existingUser.id,
          },
          data: {
            name: data.name,
            avatar:
              data.avatar || null,
          },
          include: {
            team: true,
          },
        });

      return updatedUser;
    }

    const newUser =
      await this.prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
          avatar: data.avatar || null,
          teamId: null,
        },
        include: {
          team: true,
        },
      });

    return newUser;
  }

  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { team: true },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    let isOwner = false;
    let inviteCode = null;

    if (user.team) {
      // Check if the current user is the owner of the team
      isOwner = user.team.ownerId === userId;
      
      // Only expose the invite code to the workspace owner/creator
      if (isOwner) {
        inviteCode = user.team.inviteCode;
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      teamId: user.teamId,
      teamName: user.team?.name || null,
      inviteCode,
      isOwner,
    };
  }

  async createTeam(userId: string, teamName: string) {
    const newTeam = await this.prisma.team.create({
      data: {
        name: teamName,
        ownerId: userId, // 👈 Assigns creator as the owner
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { teamId: newTeam.id },
    });

    return {
      message: "Team created successfully",
      teamId: newTeam.id,
      name: newTeam.name,
      inviteCode: newTeam.inviteCode,
    };
  }

  async joinTeamByInviteCode(userId: string, inviteCode: string) {
    const team = await this.prisma.team.findUnique({
      where: { inviteCode },
    });

    if (!team) {
      throw new NotFoundException("Invalid invite code. Workspace not found.");
    }

    // Link the user to the found team
    await this.prisma.user.update({
      where: { id: userId },
      data: { teamId: team.id },
    });

    // Return a clean response object
    return {
      message: "Joined team successfully",
      teamId: team.id,
      name: team.name,        // Team Name
      inviteCode: team.inviteCode,
    };
  }
  async getTeamMembers(teamId: string) {
    if (!teamId) return [];
    return this.prisma.user.findMany({
      where: { teamId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        title: true,
      },
    });
  }

  async getTeamMembersForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { teamId: true },
    });

    if (!user || !user.teamId) return [];
    
    return this.prisma.user.findMany({
      where: { teamId: user.teamId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        title: true,
      },
    });
  }

  async handleEmailLogin(
    email: string,
  ) {
    return {
      success: true,
      message:
        `Verification instructions sent to ${email}`,
    };
  }

async handleGuestLogin() {
  // =====================================================
  // CREATE UNIQUE GUEST USER DETAILS
  // =====================================================

  const guestId = `guest-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;

  const guestEmail = `${guestId}@guest.local`;

  // =====================================================
  // CREATE GUEST USER
  // =====================================================

  const guestUser = await this.prisma.user.create({
    data: {
      email: guestEmail,
      name: "Dexter",
      avatar: null,
      teamId: null,
    },
  });

  // =====================================================
  // CREATE GUEST WORKSPACE
  // =====================================================

  const guestTeam = await this.prisma.team.create({
    data: {
      name: "Guest Workspace",
      ownerId: guestUser.id,
    },
  });

  // =====================================================
  // ASSIGN USER TO GUEST WORKSPACE
  // =====================================================

  const updatedGuestUser =
    await this.prisma.user.update({
      where: {
        id: guestUser.id,
      },
      data: {
        teamId: guestTeam.id,
      },
      include: {
        team: true,
      },
    });

  // =====================================================
  // CREATE GUEST TOKEN
  // =====================================================

  const payload = JSON.stringify({
    userId: updatedGuestUser.id,
    email: updatedGuestUser.email,
    name: updatedGuestUser.name,
    teamId: updatedGuestUser.teamId,
    teamName:
      updatedGuestUser.team?.name ??
      "Guest Workspace",
    guest: true,
  });

  const token =
    "guest-token-" +
    Buffer.from(payload).toString("base64");

  // =====================================================
  // RETURN COMPLETE SESSION
  // =====================================================

  return {
    success: true,
    message: "Guest session initialized successfully",
    token,
    userId: updatedGuestUser.id,
    email: updatedGuestUser.email,
    name: updatedGuestUser.name,
    avatar: updatedGuestUser.avatar,
    teamId: updatedGuestUser.teamId,
    teamName:
      updatedGuestUser.team?.name ??
      "Guest Workspace",
    isGuest: true,
    isOwner: true,
  };
}
// Inside your AuthService class:

async updateProfile(
  userId: string,
  dto: { name?: string; title?: string; username?: string; email?: string },
) {
  try {
    // Adjust this depending on your database/ORM (e.g., Prisma, TypeORM, Mongoose)
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.username !== undefined && { username: dto.username }),
        ...(dto.email !== undefined && { email: dto.email }),
      },
    });

    return {
      success: true,
      message: "Profile updated successfully",
      name: updatedUser.name,
      email: updatedUser.email,
      title: updatedUser.title || null,
      username: updatedUser.username || null,
    };
  } catch (error) {
    console.error("Update profile error:", error);
    throw new UnauthorizedException("Unable to update profile");
  }
}
  async leaveTeam(userId: string) {
  const user = await this.prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      team: true,
    },
  });

  if (!user) {
    throw new NotFoundException("User not found");
  }

  if (!user.teamId || !user.team) {
    throw new BadRequestException(
      "You are not currently in a workspace.",
    );
  }

  const teamId = user.teamId;
  const team = user.team;

  const isOwner = team.ownerId === userId;

  // Find all other members in the workspace.
  const remainingMembers = await this.prisma.user.findMany({
    where: {
      teamId,
      id: {
        not: userId,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  // =====================================================
  // OWNER LEAVES
  // =====================================================

  if (isOwner) {
    // Other members exist -> transfer ownership.
    if (remainingMembers.length > 0) {
      const newOwner = remainingMembers[0];

      await this.prisma.$transaction([
        this.prisma.team.update({
          where: {
            id: teamId,
          },
          data: {
            ownerId: newOwner.id,
          },
        }),

        this.prisma.user.update({
          where: {
            id: userId,
          },
          data: {
            teamId: null,
          },
        }),
      ]);

      return {
        success: true,
        message: "You left the workspace successfully.",
        ownershipTransferred: true,
        newOwnerId: newOwner.id,
        newOwnerName:
          newOwner.name || newOwner.email,
        teamId,
      };
    }

    // Owner is the only member.
    // Allow leaving and keep workspace/data intact.
    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        teamId: null,
      },
    });

    return {
      success: true,
      message: "You left the workspace successfully.",
      ownershipTransferred: false,
      newOwnerId: null,
      teamId,
    };
  }

  // =====================================================
  // NORMAL MEMBER LEAVES
  // =====================================================

  await this.prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      teamId: null,
    },
  });

  return {
    success: true,
    message: "You left the workspace successfully.",
    ownershipTransferred: false,
    newOwnerId: team.ownerId,
    teamId,
  };
  
}
}