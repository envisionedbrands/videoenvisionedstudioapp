import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import type { Express, Response } from "express";
import { authStorage } from "./storage";
import { initializeSessionAndPassport } from "./googleAuth";
import { registerUserSchema, loginUserSchema } from "@shared/models/auth";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function setupLocalAuth(app: Express) {
  initializeSessionAndPassport(app);
  
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          const user = await authStorage.getUserByEmail(email.toLowerCase());
          
          if (!user || !user.passwordHash) {
            return done(null, false, { message: "Invalid email or password" });
          }

          const isValid = await comparePassword(password, user.passwordHash);
          if (!isValid) {
            return done(null, false, { message: "Invalid email or password" });
          }

          const sessionUser = {
            claims: {
              sub: user.id,
              email: user.email,
              first_name: user.firstName,
              last_name: user.lastName,
              profile_image_url: user.profileImageUrl,
            },
            expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
          };

          return done(null, sessionUser);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.post("/api/auth/register", async (req, res: Response) => {
    try {
      const parseResult = registerUserSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: parseResult.error.errors.map(e => e.message).join(", ")
        });
      }

      const { email, password, firstName, lastName } = parseResult.data;
      const normalizedEmail = email.toLowerCase();

      const existingUser = await authStorage.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(400).json({ error: "An account with this email already exists" });
      }

      const passwordHash = await hashPassword(password);

      const user = await authStorage.upsertUser({
        email: normalizedEmail,
        passwordHash,
        firstName: firstName || null,
        lastName: lastName || null,
      });

      const sessionUser = {
        claims: {
          sub: user.id,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          profile_image_url: user.profileImageUrl,
        },
        expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
      };

      req.login(sessionUser, (err) => {
        if (err) {
          console.error("Login after registration error:", err);
          return res.status(500).json({ error: "Registration successful but login failed" });
        }
        return res.json({ success: true, user: { email: user.email, firstName: user.firstName } });
      });
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    const parseResult = loginUserSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: parseResult.error.errors.map(e => e.message).join(", ")
      });
    }

    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).json({ error: "Login failed" });
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid email or password" });
      }
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("Session login error:", loginErr);
          return res.status(500).json({ error: "Login failed" });
        }
        return res.json({ success: true });
      });
    })(req, res, next);
  });

  console.log("Local (email/password) authentication configured successfully");
}
