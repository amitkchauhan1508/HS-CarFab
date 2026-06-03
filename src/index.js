import express from 'express';
import { config } from './config.js';
import { processDeal } from './processor.js';
import { closeBrowser } from './render.js';

const app = express();
// Parse JSON regardless of Content-Type (HubSpot's webhook action may not set
// application/json). Capture the raw bytes so we can inspect odd payloads.
app.use(express.json({
  limit: '1mb',
  type: () => true,
  verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8'); },
}));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/webhooks/deal-stage', async (req, res) => {
  if (config.webhookToken && req.query.token !== config.webhookToken) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const dealId = extractDealId(req.body);
  if (!dealId) {
    console.log('No deal id. content-type:', req.headers['content-type'],
      '| parsed body:', JSON.stringify(req.body), '| raw:', req.rawBody);
    return res.status(400).json({ error: 'no deal id in payload' });
  }

  // Process synchronously: serverless platforms (Cloud Run, Lambda) freeze/throttle
  // CPU after the response is sent, so background work would never finish.
  // The idempotency property guards against duplicate work if HubSpot retries.
  await processDeal(String(dealId));
  res.status(200).json({ ok: true, dealId });
});

function extractDealId(body) {
  if (!body) return null;
  // App webhook subscriptions deliver an array of events.
  if (Array.isArray(body)) return body[0]?.objectId ?? null;
  // Workflow webhook actions deliver the enrolled object.
  return body.objectId ?? body.dealId ?? body.properties?.hs_object_id ?? body.hs_object_id ?? null;
}

const server = app.listen(config.port, () => {
  console.log(`eBook PDF service listening on :${config.port}`);
});

async function shutdown() {
  console.log('Shutting down...');
  server.close();
  await closeBrowser();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
