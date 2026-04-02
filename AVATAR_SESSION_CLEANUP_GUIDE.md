# Avatar Session Cleanup Guide

HeyGen avatars are expensive resources. Proper cleanup is critical because sessions do **not** automatically close if the user closes the browser tab or refreshes the page, leading to "zombie sessions" that drain credits.

This guide provides the robust patterns we use to ensure sessions are always terminated.

## 1. The React Cleanup Pattern
You **must** call `stopAvatar()` in the return function of your `useEffect` hook. This handles component unmounting (internal navigation).

```typescript
useEffect(() => {
    // 1. Initialize
    // ... startSession(...)

    // 2. Cleanup Function
    return () => {
        console.log("Component unmounting, closing avatar...");
        if (avatarService.current) {
             avatarService.current.stopAvatar(); // or .close()
        }
    };
}, []); 
```

## 2. The `beforeunload` Pattern (Critical)
React's cleanup function *might* run on page refresh, but it is not guaranteed to complete async operations before the page dies. You must use the native `beforeunload` event as a safety net.

In your main component (e.g., `App.tsx` or `SessionPlayer.tsx`):

```typescript
useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
        // Warning: We cannot await async calls here. 
        // We must stick to synchronous cleanup or "sendBeacon" if supported.
        // Best practice is to trigger the close immediately.
        
        avatarService.close(); // Ensure this method can fire-and-forget
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
    };
}, []);
```

## 3. Backend Safety Net
Because the frontend can crash or lose network connectivity instantly (closing laptop), the frontend cannot be 100% relied upon.

We have implemented a **"Stop All"** endpoint on the backend. 
**Suggestion:** Call this endpoint when the user *enters* the application (e.g., on `HomePage` load). This ensures any lingering sessions from a previous crash are wiped clean before starting a new one.

**Endpoint:** `POST /api/heygen/stop_all_sessions`

```typescript
// Example: Call on app init
useEffect(() => {
    ApiClient.stopAllActiveSession()
        .then(() => console.log("Cleaned up orphaned sessions"))
        .catch(err => console.error("Cleanup failed", err));
}, []);
```

## Small & Short Suggestions
1.  **Disable Idle Timeout**: If using `debug: true` or `idleTimeout`, be careful. We recommend handling timeouts manually or disabling them (`disableIdleTimeout: true`) to avoid the avatar cutting out if the user is reading.
2.  **One Session Per User**: Enforce a singleton pattern. Don't let a user open two tabs with two avatars. The "Stop All" on load strategy helps enforce this.
3.  **Visual Feedback**: When closing, show a "Disconnecting..." spinner. It prevents the user from clicking refresh again and double-triggering logic.
4.  **Network Resilience**: If the internet disconnects, the avatar stream will die. Listen to `offline` events and attempt to reconnect or show a "Connection Lost" error.
