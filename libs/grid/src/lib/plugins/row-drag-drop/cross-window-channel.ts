/**
 * Cross-window coordination for RowDragDrop via `BroadcastChannel`.
 *
 * Same-window cross-grid drops can locate the source grid and its plugin via
 * `document.getElementById(sourceGridId)` — the target plugin handles both
 * sides of the transfer in `onDrop` (insert into target + remove from source
 * + emit `row-transfer` on both grids).
 *
 * Cross-window drops can't reach the source DOM that way. The target window
 * broadcasts a `tbw-row-drag-drop:transfer` message; each window has a single
 * channel and fans the message out to every attached plugin instance, which
 * matches on `sourceGridId === this.gridId` and runs the source-side path
 * (row removal on `move`, `row-transfer` emit, `dragAccepted` flip). The source
 * resolves the rows to remove from its own tracked drag (`sessionId`), not from
 * the echoed `rowIndices` (#666).
 *
 * The channel is created lazily on the first plugin that needs it and shared
 * across all instances in the window. It's torn down when the last instance
 * detaches so we don't leak a handle in environments where the plugin is
 * repeatedly attached/detached.
 *
 * @internal
 */

/** @internal */
export interface RemoteTransferMessage {
  type: 'tbw-row-drag-drop:transfer';
  sessionId: string;
  sourceGridId: string;
  toGridId: string;
  dropZone: string;
  /** Display indices at dragstart — informational only (`row-transfer` `fromIndices`). */
  rowIndices: number[];
  toIndex: number;
  operation: 'move' | 'copy';
  /** Pre-serialized rows (the same shape `serializeRow` produced on dragstart). */
  serializedRows: unknown[];
}

/** @internal */
export type RemoteTransferListener = (msg: RemoteTransferMessage) => void;

const CROSS_WINDOW_CHANNEL_NAME = 'tbw-row-drag-drop';
let sharedChannel: BroadcastChannel | null = null;
const remoteListeners = new Set<RemoteTransferListener>();

function ensureCrossWindowChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (sharedChannel) return sharedChannel;
  try {
    sharedChannel = new BroadcastChannel(CROSS_WINDOW_CHANNEL_NAME);
    sharedChannel.addEventListener('message', (event: MessageEvent) => {
      const data = event.data as RemoteTransferMessage | undefined;
      if (!data || data.type !== 'tbw-row-drag-drop:transfer') return;
      // Snapshot to tolerate listeners that detach during dispatch.
      for (const listener of Array.from(remoteListeners)) {
        try {
          listener(data);
        } catch {
          /* listener errors must not break sibling listeners */
        }
      }
    });
  } catch {
    sharedChannel = null;
  }
  return sharedChannel;
}

/** @internal */
export function registerRemoteTransferListener(listener: RemoteTransferListener): void {
  remoteListeners.add(listener);
  ensureCrossWindowChannel();
}

/** @internal */
export function unregisterRemoteTransferListener(listener: RemoteTransferListener): void {
  remoteListeners.delete(listener);
  if (remoteListeners.size === 0 && sharedChannel) {
    try {
      sharedChannel.close();
    } catch {
      /* noop */
    }
    sharedChannel = null;
  }
}

/** @internal */
export function broadcastRemoteTransfer(msg: RemoteTransferMessage): void {
  const channel = ensureCrossWindowChannel();
  if (!channel) return;
  try {
    channel.postMessage(msg);
  } catch {
    /* postMessage may throw on uncloneable payloads — acceptable; user can
     * supply `serializeRow` to provide a structured-cloneable shape. */
  }
}
