import type { Express } from "express";
import { db } from "../../db";
import { sql } from "drizzle-orm";

export function registerPublicRoutes(app: Express) {
  app.get("/api/public/releases", async (_req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, version_name, version_code, changelog,
               file_name, file_size, download_url, min_android, created_at
        FROM apk_releases
        WHERE is_active = true
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const release = result.rows[0] ?? null;
      res.json({ release });
    } catch (err) {
      console.error("[public/releases] error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/public/releases/all", async (_req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, version_name, version_code, changelog,
               file_name, file_size, download_url, min_android, created_at
        FROM apk_releases
        ORDER BY created_at DESC
        LIMIT 20
      `);
      res.json({ releases: result.rows });
    } catch (err) {
      console.error("[public/releases/all] error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
