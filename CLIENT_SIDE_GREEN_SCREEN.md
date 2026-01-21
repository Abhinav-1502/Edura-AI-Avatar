# Client-Side Green Screen Removal & Background Replacement

To achieve a custom background without relying on server-side processing, we implemented a real-time **Chroma Key (Green Screen)** filter directly in the browser using the HTML5 Canvas API.

## How It Works

### 1. The Container
We have a container component (`VideoPanel`) that holds the background image and the interactive canvas.

```tsx
<div style={{ backgroundImage: `url(${backgroundImageUrl})` }}>
    <canvas ref={canvasRef} />
</div>
```

The background image sits "behind" the canvas. When we make pixels on the canvas transparent, the background image shows through.

### 2. Video Processing (The "Green Screen" Logic)
Instead of displaying the `<video>` element directly, we hide it (`display: none` or opacity 0) and use it as a data source.

We run a render loop using `requestAnimationFrame`, performing the following steps for every single video frame:

1.  **Draw Frame**: Draw the current video frame onto an off-screen canvas context.
2.  **Get Pixel Data**: Extract the raw RGBA pixel array using `ctx.getImageData()`.
3.  **Pixel Iteration**: Loop through every pixel (R, G, B, Alpha) in the array.
4.  **Chroma Key Condition**: Check if the pixel is green.
    *   *Algorithm*: `isGreen = (G > 90) AND (G > R * 1.5) AND (G > B * 1.5)`
    *   This formula ensures the Green value is significantly higher than Red and Blue, identifying it as the green screen background.
5.  **Apply Transparency**: If the pixel is green, set its Alpha value to 0 (fully transparent).
6.  **Render**: Put the modified pixel data back onto the visible canvas using `ctx.putImageData()`.

### 3. Code Snippet
Here is the core logical block used in `VideoPanel.tsx`:

```typescript
const renderFrame = () => {
    // Draw video to canvas
    ctx.drawImage(video, 0, 0, width, height);
    
    // Get raw pixel data
    const frame = ctx.getImageData(0, 0, width, height);
    const l = frame.data.length / 4;

    for (let i = 0; i < l; i++) {
        const r = frame.data[i * 4 + 0];
        const g = frame.data[i * 4 + 1];
        const b = frame.data[i * 4 + 2];
        
        // Green Screen Check
        if (g > 90 && g > r * 1.5 && g > b * 1.5) {
            frame.data[i * 4 + 3] = 0; // Set Alpha to 0 (Transparent)
        }
    }
    
    // Update canvas
    ctx.putImageData(frame, 0, 0);
    requestRef.current = requestAnimationFrame(renderFrame);
};
```

## Benefits
*   **Dynamic**: We can change the `backgroundImageUrl` instantly without restarting the stream.
*   **Low Latency**: Processing happens on the client GPU/CPU, avoiding server-side compositing lag.
*   **Cost Effective**: Reduces the need for expensive server-side video processing.
