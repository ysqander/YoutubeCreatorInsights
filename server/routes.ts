import { Express } from "express";
import { setupAuth } from "./auth";
import { setupYouTubeRoutes } from "./youtube";

export function registerRoutes(app: Express) {
  setupAuth(app);
  setupYouTubeRoutes(app);
}
