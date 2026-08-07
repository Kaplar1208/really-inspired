import { MODULE_ID, SETTINGS } from "./constants.mjs";

let socket = null;

export function isSocketlibAvailable() {
  return game.modules.get("socketlib")?.active === true;
}

/**
 * Solo se usa si socketlib está instalado y activo (ver shared-pool-backend.mjs).
 * Sigue el patrón estándar documentado por socketlib: engancharse a
 * "socketlib.ready" en vez de asumir un orden de carga entre módulos.
 */
export function registerSocketlibBridge() {
  if (!isSocketlibAvailable()) return;
  Hooks.once("socketlib.ready", () => {
    socket = socketlib.registerModule(MODULE_ID);
    socket.register("setSharedPool", applySharedPoolSetting);
  });
}

async function applySharedPoolSetting(value) {
  await game.settings.set(MODULE_ID, SETTINGS.SHARED_POOL_SETTING, value);
}

export async function requestSetSharedPool(value) {
  if (game.user.isGM) return applySharedPoolSetting(value);

  if (!socket) {
    ui.notifications.warn(game.i18n.localize("REALLY-INSPIRED.Warning.SocketlibNotReady"));
    return;
  }
  return socket.executeAsGM(applySharedPoolSetting, value);
}
