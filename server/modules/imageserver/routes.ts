import type { Express } from "express";
import { z } from "zod";
import ImageKit from "imagekit";
import { storage } from "../../storage";

const IMAGEKIT_CONFIGURED =
  !!process.env.IMAGEKIT_PUBLIC_KEY &&
  !!process.env.IMAGEKIT_PRIVATE_KEY &&
  !!process.env.IMAGEKIT_URL_ENDPOINT &&
  !process.env.IMAGEKIT_PUBLIC_KEY.includes("xxxx") &&
  !process.env.IMAGEKIT_URL_ENDPOINT.includes("your_imagekit_id");

const imagekit = IMAGEKIT_CONFIGURED
  ? new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
    })
  : null;

// Mirrors com/projectgoth/fusion/imageserver/
// ImageServer.java: main image server
// ImageCache.java: caches image data (key, data, mimeType)
// ImageItem.java: image item with id, key, mimeType, size, content
// Connection.java: HTTP/S connection to image server
// ConnectionPurger.java: purges stale connections
// ImageServerAdminI.java: admin interface for purge, stats

export function registerImageServerRoutes(app: Express) {

  // ── POST /api/imageserver/upload ──────────────────────────────────────────────
  // Upload an image to ImageKit CDN (mirrors ImageServer store)
  // Body: { username, imageKey, mimeType, base64Data, description? }
  app.post("/api/imageserver/upload", async (req, res) => {
    const schema = z.object({
      username: z.string().min(1),
      imageKey: z.string().min(1),
      mimeType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]).default("image/jpeg"),
      base64Data: z.string().min(1),
      description: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { username, imageKey, mimeType, base64Data } = parsed.data;

    const sizeInBytes = Math.round(base64Data.length * 0.75);
    if (sizeInBytes > 10 * 1024 * 1024) {
      return res.status(413).json({ error: "Image too large. Max 10MB." });
    }

    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
    };
    const ext = extMap[mimeType] ?? "jpg";
    const folder = imageKey.startsWith("avatar_") ? "/migme/avatar" : "/migme/feed";
    const fileName = `${imageKey}.${ext}`;

    if (!imagekit) {
      return res.status(503).json({
        error: "ImageKit belum dikonfigurasi di server. Set environment variable IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, dan IMAGEKIT_URL_ENDPOINT.",
      });
    }

    try {
      const result = await imagekit.upload({
        file: base64Data,
        fileName,
        folder,
        useUniqueFileName: true,
      });
      res.status(201).json({ success: true, imageId: result.fileId, imageKey: result.name, url: result.url });
    } catch (e: any) {
      console.error("[imageserver] ImageKit upload error:", e?.message ?? e);
      res.status(500).json({ error: e.message ?? "ImageKit upload failed" });
    }
  });

  app.get("/api/imageserver/image/:id", async (req, res) => {
    const imageId = req.params.id;

    try {
      const localImage = await storage.getImageById(imageId);
      if (localImage) {
        return res.json({
          id: localImage.id,
          imageKey: localImage.imageKey,
          username: localImage.username,
          mimeType: localImage.mimeType,
          sizeBytes: localImage.sizeBytes,
          description: localImage.description,
          url: `/api/imageserver/image/${localImage.id}/data`,
          createdAt: localImage.createdAt,
        });
      }

      if (imagekit) {
        const file = await imagekit.getFileDetails(imageId) as any;
        if (file?.url) {
          return res.json({
            id: imageId,
            imageKey: file.name ?? imageId,
            mimeType: file.fileType ? `image/${file.fileType}` : "image/jpeg",
            sizeBytes: file.size ?? 0,
            url: file.url,
            createdAt: file.createdAt,
          });
        }
      }

      return res.status(404).json({ error: "Image not found" });
    } catch {
      return res.status(404).json({ error: "Image not found" });
    }
  });

  app.get("/api/imageserver/image/:id/data", async (req, res) => {
    const imageId = req.params.id;

    try {
      const localImage = await storage.getImageById(imageId);
      if (localImage) {
        const base64 = localImage.base64Data.includes(",")
          ? localImage.base64Data.split(",").pop()!
          : localImage.base64Data;
        const buffer = Buffer.from(base64, "base64");

        res.setHeader("Content-Type", localImage.mimeType);
        res.setHeader("Content-Length", buffer.length.toString());
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return res.end(buffer);
      }

      if (imagekit) {
        const file = await imagekit.getFileDetails(imageId) as any;
        if (file?.url) return res.redirect(302, file.url);
      }

      return res.status(404).json({ error: "Image not found" });
    } catch {
      return res.status(404).json({ error: "Image not found" });
    }
  });

  // ── GET /api/imagekit/auth ────────────────────────────────────────────────────
  // Returns ImageKit authentication parameters for client-side use
  app.get("/api/imagekit/auth", (_req, res) => {
    if (!imagekit) {
      return res.status(503).json({
        error: "ImageKit belum dikonfigurasi di server.",
      });
    }
    try {
      const result = imagekit.getAuthenticationParameters();
      res.json({
        ...result,
        publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
        urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
