import { Express } from "express";
import { google } from "googleapis";
import { db } from "../db";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  `${process.env.REPLIT_DOMAINS?.split(',')[0]}/api/youtube/callback`
);

const youtube = google.youtube('v3');

export function setupYouTubeRoutes(app: Express) {
  app.get("/api/youtube/auth", (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/youtube.readonly']
    });

    res.redirect(authUrl);
  });

  app.get("/api/youtube/callback", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const { code } = req.query;
      const { tokens } = await oauth2Client.getToken(code as string);

      await db
        .update(users)
        .set({
          youtubeToken: tokens.access_token,
          youtubeRefreshToken: tokens.refresh_token,
        })
        .where(eq(users.id, req.user.id));

      res.redirect('/');
    } catch (error) {
      res.status(500).send("Failed to authenticate with YouTube");
    }
  });

  app.get("/api/youtube/channel", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.user.id))
        .limit(1);

      if (!user.youtubeToken) {
        return res.status(401).send("YouTube not connected");
      }

      oauth2Client.setCredentials({
        access_token: user.youtubeToken,
        refresh_token: user.youtubeRefreshToken,
      });

      const response = await youtube.channels.list({
        auth: oauth2Client,
        part: ['statistics'],
        mine: true,
      });

      const channel = response.data.items?.[0];
      if (!channel) {
        return res.status(404).send("Channel not found");
      }

      res.json(channel.statistics);
    } catch (error) {
      res.status(500).send("Failed to fetch channel data");
    }
  });

  app.get("/api/youtube/videos", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.user.id))
        .limit(1);

      if (!user.youtubeToken) {
        return res.status(401).send("YouTube not connected");
      }

      oauth2Client.setCredentials({
        access_token: user.youtubeToken,
        refresh_token: user.youtubeRefreshToken,
      });

      const response = await youtube.search.list({
        auth: oauth2Client,
        part: ['snippet'],
        forMine: true,
        type: ['video'],
        maxResults: 9,
        order: 'date',
      });

      const videoIds = response.data.items?.map(item => item.id?.videoId) || [];
      
      const statsResponse = await youtube.videos.list({
        auth: oauth2Client,
        part: ['statistics'],
        id: videoIds,
      });

      const videos = response.data.items?.map((item, index) => ({
        id: item.id?.videoId,
        title: item.snippet?.title,
        description: item.snippet?.description,
        thumbnailUrl: item.snippet?.thumbnails?.high?.url,
        publishedAt: item.snippet?.publishedAt,
        stats: statsResponse.data.items?.[index]?.statistics,
      }));

      res.json(videos);
    } catch (error) {
      res.status(500).send("Failed to fetch videos");
    }
  });
}
