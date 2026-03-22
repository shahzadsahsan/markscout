// GET /api/events — SSE stream for live file updates.
// Mitigation #5: try-catch on enqueue + abort signal cleanup.

import { addSSEClient, removeSSEClient, isScanComplete, getFileRegistry, getFilteredCount } from '@/lib/watcher';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  let sseController: ReadableStreamDefaultController | null = null;

  const stream = new ReadableStream({
    start(controller) {
      sseController = controller;
      addSSEClient(controller);

      // If scan is already complete, send the event immediately
      if (isScanComplete()) {
        try {
          const data = `event: scan-complete\ndata: ${JSON.stringify({
            totalFiles: getFileRegistry().size,
            filteredCount: getFilteredCount(),
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(data));
        } catch {
          removeSSEClient(controller);
        }
      }

      // Clean up on client disconnect (mitigation #5)
      request.signal.addEventListener('abort', () => {
        removeSSEClient(controller);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }, { once: true });
    },
    cancel() {
      if (sseController) removeSSEClient(sseController);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
