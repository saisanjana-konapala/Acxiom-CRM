import { clerkClient, getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db, userProfilesTable } from "@workspace/db";
import { seedDemoData } from "../lib/crmSeed";

declare global {
  namespace Express {
    interface Request {
      crmUser?: typeof userProfilesTable.$inferSelect;
    }
  }
}

export async function ensureCrmUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = getAuth(req);
    const clerkUserId = auth.userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Sign in to access AcxiomCRM." });
      return;
    }

    let [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkUserId, clerkUserId))
      .limit(1);
    let newlyLinked = false;

    if (!profile) {
      const identity = await clerkClient.users.getUser(clerkUserId);
      const email = identity.primaryEmailAddress?.emailAddress?.trim().toLowerCase();
      if (!email) {
        res.status(403).json({ error: "Your account needs a verified email address." });
        return;
      }

      const [preassigned] = await db
        .select()
        .from(userProfilesTable)
        .where(eq(userProfilesTable.email, email))
        .limit(1);

      if (preassigned) {
        [profile] = await db
          .update(userProfilesTable)
          .set({
            clerkUserId,
            name: identity.fullName || preassigned.name,
            email,
            updatedAt: new Date(),
          })
          .where(eq(userProfilesTable.id, preassigned.id))
          .returning();
      } else {
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(userProfilesTable);
        const role = Number(count) === 0 ? "Admin" : "SalesExecutive";
        [profile] = await db
          .insert(userProfilesTable)
          .values({
            clerkUserId,
            name: identity.fullName || identity.firstName || email,
            email,
            role,
            isActive: true,
          })
          .returning();
      }
      newlyLinked = true;
    }

    if (!profile) {
      res.status(500).json({ error: "Could not load your CRM profile." });
      return;
    }
    if (!profile.isActive) {
      res.status(403).json({ error: "Your CRM account is inactive. Contact an administrator." });
      return;
    }
    if (newlyLinked) await seedDemoData(profile);
    req.crmUser = profile;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.crmUser || !roles.includes(req.crmUser.role)) {
      res.status(403).json({ error: "You do not have permission to perform this action." });
      return;
    }
    next();
  };
}
