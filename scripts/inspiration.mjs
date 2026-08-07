import { MODULE_ID, SETTINGS, POOL_MODES } from "./constants.mjs";
import { getMaxSharedPool } from "./settings.mjs";
import { onGMAction, runAsGM } from "./socket.mjs";

const FLAG_COUNT = "count";
const ACTIONS = {
  SET_SHARED_POOL: "setSharedPool",
  SET_ACTOR_COUNT: "setActorCount"
};

export function registerInspirationHandlers() {
  onGMAction(ACTIONS.SET_SHARED_POOL, ({ value }) => applySharedPool(value));
  onGMAction(ACTIONS.SET_ACTOR_COUNT, ({ actorId, value }) => {
    const actor = game.actors.get(actorId);
    if (actor) return applyIndividualCount(actor, value);
  });
}

export function getPoolMode() {
  return game.settings.get(MODULE_ID, SETTINGS.POOL_MODE);
}

export function getMaxPerCharacter() {
  return game.settings.get(MODULE_ID, SETTINGS.MAX_PER_CHARACTER);
}

export function getSharedPool() {
  return game.settings.get(MODULE_ID, SETTINGS.SHARED_POOL);
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

/** Punto de entrada único para los botones +/- de la hoja. */
export async function setCount(actor, value) {
  if (getPoolMode() === POOL_MODES.SHARED) {
    return runAsGM(ACTIONS.SET_SHARED_POOL, { value });
  }
  return runAsGM(ACTIONS.SET_ACTOR_COUNT, { actorId: actor.id, value });
}

export async function adjustCount(actor, delta) {
  return setCount(actor, getCount(actor) + delta);
}

/* -------------------------------------------- */
/*  Ejecutado solo en el cliente del GM activo   */
/* -------------------------------------------- */

async function applySharedPool(value) {
  const clamped = Math.clamp(value, 0, getMaxSharedPool());
  await game.settings.set(MODULE_ID, SETTINGS.SHARED_POOL, clamped);

  // Tocar un flag por personaje fuerza un update real en cada actor, lo que
  // hace que sus hojas abiertas se vuelvan a renderizar solas (mismo
  // mecanismo que ya usan las hojas para refrescarse tras cualquier cambio
  // de documento). Así el widget del pool compartido se mantiene al día en
  // todos los clientes sin depender de una lista global de ventanas abiertas.
  const characters = game.actors.filter(a => a.type === "character" && a.hasPlayerOwner);
  await Promise.all(characters.map(actor => touchSharedPoolActor(actor, clamped)));
}

async function touchSharedPoolActor(actor, poolValue) {
  const updates = { [`flags.${MODULE_ID}.poolTick`]: poolValue };
  const hasInspiration = poolValue > 0;
  if (actor.system.attributes?.inspiration !== hasInspiration) {
    updates["system.attributes.inspiration"] = hasInspiration;
  }
  await actor.update(updates);
}

async function applyIndividualCount(actor, value) {
  const clamped = Math.clamp(value, 0, getMaxPerCharacter());
  await actor.setFlag(MODULE_ID, FLAG_COUNT, clamped);
  await syncVanillaFlag(actor, clamped > 0);
}

async function syncVanillaFlag(actor, hasInspiration) {
  if (actor.system.attributes?.inspiration === hasInspiration) return;
  await actor.update({ "system.attributes.inspiration": hasInspiration });
}
