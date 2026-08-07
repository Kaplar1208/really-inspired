import { MODULE_ID } from "./constants.mjs";

const SOCKET_NAME = `module.${MODULE_ID}`;

/** @type {Record<string, (data: object) => Promise<void>|void>} */
const handlers = {};

export function registerSocket() {
  game.socket.on(SOCKET_NAME, ({ action, data } = {}) => {
    if (game.user !== game.users.activeGM) return;
    handlers[action]?.(data);
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
 * active GM's client over the socket.
 */
export async function runAsGM(action, data) {
  if (game.user.isGM) {
    return handlers[action]?.(data);
  }

  if (!game.users.activeGM) {
    ui.notifications.warn(game.i18n.localize("REALLY-INSPIRED.Warning.NoGM"));
    return;
  }

  game.socket.emit(SOCKET_NAME, { action, data });
}
