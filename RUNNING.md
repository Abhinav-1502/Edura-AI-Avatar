# Running Edura AI

This project is separated into two components:
*   **`edura_core/`**: The FastAPI backend (Python).
*   **`frontend/`**: The Frontend assets (HTML, JS, CSS).

## Option 1: Using Docker (Recommended)

This method ensures you have the correct environment and dependencies.

### Prerequisites
*   [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### Steps
1.  **Configure Environment**:
    Ensure your secrets are set in `edura_core/.env`.

2.  **Run the Application**:
    From the root directory (`Azure-Ai-Avatar-main`), run:
    ```bash
    docker-compose up --build
    ```

3.  **Access Edura**:
    Open your browser to [http://localhost:8000](http://localhost:8000).

---

## Option 2: Running Locally (Manual)

### 1. Backend Setup (`edura_core`)

1.  Navigate to the core directory:
    ```bash
    cd edura_core
    ```

2.  Create and activate a virtual environment:
    ```bash
    python3 -m venv venv
    source venv/bin/activate  # Windows: venv\Scripts\activate
    ```

3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

4.  Run the server:
    ```bash
    uvicorn main:app --port 8000 --reload
    ```

### 2. Frontend
The backend is configured to serve the frontend automatically from the `../frontend` directory. 
By running the backend, the frontend is accessible at [http://localhost:8000](http://localhost:8000).

## Troubleshooting

*   **Avatar connection fails?**
    Check `edura_core/.env` to ensure your Azure Speech keys and Region are correct.
*   **Capacity Exceeded?**
    The application will automatically retry. If it persists, try changing the region in your Azure Portal and `.env` file (e.g., to `swedencentral`).
