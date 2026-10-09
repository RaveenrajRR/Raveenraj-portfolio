
import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA = path.join(__dirname, 'data.json');
const MESSAGES = path.join(__dirname, 'messages.json');

const app = express();
const PORT = process.env.PORT || 5000;

// ==================================================
// CORS CONFIGURATION
// ==================================================

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://raveenraj-portfolio-17ie.vercel.app',
  ...(process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(Boolean)
];

function isAllowedOrigin(origin) {
  if (!origin) return true;

  const normalizedOrigin = origin.replace(/\/$/, '');

  if (allowedOrigins.includes(normalizedOrigin)) {
    return true;
  }

  // Allow this portfolio's Vercel preview deployments.
  return /^https:\/\/raveenraj-portfolio-17ie(?:-[a-z0-9-]+)?\.vercel\.app$/.test(
    normalizedOrigin
  );
}

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
}));

app.use(express.json({ limit: '1mb' }));

// ==================================================
// HELPERS
// ==================================================

const makeId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;

function cleanText(value, max = 3000) {
  return typeof value === 'string'
    ? value.trim().slice(0, max)
    : '';
}

function serverError(res, message, error) {
  console.error(message, error);
  return res.status(500).json({ error: message });
}

async function readData() {
  const raw = await fs.readFile(DATA, 'utf8');
  const data = JSON.parse(raw);

  return {
    ...data,
    profile: data.profile || {},
    skills: Array.isArray(data.skills) ? data.skills : [],
    projects: Array.isArray(data.projects) ? data.projects : []
  };
}

async function writeData(data) {
  await fs.writeFile(
    DATA,
    JSON.stringify(data, null, 2),
    'utf8'
  );
}

async function readMessages() {
  try {
    const raw = await fs.readFile(MESSAGES, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeMessages(messages) {
  await fs.writeFile(
    MESSAGES,
    JSON.stringify(messages, null, 2),
    'utf8'
  );
}

// ==================================================
// HEALTH CHECK
// ==================================================

app.get('/api/health', (_req, res) => {
  res.set('Cache-Control', 'no-store');

  res.json({
    ok: true,
    service: 'Raveenraj Portfolio API',
    timestamp: new Date().toISOString()
  });
});

// ==================================================
// GET FULL PORTFOLIO
// ==================================================

app.get('/api/portfolio', async (_req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await readData());
  } catch (error) {
    serverError(res, 'Unable to read portfolio data.', error);
  }
});

// ==================================================
// SKILLS
// ==================================================

app.get('/api/skills', async (req, res) => {
  try {
    const data = await readData();
    let items = data.skills;

    const category = cleanText(req.query.category, 100) || 'All';
    const q = cleanText(req.query.q, 200).toLowerCase();

    if (category !== 'All') {
      items = items.filter(item => item.category === category);
    }

    if (q) {
      items = items.filter(item =>
        `${item.name || ''} ${item.category || ''} ${item.description || ''}`
          .toLowerCase()
          .includes(q)
      );
    }

    res.set('Cache-Control', 'no-store');
    res.json(items);
  } catch (error) {
    serverError(res, 'Unable to read skills.', error);
  }
});

// ==================================================
// PROJECTS
// ==================================================

app.get('/api/projects', async (req, res) => {
  try {
    const data = await readData();
    let items = data.projects;

    for (const field of ['type', 'level', 'scope']) {
      const value = cleanText(req.query[field], 100);

      if (value && value !== 'All') {
        items = items.filter(item => item[field] === value);
      }
    }

    const q = cleanText(req.query.q, 200).toLowerCase();

    if (q) {
      items = items.filter(item => {
        const stack = Array.isArray(item.stack)
          ? item.stack.join(' ')
          : '';

        return `${item.name || ''} ${item.description || ''} ${stack}`
          .toLowerCase()
          .includes(q);
      });
    }

    res.set('Cache-Control', 'no-store');
    res.json(items);
  } catch (error) {
    serverError(res, 'Unable to read projects.', error);
  }
});

// ==================================================
// CONTACT FORM
// ==================================================

app.post('/api/contact', async (req, res) => {
  const name = cleanText(req.body?.name, 100);
  const email = cleanText(req.body?.email, 200);
  const message = cleanText(req.body?.message, 3000);

  if (!name || !email || !message) {
    return res.status(400).json({
      error: 'Name, email and message are required.'
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      error: 'Please enter a valid email.'
    });
  }

  try {
    const messages = await readMessages();

    messages.push({
      id: makeId(),
      name,
      email,
      message,
      createdAt: new Date().toISOString()
    });

    await writeMessages(messages);

    return res.status(201).json({
      ok: true,
      message: 'Message saved. Thanks for reaching out!'
    });
  } catch (error) {
    return serverError(res, 'Could not save message.', error);
  }
});

// ==================================================
// ADMIN: UPDATE PROFILE
// ==================================================

app.put('/api/admin/profile', async (req, res) => {
  try {
    const data = await readData();

    data.profile = {
      ...data.profile,
      ...(req.body || {})
    };

    await writeData(data);
    res.json(data.profile);
  } catch (error) {
    serverError(res, 'Could not update profile.', error);
  }
});

// ==================================================
// ADMIN: ADD SKILL
// ==================================================

app.post('/api/admin/skills', async (req, res) => {
  try {
    const data = await readData();

    const item = {
      ...(req.body || {}),
      id: makeId()
    };

    item.name = cleanText(item.name, 150);
    item.category = cleanText(item.category, 100);

    if (!item.name || !item.category) {
      return res.status(400).json({
        error: 'Skill name and category are required.'
      });
    }

    data.skills.push(item);
    await writeData(data);

    res.status(201).json(item);
  } catch (error) {
    serverError(res, 'Could not add skill.', error);
  }
});

// ==================================================
// ADMIN: UPDATE SKILL
// ==================================================

app.put('/api/admin/skills/:id', async (req, res) => {
  try {
    const data = await readData();

    const index = data.skills.findIndex(
      item => item.id === req.params.id
    );

    if (index < 0) {
      return res.status(404).json({
        error: 'Skill not found.'
      });
    }

    data.skills[index] = {
      ...data.skills[index],
      ...(req.body || {}),
      id: data.skills[index].id
    };

    await writeData(data);
    res.json(data.skills[index]);
  } catch (error) {
    serverError(res, 'Could not update skill.', error);
  }
});

// ==================================================
// ADMIN: DELETE SKILL
// ==================================================

app.delete('/api/admin/skills/:id', async (req, res) => {
  try {
    const data = await readData();

    data.skills = data.skills.filter(
      item => item.id !== req.params.id
    );

    await writeData(data);
    res.json({ ok: true });
  } catch (error) {
    serverError(res, 'Could not delete skill.', error);
  }
});

// ==================================================
// ADMIN: ADD PROJECT
// ==================================================

app.post('/api/admin/projects', async (req, res) => {
  try {
    const data = await readData();
    const body = req.body || {};
    const name = cleanText(body.name, 200);

    if (!name) {
      return res.status(400).json({
        error: 'Project name is required.'
      });
    }

    const item = {
      ...body,
      id: makeId(),
      name,
      stack: Array.isArray(body.stack) ? body.stack : []
    };

    data.projects.push(item);
    await writeData(data);

    res.status(201).json(item);
  } catch (error) {
    serverError(res, 'Could not add project.', error);
  }
});

// ==================================================
// ADMIN: UPDATE PROJECT
// ==================================================

app.put('/api/admin/projects/:id', async (req, res) => {
  try {
    const data = await readData();

    const index = data.projects.findIndex(
      item => item.id === req.params.id
    );

    if (index < 0) {
      return res.status(404).json({
        error: 'Project not found.'
      });
    }

    const existing = data.projects[index];

    data.projects[index] = {
      ...existing,
      ...(req.body || {}),
      id: existing.id,
      stack: Array.isArray(req.body?.stack)
        ? req.body.stack
        : existing.stack
    };

    await writeData(data);
    res.json(data.projects[index]);
  } catch (error) {
    serverError(res, 'Could not update project.', error);
  }
});

// ==================================================
// ADMIN: DELETE PROJECT
// ==================================================

app.delete('/api/admin/projects/:id', async (req, res) => {
  try {
    const data = await readData();

    data.projects = data.projects.filter(
      item => item.id !== req.params.id
    );

    await writeData(data);
    res.json({ ok: true });
  } catch (error) {
    serverError(res, 'Could not delete project.', error);
  }
});

// ==================================================
// UNKNOWN API ROUTE
// ==================================================

app.use('/api', (_req, res) => {
  res.status(404).json({
    error: 'API route not found.'
  });
});

// ==================================================
// ERROR HANDLER
// ==================================================

app.use((error, _req, res, _next) => {
  console.error('Request error:', error.message);

  if (error.message === 'Origin not allowed by CORS') {
    return res.status(403).json({
      error: 'This website origin is not allowed.'
    });
  }

  return res.status(500).json({
    error: 'Internal server error.'
  });
});

// ==================================================
// START SERVER
// ==================================================

app.listen(PORT, () => {
  console.log(`Portfolio API running on port ${PORT}`);
});

