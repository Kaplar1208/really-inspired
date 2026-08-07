import { MODULE_ID, SETTINGS } from "./constants.mjs";
import { getPoolActor, getPoolValue, setPoolValue, registerPoolActor } from "./pool-actor.mjs";
import { isSocketlibAvailable, registerSocketlibBridge, requestSetSharedPool } from "./socketlib-bridge.mjs";

/**
 * El pool compartido tiene dos formas posibles de guardarse:
 *
 * - Sin socketlib (por defecto): flag en un actor oculto con permiso de
 *   Dueño para todos los jugadores. Nadie depende de que haya un GM
 *   conectado, a cambio de que técnicamente todos pueden escribir ahí
 *   (mitigado con las guardas en pool-actor.mjs).
 * - Con socketlib instalado y activo: world setting normal, escrito vía
 *   socket.executeAsGM. Esto SÍ vuelve a depender de un GM conectado para
 *   gastar/ceder del pool — es la contrapartida de que nadie más que el GM
 *   puede tocar ese dato en absoluto. Es una elección consciente del GM al
 *   instalar socketlib, no algo que decidimos por defecto.
 */
export function usingSocketlib() {
  return isSocketlibAvailable();
}

export function registerSharedPoolBackend() {
  if (usingSocketlib()) registerSocketlibBridge();
  else registerPoolActor();
}

export function getSharedPoolValue() {
  if (usingSocketlib()) return game.settings.get(MODULE_ID, SETTINGS.SHARED_POOL_SETTING);
  return getPoolValue();
}

export async function setSharedPoolValue(value) {
  if (usingSocketlib()) return requestSetSharedPool(value);
  return setPoolValue(value);
}

/** Llama a `onChange()` en este cliente cuando el valor del pool cambió, sin importar el backend. */
export function onSharedPoolChange(onChange) {
  if (usingSocketlib()) {
    const key = `${MODULE_ID}.${SETTINGS.SHARED_POOL_SETTING}`;
    Hooks.on("updateSetting", setting => {
      if (setting.key === key) onChange();
    });
    return;
  }

  Hooks.on("updateActor", (actor, changes) => {
    const pool = getPoolActor();
    if (!pool || actor.id !== pool.id) return;
    if (foundry.utils.getProperty(changes, `flags.${MODULE_ID}.poolValue`) !== undefined) onChange();
  });
}
