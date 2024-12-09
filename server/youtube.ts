import { Express } from "express";
import { google } from "googleapis";
import { db } from "../db";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";

// Get the callback URL from environment or construct it
const CALLBACK_URL = process.env.YOUTUBE_CALLBACK_URL || 
  `${process.env.REPL_SLUG ? 
    `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : 
    'http://localhost:5000'}/api/youtube/callback`;

console.log('Initializing YouTube OAuth with callback URL:', CALLBACK_URL);

// Verify credentials are properly loaded
if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET) {
  console.error('Missing YouTube OAuth credentials');
}

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  CALLBACK_URL
);

const youtube = google.youtube({
  version: 'v3',
  auth: oauth2Client
});

// Initialize with minimum required scopes
const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl'
];

export function setupYouTubeRoutes(app: Express) {
  app.get("/api/youtube/auth", (req, res) => {
    if (!req.user) {
      console.error('User not authenticated for YouTube auth');
      return res.status(401).send("Please log in first");
    }

    try {
      console.log('Starting YouTube auth process for user:', req.user.id);
      const state = Math.random().toString(36).substring(7);
      
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: YOUTUBE_SCOPES,
        prompt: 'consent',
        include_granted_scopes: true,
        state: state
      });

      console.log('Generated auth URL:', authUrl);
      console.log('Using callback URL:', CALLBACK_URL);
      res.redirect(authUrl);
    } catch (error: any) {
      console.error('Error generating auth URL:', error);
      console.error('Error details:', error.message);
      console.error('Current callback URL:', CALLBACK_URL);
      res.redirect('/?error=youtube_auth_failed');
    }
  });

  app.get("/api/youtube/callback", async (req, res) => {
    if (!req.user) {
      console.error('User not authenticated in callback');
      return res.redirect('/?error=not_authenticated');
    }

    try {
      const { code, error, state } = req.query;

      if (error) {
        console.error('OAuth error:', error);
        return res.redirect('/?error=youtube_auth_failed');
      }

      if (!code) {
        console.error('No authorization code received');
        return res.redirect('/?error=no_auth_code');
      }

      console.log('Attempting to exchange code for tokens...');
      const { tokens } = await oauth2Client.getToken(code as string);
      
      if (!tokens.access_token) {
        console.error('No access token received');
        return res.redirect('/?error=no_access_token');
      }

      console.log('Successfully received tokens, updating user...');
      await db
        .update(users)
        .set({
          youtubeToken: tokens.access_token,
          youtubeRefreshToken: tokens.refresh_token,
          channelId: null, // Reset channel ID as we'll fetch it with the new token
        })
        .where(eq(users.id, req.user.id));

      console.log('User updated successfully');
      res.redirect('/?youtube=connected');
    } catch (error: any) {
      console.error('YouTube OAuth error:', error);
      console.error('Error details:', error.response?.data || error.message);
      res.redirect(`/?error=youtube_token_failed&message=${encodeURIComponent(error.message || 'Unknown error')}`);
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
      console.error('Error fetching channel data:', error);
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

      const videoIds = response.data.items?.map(item => item.id?.videoId).filter(Boolean) as string[];
      
      if (videoIds.length === 0) {
        return res.json([]);
      }

      const statsResponse = await youtube.videos.list({
        auth: oauth2Client,
        part: ['statistics'],
        id: videoIds,
      });

      const videos = response.data.items?.map((item, index) => {
        const stats = statsResponse.data.items?.[index]?.statistics;
        return {
          id: item.id?.videoId,
          title: item.snippet?.title,
          description: item.snippet?.description,
          thumbnailUrl: item.snippet?.thumbnails?.high?.url,
          publishedAt: item.snippet?.publishedAt,
          stats: {
            views: Number(stats?.viewCount || 0),
            likes: Number(stats?.likeCount || 0),
            comments: Number(stats?.commentCount || 0),
          },
        };
      });

      res.json(videos);
    } catch (error) {
      console.error('Error fetching videos:', error);
      res.status(500).send("Failed to fetch videos");
    }
  });
}
