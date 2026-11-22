import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import {fileURLToPath} from 'url';
import {GoogleGenAI} from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

interface HistoryTurn {
  role: 'user' | 'model';
  text: string;
}

interface AssistantRequestBody {
  message?: unknown;
  history?: unknown;
  location?: {
    lat?: unknown;
    lng?: unknown;
    insideIndia?: unknown;
  };
}

const SYSTEM_INSTRUCTION = `You are CycloneSafe AI Assistant, a calm, practical disaster preparedness and emergency safety assistant tailored for India.

Guidelines:
1. Give concise, actionable, step-by-step safety guidance for cyclones, floods, earthquakes, fires, landslides, heatwaves, first aid, and emergency kits aligned with NDMA (National Disaster Management Authority) and IMD practices.
2. When someone appears to be in immediate danger or requests emergency help, remind them clearly to call India's national emergency number 112 (or 108 for ambulance, 101 for fire, 1078 for disaster helpline) and use the SOS screen immediately.
3. Never invent real-time weather telemetry, shelter operational statuses, or official cyclone warnings — instruct users to check the live Open-Meteo Weather screen, Google Places map, and official IMD/NDMA bulletins.
4. Keep answers scannable with short bullet points under ~180 words unless the user asks for detailed steps.`;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({limit: '1mb'}));

  app.get('/api/health', (_req, res) => {
    res.json({status: 'ok', service: 'CycloneSafe'});
  });

  app.post('/api/assistant', async (req, res) => {
    const body = (req.body || {}) as AssistantRequestBody;
    const rawMessage = typeof body.message === 'string' ? body.message.trim() : '';

    if (!rawMessage) {
      res.status(400).json({error: 'Message is required.'});
      return;
    }
    if (rawMessage.length > 2000) {
      res.status(400).json({error: 'Message must be 2000 characters or fewer.'});
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured in server environment secrets. Add it in Settings > Secrets to enable CycloneSafe AI Assistant.',
      });
      return;
    }

    const cleanHistory: Array<{role: 'user' | 'model'; parts: Array<{text: string}>}> =
      [];
    if (Array.isArray(body.history)) {
      for (const item of body.history.slice(-10)) {
        if (
          item &&
          typeof item === 'object' &&
          'role' in item &&
          'text' in item &&
          (item.role === 'user' || item.role === 'model') &&
          typeof item.text === 'string' &&
          item.text.trim()
        ) {
          cleanHistory.push({
            role: item.role,
            parts: [{text: item.text.trim().slice(0, 2000)}],
          });
        }
      }
    }

    let contextPrefix = '';
    if (body.location && typeof body.location === 'object') {
      const lat =
        typeof body.location.lat === 'number' && Number.isFinite(body.location.lat)
          ? body.location.lat
          : null;
      const lng =
        typeof body.location.lng === 'number' && Number.isFinite(body.location.lng)
          ? body.location.lng
          : null;
      const insideIndia =
        typeof body.location.insideIndia === 'boolean'
          ? body.location.insideIndia
          : null;

      if (lat !== null && lng !== null) {
        contextPrefix = `[Context: User GPS coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)}), region: ${
          insideIndia === false ? 'Outside India' : 'India'
        }]\n\n`;
      }
    }

    try {
      const chat = ai.chats.create({
        model: MODEL_NAME,
        history: cleanHistory as Array<{
          role: HistoryTurn['role'];
          parts: Array<{text: string}>;
        }>,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });

      const response = await chat.sendMessage({
        message: `${contextPrefix}${rawMessage}`,
      });

      const reply = response.text?.trim();
      if (!reply) {
        res.status(502).json({
          error: 'Assistant returned an empty response. Please try again.',
        });
        return;
      }

      res.json({reply});
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to reach Gemini API.';
      const status =
        msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')
          ? 429
          : msg.includes('403') || msg.includes('PERMISSION_DENIED')
            ? 403
            : 502;
      res.status(status).json({error: msg});
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CycloneSafe server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
