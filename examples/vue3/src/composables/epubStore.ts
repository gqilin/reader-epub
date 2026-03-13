// Simple in-memory store to pass epub file data between pages
// Avoids sessionStorage size limits for large epub files

let pendingBuffer: ArrayBuffer | null = null;

export function setPendingBuffer(buffer: ArrayBuffer) {
  pendingBuffer = buffer;
}

export function consumePendingBuffer(): ArrayBuffer | null {
  const buf = pendingBuffer;
  pendingBuffer = null;
  return buf;
}
