# AI Mock Interview Practice System

A beginner-friendly full-stack app for students who want structured interview practice. Students choose a target job role and question focus, write answers, rate their confidence, and revisit session history. The title says “AI,” but this MVP uses built-in question templates selected by role and focus. It does not call an AI API, require payment, or claim to automatically evaluate answers.

## Features and users

There is one role: a student with a personal account. Users can register and sign in; create sessions for a role and experience level; practice six behavioral, technical, or mixed prompts; save written answers and 1–5 self-ratings; complete, review, and delete their own sessions; and see their progress dashboard. No audio/video recording, AI scoring, recruiter role, or external integration is included.

## Technology and architecture

HTML, CSS, and browser JavaScript are served by Express. Node.js 20+ provides the backend, with Supabase PostgreSQL for persistent storage. The browser calls Express with `fetch`. Express checks a signed two-hour JWT and record ownership before accessing the database with its server-only Supabase service role key. Passwords are bcrypt hashes. RLS is enabled and no anonymous/browser policies exist. Never put the service key in frontend code.

## Project tree

```text
ai-mock-interview-practice-system/
├── frontend/ (index.html, styles.css, app.js)
├── backend/
│   ├── middleware/auth.js
│   ├── routes/auth.js
│   ├── routes/sessions.js
│   ├── .env (local only; ignored by Git)
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   ├── package-lock.json
│   ├── server.js
│   └── supabase.js
├── database/schema.sql
├── .gitignore
└── README.md
```

## Prerequisites

Install [VS Code](https://code.visualstudio.com/), [Node.js LTS](https://nodejs.org/) (includes npm), and [Git](https://git-scm.com/downloads). In PowerShell, verify with `node --version`, `npm --version`, and `git --version`. Use Node.js 20 or newer.

## Setup and run (Windows)

1. Extract the ZIP and open the `ai-mock-interview-practice-system` folder in VS Code. Open a terminal using **Terminal → New Terminal** at the project root.
2. Create a free project at [Supabase](https://supabase.com/). From **Project Settings → API**, copy the Project URL and server-side `service_role` key. The key is a password; keep it private.
3. In Supabase choose **SQL Editor → New query**, paste `database/schema.sql`, and click **Run**. In **Table Editor** verify the tables `app_users`, `interview_sessions`, and `interview_answers`.
4. In the VS Code terminal, enter the backend directory: `cd backend`. Install required packages: `npm install`. This creates/updates `backend/package-lock.json`.
5. Copy the safe template to your private configuration: `Copy-Item .env.example .env` (PowerShell, from `backend/`). Edit `.env` with your Supabase URL and service role key. Generate the JWT secret with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"` and paste the result as `JWT_SECRET`.
6. Keep `PORT=3000` and `NODE_ENV=development` for local work. Do not commit `.env`; only `.env.example` is safe to share. Example values are placeholders and cannot connect to a real database.
7. Start from `backend/` with `npm run dev` (or `npm start`). Success prints `Interview practice app listening on http://localhost:3000`. Open `http://localhost:3000`; do not open the HTML file directly. `/api/health` should return `{"status":"ok"}`.

## Environment configuration

| Variable | Description |
| --- | --- |
| `PORT` | Local server port; default is 3000. |
| `NODE_ENV` | Runtime mode; use development locally. |
| `SUPABASE_URL` | Project URL from Supabase API settings. |
| `SUPABASE_SERVICE_ROLE_KEY` | Private server key. Keep it in `backend/.env` only. |
| `JWT_SECRET` | Random signing key for login tokens. Keep it private. |

`.env.example` is committed as a template. `.env` contains your own secrets and is ignored by Git. If a secret is exposed, rotate it in Supabase immediately.

## API

All errors return JSON `{ "error": "message" }`. Except health and auth endpoints, routes require `Authorization: Bearer <token>`. Session APIs verify ownership against the signed-in account. Auth endpoints are rate-limited.

| Method and path | Input and result | Access |
| --- | --- | --- |
| `GET /api/health` | Returns `{status:"ok"}`. | Public |
| `POST /api/auth/register` | Body: `displayName,email,password`; returns token and user. | Public; 400 invalid, 409 duplicate email |
| `POST /api/auth/login` | Body: `email,password`; returns token and user. | Public; 400 invalid, 401 incorrect credentials |
| `GET /api/auth/me` | Returns current user. | Signed-in; 401 missing/expired token |
| `POST /api/sessions` | Body: `roleTitle,experienceLevel,focusArea`; creates session and six prompts. | Signed-in; 400 invalid fields |
| `GET /api/sessions` | Lists the user's latest 50 sessions. | Signed-in |
| `GET /api/sessions/:id` | Reads a session and its answers. | Owner; 404 missing/not owned |
| `PUT /api/sessions/:id/answers/:answerId` | Body: `answerText,selfRating` (rating 1–5 or null). | Owner, in progress; 400 invalid, 404 missing, 409 completed |
| `POST /api/sessions/:id/complete` | Marks session complete. | Owner; 404 missing/inactive |
| `DELETE /api/sessions/:id` | Deletes session and cascading answers; returns 204. | Owner; 404 missing/not owned |

## Use the application

Register with an email and a password of at least 10 characters. Choose **New session**, select the role and focus, then write an answer and optional confidence rating for each prompt. Moving to another prompt saves the response in PostgreSQL. Finish the session to make it read-only. Use **My practice** to review or delete sessions.

## Manual checks

There is no automated test suite. In a browser, check: health endpoint; successful account registration and login; duplicate email and invalid input messages; create six prompts; save an answer/rating and refresh to verify persistence; complete and reopen a read-only session; delete after confirmation; history shows only the current account's data; sign out and verify protected views require login; phone-width layout. Requests without a token should return 401. Invalid ratings and answers over 5,000 characters should return 400; a guessed other-user session ID should return 404. A real Supabase connection is confirmed only after successful registration and data retrieval using your own project.

You can syntax-check from `backend/`: `node --check server.js`, `node --check routes/auth.js`, `node --check routes/sessions.js`.

## Troubleshooting

- Missing Supabase variable: create `backend/.env` and fill all values.
- Table not found: run the complete `database/schema.sql` in the intended Supabase project.
- API key/permission error: check URL and service role key are from the same project; do not paste key into the frontend.
- Port in use: set another `PORT` in `.env`, then browse to that port.
- Browser cannot connect: keep the server terminal running and use its printed URL.
- Token expired: sign in again; tokens expire after two hours.
- Install fails: use Node 20+ and run `npm install` from `backend/` with internet access.

## Security and limitations

The server service key bypasses RLS, so the API validates JWTs and checks ownership for every session action. RLS stays enabled without public policies, blocking direct browser table access. Passwords are hashed with bcrypt. This educational app stores the JWT in local storage; a cross-site scripting flaw could expose it, so the UI escapes user text and the server validates limits. A production app should use secure httpOnly cookies, email verification, password reset, stronger monitoring, and a reviewed deployment setup. No audio/video, external AI, or automatic answer scoring exists in this MVP.

## Upload to GitHub

Create an empty repository on GitHub. In a terminal at the project root, run:

```bash
git init
git status
git add .
git status
git commit -m "Build project"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with your repository address. Before committing, verify `.env` is excluded, `.env.example` is present, and `node_modules/` is excluded. Never upload private user data, exports, or secrets. `.gitignore` does not remove a secret already committed; rotate exposed credentials and clean repository history before sharing.
