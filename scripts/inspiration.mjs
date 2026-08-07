import { MODULE_ID, SETTINGS, POOL_MODES } from "./constants.mjs";
import { getMaxSharedPool } from "./settings.mjs";
import { getSharedPoolValue, setSharedPoolValue, onSharedPoolChange, registerSharedPoolBackend } from "./shared-pool-backend.mjs";

const FLAG_COUNT = "count";

// Marca los updates que nosotros mismos hacemos sobre system.attributes.inspiration,
// para que la sincronización reactiva de más abajo no reaccione a su propia escritura.
const INTERNAL_UPDATE = { [MODULE_ID]: { internal: true } };

export function registerInspirationHooks() {
  registerSharedPoolBackend();
  onSharedPoolChange(() => {
    if (getPoolMode() === POOL_MODES.SHARED) syncMyCharactersToPool();
  });
  Hooks.on("updateActor", onUpdateActor);
  Hooks.once("ready", () => {
    if (getPoolMode() === POOL_MODES.SHARED) syncMyCharactersToPool();
  });
}

export function getPoolMode() {
  return game.settings.get(MODULE_ID, SETTINGS.POOL_MODE);
}

export function getMaxPerCharacter() {
  return game.settings.get(MODULE_ID, SETTINGS.MAX_PER_CHARACTER);
}

export function getSharedPool() {
  return getSharedPoolValue();
}

export function getIndividualCount(actor) {
  return actor.getFlag(MODULE_ID, FLAG_COUNT) ?? 0;
}

/** Cuenta que corresponde mostrar para este actor, según el modo activo. */
export function getCount(actor) {
  return getPoolMode() === POOL_MODES.SHARED ? getSharedPool() : getIndividualCount(actor);
}

/** Máximo que corresponde mostrar para este actor, según el modo activo. */
export function getMax(actor) {
  return getPoolMode() === POOL_MODES.SHARED ? getMaxSharedPool() : getMaxPerCharacter();
}

export function canAdjust(actor) {
  if (game.user.isGM) return true;
  if (!game.settings.get(MODULE_ID, SETTINGS.PLAYERS_CAN_ADJUST)) return false;
  return getPoolMode() === POOL_MODES.SHARED ? true : actor.isOwner;
}

/**
 * Punto de entrada único para los botones +/- de la hoja y para el reroll
 * de chat. Ya no hace falta relay: el pool compartido vive en un actor que
 * todos los jugadores pueden escribir, y el modo individual siempre actúa
 * sobre un actor que quien llama ya posee.
 */
export async function setCount(actor, value) {
  if (getPoolMode() === POOL_MODES.SHARED) return applySharedPool(value);
  return applyIndividualCount(actor, value);
}

export async function adjustCount(actor, delta) {
  return setCount(actor, getCount(actor) + delta);
}

async function applySharedPool(value) {
  const clamped = Math.clamp(value, 0, getMaxSharedPool());
  await setSharedPoolValue(clamped);
  // No hace falta tocar aquí los actores de los demás jugadores: cada cliente
  // sincroniza sus propios personajes al reaccionar al cambio del valor del
  // pool (ver onSharedPoolChange más arriba), así nadie necesita permisos
  // que no tiene.
}

async function applyIndividualCount(actor, value) {
  const clamped = Math.clamp(value, 0, getMaxPerCharacter());
  await actor.setFlag(MODULE_ID, FLAG_COUNT, clamped);
  await syncVanillaFlag(actor, clamped > 0);
}

async function syncVanillaFlag(actor, hasInspiration) {
  if (!actor.isOwner) return;
  if (actor.system.attributes?.inspiration === hasInspiration) return;
  await actor.update({ "system.attributes.inspiration": hasInspiration }, INTERNAL_UPDATE);
}

/* -------------------------------------------- */
/*  Sincronización reactiva, distribuida entre    */
/*  todos los clientes (cada uno solo actúa sobre */
/*  lo que tiene permiso de escribir)             */
/* -------------------------------------------- */

function onUpdateActor(actor, changes, options) {
  if (options[MODULE_ID]?.internal) return;
  if (actor.type !== "character") return;

  // Otro módulo (automatización de reglas, macros) pudo togglear el flag
  // vainilla por su cuenta. Si es así, ajustamos nuestro contador para no
  // quedar desincronizados.
  const hasInspiration = foundry.utils.getProperty(changes, "system.attributes.inspiration");
  if (hasInspiration === undefined) return;
  if (!isResponsibleFor(actor)) return;

  if (getPoolMode() === POOL_MODES.SHARED) {
    // Solo se puede inferir con seguridad el caso "se gastó 1"; un external
    // false->true no dice cuánto debería sumarse, así que ese caso se ignora.
    if (!hasInspiration) applySharedPool(getSharedPool() - 1);
    return;
  }

  const current = getIndividualCount(actor);
  if (hasInspiration && current === 0) applyIndividualCount(actor, 1);
  else if (!hasInspiration && current > 0) applyIndividualCount(actor, current - 1);
}

function syncMyCharactersToPool() {
  const hasInspiration = getSharedPool() > 0;
  for (const actor of game.actors.filter(a => a.type === "character" && a.isOwner)) {
    syncVanillaFlag(actor, hasInspiration);
  }
}

/**
 * Evita que dos clientes reaccionen al mismo cambio externo a la vez (lo que
 * duplicaría el descuento). El dueño jugador conectado tiene prioridad; el
 * GM solo actúa como respaldo si nadie más está conectado para ese actor.
 */
function isResponsibleFor(actor) {
  if (!actor.isOwner) return false;
  if (!game.user.isGM) return true;
  const hasOnlineNonGMOwner = game.users.some(
    u => u.active && !u.isGM && actor.testUserPermission(u, "OWNER")
  );
  return !hasOnlineNonGMOwner;
}
