import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import type { Express, RequestHandler } from "express";
import { authStorage } from "./storage";
import { getSession } from "./replitAuth";

let sessionInitialized = false;

export function initializeSessionAndPassport(app: Express) {
  if (sessionInitialized) return;
  
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());
  
  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));
  
  sessionInitialized = true;
  console.log("Session and Passport initialized");
}

export async function setupGoogleAuth(app: Express) {
  initializeSessionAndPassport(app);

  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientID || !clientSecret) {
    console.log("Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL: "/api/auth/google/callback",
        proxy: true,
        passReqToCallback: false,
      } as any,
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase() || null;
          const firstName = profile.name?.givenName || null;
          const lastName = profile.name?.familyName || null;
          const profileImageUrl = profile.photos?.[0]?.value || null;

          const user = await authStorage.upsertUserByEmail({
            id: profile.id,
            email,
            firstName,
            lastName,
            profileImageUrl,
          });

          const sessionUser = {
            claims: {
              sub: user.id,
              email: user.email,
              first_name: user.firstName,
              last_name: user.lastName,
              profile_image_url: user.profileImageUrl,
            },
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          };

          done(null, sessionUser);
        } catch (error) {
          done(error as Error);
        }
      }
    )
  );

  app.get("/api/login/google", (req, res, next) => {
    passport.authenticate("google", {
      scope: ["profile", "email"],
      prompt: "select_account",
    })(req, res, next);
  });

  app.get("/api/auth/google/callback", (req, res, next) => {
    passport.authenticate("google", (err: any, user: any, info: any) => {
      if (err) {
        console.error("Google OAuth error:", err);
        return res.status(500).json({ error: "Authentication failed", details: err.message });
      }
      if (!user) {
        console.error("Google OAuth: No user returned", info);
        return res.redirect("/api/login/google");
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error("Login error:", loginErr);
          return res.status(500).json({ error: "Login failed", details: loginErr.message });
        }
        return res.redirect("/");
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect("/");
    });
  });

  console.log("Google OAuth configured successfully");
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user?.claims?.sub) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  return next();
};
