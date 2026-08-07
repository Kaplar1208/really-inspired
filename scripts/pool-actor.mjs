import { MODULE_ID } from "./constants.mjs";

const IS_POOL_ACTOR_FLAG = "isPoolActor";
const POOL_VALUE_FLAG = "poolValue";
const POOL_ACTOR_NAME = "Really Inspired: Shared Pool";

/**
 * El pool compartido vive como flag en este actor oculto, no en un world
 * setting. Un world setting solo puede escribirlo el GM; este actor se crea
 * con permiso de Dueño por defecto para todos los jugadores, así que
 * cualquiera puede gastar/ceder del pool sin depender de que haya un GM
 * conectado. Es type "npc" a propósito, para que nunca lo cuenten los
 * filtros type=character del resto del módulo (conteo de personajes,
 * selector de "con qué personaje cedo inspiración", etc.).
 */
export function registerPoolActor() {
  Hooks.once("ready", ensurePoolActor);
  Hooks.on("renderActorDirectory", hidePoolActorEntry);
  Hooks.on("renderActorSheetV2", blockPoolActorSheet);
  Hooks.on("preUpdateActor", guardPoolActorUpdate);
  Hooks.on("preDeleteActor", guardPoolActorDelete);
}

export function getPoolActor() {
  return game.actors?.find(a => a.getFlag(MODULE_ID, IS_POOL_ACTOR_FLAG)) ?? null;
}

export function getPoolValue() {
  return getPoolActor()?.getFlag(MODULE_ID, POOL_VALUE_FLAG) ?? 0;
}

export async function setPoolValue(value) {
  const pool = getPoolActor();
  if (!pool) {
    ui.notifications.warn(game.i18n.localize("REALLY-INSPIRED.Warning.NoPoolActor"));
    return;
  }
  await pool.setFlag(MODULE_ID, POOL_VALUE_FLAG, value);
}

async function ensurePoolActor() {
  if (!game.user.isGM) return;
  if (getPoolActor()) return;

  await Actor.create({
    name: POOL_ACTOR_NAME,
    type: "npc",
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
    flags: { [MODULE_ID]: { [IS_POOL_ACTOR_FLAG]: true, [POOL_VALUE_FLAG]: 0 } }
  });
}

function hidePoolActorEntry(app, html) {
  const pool = getPoolActor();
  if (!pool) return;
  const root = html instanceof HTMLElement ? html : html[0];
  root?.querySelector(`[data-entry-id="${pool.id}"], [data-document-id="${pool.id}"]`)?.remove();
}

function blockPoolActorSheet(app) {
  if (!app.actor?.getFlag(MODULE_ID, IS_POOL_ACTOR_FLAG)) return;
  app.close();
  ui.notifications.warn(game.i18n.localize("REALLY-INSPIRED.Warning.PoolActorLocked"));
}

/**
 * Todos los jugadores son "Dueño" de este actor para poder escribir el
 * número del pool sin relay, pero eso también les permite renombrarlo,
 * cambiarle el tipo, tocar su permiso, etc. Esto limita, para quien no sea
 * GM, los updates a únicamente el flag del valor del pool. No es una
 * barrera de seguridad dura (un cliente modificado podría saltársela),
 * pero evita el caso real: alguien tocándolo sin querer desde la UI.
 */
function guardPoolActorUpdate(actor, changes) {
  if (!actor.getFlag(MODULE_ID, IS_POOL_ACTOR_FLAG)) return;
  if (game.user.isGM) return;

  const topLevelOk = Object.keys(changes).every(key => key === "flags");
  const moduleFlags = changes.flags?.[MODULE_ID] ?? {};
  const otherModuleFlags = Object.keys(changes.flags ?? {}).some(key => key !== MODULE_ID);
  const onlyPoolValue = Object.keys(moduleFlags).every(key => key === POOL_VALUE_FLAG);

  if (topLevelOk && !otherModuleFlags && onlyPoolValue) return;

  ui.notifications.error(game.i18n.localize("REALLY-INSPIRED.Warning.PoolActorProtected"));
  return false;
}

function guardPoolActorDelete(actor) {
  if (!actor.getFlag(MODULE_ID, IS_POOL_ACTOR_FLAG)) return;
  if (game.user.isGM) return;
  ui.notifications.error(game.i18n.localize("REALLY-INSPIRED.Warning.PoolActorProtected"));
  return false;
}
