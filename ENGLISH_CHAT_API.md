# Generic English Chat API

This endpoint drives an avatar that acts as a **Generic English Subject Expert**. Ideally used for general doubts where no specific student grade context is needed.

## Endpoints

### 1. English Chat
**Endpoint:** `POST /api/english/chat`

**Description:**
A stateless chat endpoint where the AI is instructed to be concise (under 50 words) and helpful for English subject queries.

**Request Body:**
```json
{
  "message": "What is the difference between their, there, and they're?",
  "history": [  // Optional
    { "role": "user", "content": "Hi" },
    { "role": "assistant", "content": "Hello! How can I help you with English today?" }
  ]
}
```

**Response:**
*   **Format:** Server-Sent Events (SSE).
*   **Persona:** "English Teaching Expert".
*   **Constraints:** Answers are strictly kept under 50 words for better avatar pacing.

**Example Usage (JS):**
```javascript
const response = await fetch('http://localhost:8000/api/english/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: "Explain verbs." })
});
// ... handle stream ...
```
