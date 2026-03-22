// MarkReader — Next.js Instrumentation Hook
// Boots the chokidar file watcher on server start.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initWatcher } = await import('./lib/watcher');
    await initWatcher();
  }
}
