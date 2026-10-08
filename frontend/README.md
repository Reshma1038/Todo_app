# Todo App — Frontend

React (Vite) + Tailwind CSS frontend for the collaborative todo application.

## Tech

- **React 19** with **React Router** — protected routes, SPA navigation
- **Tailwind CSS** — responsive modern UI (desktop / tablet / mobile)
- **Axios** — centralized API client with JWT injection and 401 handling
- **@dnd-kit** — drag-and-drop task reordering persisted to MongoDB

## Setup

```bash
cd frontend
npm install
cp .env.example .env   # then edit values
```

## Environment variables

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the FastAPI API, e.g. `http://localhost:8000/api` |

## Run

```bash
npm run dev      # dev server (default http://localhost:5173)
npm run build    # production build to dist/
npm run preview  # preview the production build
```

## Structure

```
src/
├── api/               # Axios instance + authApi / pageApi / todoApi
├── components/        # Layout, Navbar, Sidebar, TodoCard, modals, badges…
├── context/           # AuthContext (JWT session), ToastContext (notifications)
├── pages/             # Login, Register, Dashboard, TodoPage
├── utils/             # Formatting & validation helpers
├── App.jsx            # Route table
└── main.jsx           # Providers + router bootstrap
```
