import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import {
  Strategy,
  VerifyCallback,
} from "passport-google-oauth20";

import { AuthService } from "./auth.service";

@Injectable()
export class GoogleStrategy extends PassportStrategy(
  Strategy,
  "google",
) {
 constructor(
  private readonly configService: ConfigService,
  private readonly authService: AuthService,
) {
  const clientID =
    configService.get<string>(
      "GOOGLE_CLIENT_ID",
    );

  const clientSecret =
    configService.get<string>(
      "GOOGLE_CLIENT_SECRET",
    );

  const callbackURL =
    configService.get<string>(
      "GOOGLE_CALLBACK_URL",
    );

  if (!clientID) {
    throw new Error(
      "GOOGLE_CLIENT_ID is missing from .env",
    );
  }

  if (!clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_SECRET is missing from .env",
    );
  }

  if (!callbackURL) {
    throw new Error(
      "GOOGLE_CALLBACK_URL is missing from .env",
    );
  }

  super({
    clientID,
    clientSecret,
    callbackURL,

    scope: ["email", "profile"],

    // IMPORTANT
    
  });

  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<void> {
    console.log(
      "GOOGLE PROFILE RECEIVED:",
      JSON.stringify(profile, null, 2),
    );

    const { name, emails, photos } = profile;

    const email =
      emails?.[0]?.value || "";

    const picture =
      photos?.[0]?.value || null;

    const firstName =
      name?.givenName || "";

    const lastName =
      name?.familyName || "";

    const fullName =
      `${firstName} ${lastName}`.trim();

    try {
      const dbUser =
        await this.authService.findOrCreateUser({
          email,
          name:
            fullName ||
            email.split("@")[0],
          avatar: picture,
        });

      console.log(
        "DATABASE USER:",
        dbUser,
      );

      done(null, {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        avatar: dbUser.avatar,
        picture: dbUser.avatar,
        firstName,
        lastName,
        accessToken,
      });
    } catch (error) {
      console.error(
        "Failed to create/find user:",
        error,
      );

      done(error, false);
    }
  }
}