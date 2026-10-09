# Raveenraj — 3D Full-Stack Portfolio

A responsive React + Three.js portfolio with a Node/Express REST API, searchable/filterable skills and projects, contact message API, and a simple local admin API. Portfolio content starts from sample data in `backend/data.json` and can be edited there.

## Requirements
- Node.js 20+ recommended
- Internet connection for first `npm install`

## Run on Windows (PowerShell)
1. Extract the ZIP.
2. Open PowerShell in the extracted `raveenraj-3d-portfolio` folder.
3. Run:
   ```powershell
   npm install
   npm run install:all
   npm run dev
   ```
4. Open `http://localhost:5173`.
5. API health check: `http://localhost:5000/api/health`.

## Project structure
- `frontend/` — Vite + React, Three.js hero, skill and project filters, contact form.
- `backend/` — Express API and local JSON data storage.

## Customization
- Edit `backend/data.json` to update the profile, skills and projects.
- Change social links in `frontend/src/App.jsx` and profile defaults in `backend/data.json`.
- Contact messages are appended to `backend/messages.json` when the form is submitted.

## API routes
- `GET /api/portfolio` — profile, skills, projects
- `GET /api/skills` — skills (optional `?category=Frontend&q=react`)
- `GET /api/projects` — projects (optional `?type=Web&level=Advanced&scope=Full%20Stack&q=campus`)
- `POST /api/contact` — validate and save a contact message
- `PUT /api/admin/profile` — update profile JSON
- `POST /api/admin/skills` — add a skill
- `PUT /api/admin/skills/:id` — update a skill
- `DELETE /api/admin/skills/:id` — delete a skill
- `POST /api/admin/projects` — add a project
- `PUT /api/admin/projects/:id` — update a project
- `DELETE /api/admin/projects/:id` — delete a project

**Important:** Admin routes are intentionally local-development starter routes without authentication. Before public deployment, add authentication/authorization, rate limiting, persistent database storage, and server-side validation. The portfolio content is sample starter data; review it and replace skill levels, links, and project descriptions with your verified details before publishing. No paid API key is required.
