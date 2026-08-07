import { MODULE_ID } from "./constants.mjs";

const SOCKET_NAME = `module.${MODULE_ID}`;
const ACK_TIMEOUT_MS = 5000;
const TIMEOUT = Symbol("timeout");

/** @type {Record<string, (data: object) => Promise<void>|void>} */
const handlers = {};

/** @type {Map<string, {resolve: (value: any) => void}>} */
const pending = new Map();

export function registerSocket() {
  game.socket.on(SOCKET_NAME, async message => {
    if (message?.type === "ack") {
      pending.get(message.requestId)?.resolve(message.result);
      pending.delete(message.requestId);
      return;
    }

    if (game.user !== game.users.activeGM) return;

    const { action, data, requestId } = message ?? {};
    let result;
    try {
      result = await handlers[action]?.(data);
    } finally {
      game.socket.emit(SOCKET_NAME, { type: "ack", requestId, result });
    }
  });
}

/**
 * Register the function that the active GM's client runs when it
 * receives a relayed request for the given action.
 */
export function onGMAction(action, handler) {
  handlers[action] = handler;
}

/**
 * Run a privileged action (world setting writes, updates to actors the
 * current user doesn't own). GMs run it locally; players relay it to the
 * active GM's client over the socket and wait for confirmation before
 * resolving, so callers can rely on the action having actually applied.
 */
export async function runAsGM(action, data) {
  if (game.user.isGM) {
    return handlers[action]?.(data);
  }

  if (!game.users.activeGM) {
    ui.notifications.warn(game.i18n.localize("REALLY-INSPIRED.Warning.NoGM"));
    return;
  }

  const requestId = foundry.utils.randomID();
  const ack = new Promise(resolve => pending.set(requestId, { resolve }));
  const timeout = new Promise(resolve => setTimeout(() => resolve(TIMEOUT), ACK_TIMEOUT_MS));

  game.socket.emit(SOCKET_NAME, { action, data, requestId });
  const result = await Promise.race([ack, timeout]);

  if (result === TIMEOUT) {
    pending.delete(requestId);
    ui.notifications.warn(game.i18n.localize("REALLY-INSPIRED.Warning.GMTimeout"));
    return;
  }

  return result;
}
