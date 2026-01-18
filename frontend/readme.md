## 🚀 Publefy Front-End

Minimal, fast front-end built with Next.js + Tailwind CSS. Preconfigured API client, theming, UI components, and example pages are included.

### ⚙️ Requirements
- Node.js 20+ (LTS recommended)
- npm or pnpm

### ▶️ Quick Start
1) Install dependencies:
```bash
npm i
# or
pnpm i
```
2) Run the dev server:
```bash
npm run dev
# or
pnpm dev
```
3) Open `http://localhost:3000`.

---

## 🔌 Use a Local Backend

The API base URL is defined in `services/api/apiConfig.ts` via the `RAW_BASE` variable. By default, production Cloud Run is used. To work against your local backend (e.g., running on port 8000), choose one:

### Option A — via `.env.local` (recommended)
Create `.env.local` in the project root:
```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
# Optionally override the long-running video analyze endpoint
# NEXT_PUBLIC_VIDEO_ANALYZE_URL=http://127.0.0.1:8000/video/analyze/
```
Restart the dev server so environment variables are picked up.

Under the hood, `apiConfig.ts` reads `RAW_BASE` from `NEXT_PUBLIC_API_URL` and normalizes trailing slashes to form `API_BASE`:
```ts
// services/api/apiConfig.ts
const RAW_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://publefy-1020068343725.us-central1.run.app/";
export const API_BASE = RAW_BASE.replace(/\/+$/, "");
```

### Option B — hardcode in code (temporary, local only)
If you prefer not to use `.env.local`, temporarily set your local URL directly:
```ts
// services/api/apiConfig.ts
const RAW_BASE = "http://127.0.0.1:8000/"; // local backend
export const API_BASE = RAW_BASE.replace(/\/+$/, "");
```
Remember to revert this before committing.

### Where to look
- Base axios instance: `services/api/apiConfig.ts` → `axiosInstance`
- Relative endpoints: `API_ENDPOINTS`
- Absolute URLs (for redirects/images): `FULL_ENDPOINTS`

### CORS and cookies
For local development, ensure your backend:
- allows CORS from `http://localhost:3000`
- accepts the `Authorization` header
- handles cookies if needed. `userToken` is read in `services/api/api-service.ts` via `localStorage` and cookies.

---

## 📦 Scripts
- `dev` — development server
- `build` — production build
- `start` — run built app
- `lint` — lint code
- `images` — generate optimized images from `public/source`

---

## 🧱 Project Structure (key parts)
- `app/` — Next.js routes (App Router)
- `components/` — UI and page sections
- `services/api/` — API configuration and client
- `hooks/`, `lib/`, `utils/` — utilities and hooks
- `types/` — TypeScript types
- `public/` — static assets and optimized images

---

## 🔍 FAQ
- Why `127.0.0.1` vs `localhost`? SSL/CORS and name resolution can differ; `127.0.0.1` is predictable.
- Do I need a trailing slash? No. We normalize `RAW_BASE`; extra slashes won’t break it.
- How to build a full URL for redirects? Use `FULL_ENDPOINTS.*`.

---

## 🧰 Stack
- Next.js 15, React 19
- Tailwind CSS, Radix UI
- Axios, Zod, React Hook Form
- Framer Motion, Embla Carousel, Recharts

---

## 🧪 Quick API Connectivity Check
Try any endpoint, e.g., Google OAuth login from `FULL_ENDPOINTS`, or call `GET /instagram/profile-picture/:id` via your backend. If you get responses, the base configuration is correct.

---

## 🤝 Contributing
PRs are welcome. Follow the existing code style and avoid committing local URLs.


