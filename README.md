# Edura-Avatar

Edura-Avatar is an interactive educational platform featuring an AI-powered avatar that acts as a tutor. It facilitates conversational learning, homework assistance, and topic exploration using real-time streaming avatar technology.

## Features

-   **Interactive Avatar**: Real-time streaming avatar powered by HeyGen.
-   **Conversational AI**: Engages users in educational dialogue (Homework help, English practice).
-   **Topic-Based Learning**: distinct modules for different subjects.
-   **Multimedia Integration**: Capable of displaying videos and visual aids alongside the avatar.
-   **Session Management**: backend-driven session control and history tracking.

## System Architecture

```mermaid
graph TD
    subgraph Client [Frontend (React + Vite)]
        UI[User Interface]
        AvatarSDK[HeyGen Streaming SDK]
    end

    subgraph Server [Backend (FastAPI)]
        API[Core API]
        Routers[Routers: Chat, Topics, Sessions, Auth]
        Static[Static Media Server]
    end

    subgraph External [External Services]
        HeyGen[HeyGen API]
        LLM[LLM Provider (e.g. OpenAI/Gemini)]
    end

    UI -->|HTTP Requests| API
    UI -->|Media Files| Static
    UI -->|Stream Video/Audio| AvatarSDK
    
    AvatarSDK <-->|WebRTC/WebSocket| HeyGen
    
    API -->|Auth/Token Generation| HeyGen
    API -->|Context/Prompts| LLM
```

## Tech Stack

-   **Frontend**: React, TypeScript, Vite, Tailwind CSS (via CSS files), HeyGen Streaming Avatar SDK.
-   **Backend**: Python, FastAPI, Uvicorn.
-   **Containerization**: Docker, Docker Compose.

## Prerequisites

-   **Node.js** (v18+ recommended)
-   **Python** (v3.9+ recommended)
-   **Docker** & **Docker Compose** (optional, for containerized run)
-   **HeyGen API Key** (for avatar services)

## Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository_url>
cd Edura-Avatar
```

### 2. Backend Setup (`edura_core`)

It is recommended to use a virtual environment.

```bash
cd edura_core
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**Environment Variables**:
Create a `.env` file in `edura_core/` if required (refer to `.env.example` if available, otherwise check `main.py` or `config.py` for needed keys).

### 3. Frontend Setup (`ui`)

```bash
cd ui
npm install
```

**Environment Variables**:
Create a `.env` file in `ui/` based on `.env.example`:

```bash
cp .env.example .env
```
Update `.env` with your credentials:
-   `VITE_HEYGEN_AVATAR_ID`: Your HeyGen Avatar ID.
-   `VITE_HEYGEN_VOICE_ID`: Your HeyGen Voice ID.
-   `BACKEND_URL`: URL of the FastAPI backend (default: `http://localhost:8000`).

## Running the Application

### Option A: Using Docker Compose (Recommended)

Run the entire stack with a single command:

```bash
docker-compose up --build
```
-   Frontend: `http://localhost:5173` (or port defined in compose/vite config)
-   Backend: `http://localhost:8000`

### Option B: Running Locally

**Start Backend**:
```bash
cd edura_core
# Ensure venv is active
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Start Frontend**:
```bash
cd ui
npm run dev
```
Open your browser to the URL shown in the terminal (usually `http://localhost:5173`).

## Project Structure

-   **`edura_core/`**: FastAPI backend application.
    -   `app/routers/`: API route handlers (chat, sessions, etc.).
    -   `app/data/`: Static data and resources.
-   **`ui/`**: React frontend application.
    -   `src/components/`: Reusable UI components.
    -   `src/pages/`: Application pages.
    -   `src/styles/`: CSS stylesheets.
