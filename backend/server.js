
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

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://raveenraj-portfolio-17ie.vercel.app'
   ,'https://raveenraj-portfolio-17ie-1zsttkful-raveenrajrrs-projects.vercel.app',
  ...(process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(Boolean)
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin.replace(/\/$/, ''))) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
}));

app.use(express.json({ limit: '1mb' }));

const makeId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;

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
  await fs.writeFile(DATA, JSON.stringify(data, null, 2), 'utf8');
}

function serverError(res, message, error) {
  console.error(message, error);
  return res.status(500).json({ error: message });
}

function cleanText(value, max = 3000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'Raveenraj Portfolio API'
  });
});

// Full portfolio
app.get('/api/portfolio', async (_req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await readData());
  } catch (error) {
    serverError(res, 'Unable to read portfolio data.', error);
  }
});

// Skills
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

// Projects
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

// Contact form
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
    let messages = [];

    try {
      const raw = await fs.readFile(MESSAGES, 'utf8');
      const parsed = JSON.parse(raw);
      messages = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) {
        throw error;
      }
    }

    messages.push({
      id: makeId(),
      name,
      email,
      message,
      createdAt: new Date().toISOString()
    });

    await fs.writeFile(
      MESSAGES,
      JSON.stringify(messages, null, 2),
      'utf8'
    );

    return res.status(201).json({
      ok: true,
      message: 'Message saved. Thanks for reaching out!'
    });
  } catch (error) {
    return serverError(res, 'Could not save message.', error);
  }
});

// Admin profile
app.put('/api/admin/profile', async (req, res) => {
  try {
    const data = await readData();
    data.profile = { ...data.profile, ...(req.body || {}) };

    await writeData(data);
    res.json(data.profile);
  } catch (error) {
    serverError(res, 'Could not update profile.', error);
  }
});

// Add skill
app.post('/api/admin/skills', async (req, res) => {
  try {
    const data = await readData();
    const item = { id: makeId(), ...(req.body || {}) };

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

// Update skill
app.put('/api/admin/skills/:id', async (req, res) => {
  try {
    const data = await readData();
    const index = data.skills.findIndex(
      item => item.id === req.params.id
    );

    if (index < 0) {
      return res.status(404).json({ error: 'Skill not found.' });
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

// Delete skill
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

// Add project
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

// Update project
app.put('/api/admin/projects/:id', async (req, res) => {
  try {
    const data = await readData();
    const index = data.projects.findIndex(
      item => item.id === req.params.id
    );

    if (index < 0) {
      return res.status(404).json({ error: 'Project not found.' });
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

// Delete project
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

// Unknown API route
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found.' });
});

app.listen(PORT, () => {
  console.log(`Portfolio API running on port ${PORT}`);
});