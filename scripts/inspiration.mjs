import { MODULE_ID, SETTINGS, POOL_MODES } from "./constants.mjs";
import { getMaxSharedPool } from "./settings.mjs";
import { isSocketlibAvailable, registerSocketlibBridge, getSocket } from "./socketlib-bridge.mjs";

const FLAG_COUNT = "count";
const SOCKET_CHANNEL = `module.${MODULE_ID}`;

// Marca los updates que nosotros mismos hacemos sobre system.attributes.inspiration,
// para que la sincronización reactiva de más abajo no reaccione a su propia escritura.
const INTERNAL_UPDATE = { [MODULE_ID]: { internal: true } };

export function registerInspirationHooks() {
  Hooks.on("updateActor", onUpdateActor);
  registerSocketlibBridge(applySpendFromActorId);
  Hooks.once("ready", () => {
    game.socket.on(SOCKET_CHANNEL, onSpendRequest);
    if (getPoolMode() === POOL_MODES.SHARED) syncMyCharactersVanillaFlags();
  });
}

export function getPoolMode() {
  return game.settings.get(MODULE_ID, SETTINGS.POOL_MODE);
}

export function getMaxPerCharacter() {
  return game.settings.get(MODULE_ID, SETTINGS.MAX_PER_CHARACTER);
}

export function getIndividualCount(actor) {
  return actor.getFlag(MODULE_ID, FLAG_COUNT) ?? 0;
}

/**
 * El "pool compartido" no es un valor guardado aparte: es la suma de lo
 * que cada personaje de jugador tiene guardado en su propio flag. Así no
 * hay dos lugares que se puedan desincronizar entre sí al cambiar de modo.
 */
export function getGroupTotal() {
  return game.actors
    .filter(a => a.type === "character" && a.hasPlayerOwner)
    .reduce((sum, a) => sum + getIndividualCount(a), 0);
}

/** Cuenta que corresponde mostrar para este actor, según el modo activo. */
export function getCount(actor) {
  return getPoolMode() === POOL_MODES.SHARED ? getGroupTotal() : getIndividualCount(actor);
}

/** Máximo que corresponde mostrar para este actor, según el modo activo. */
export function getMax(actor) {
  return getPoolMode() === POOL_MODES.SHARED ? getMaxSharedPool() : getMaxPerCharacter();
}

export function canAdjust(actor) {
  if (game.user.isGM) return true;
  if (!game.settings.get(MODULE_ID, SETTINGS.PLAYERS_CAN_ADJUST)) return false;
  return actor.isOwner;
}

/**
 * Escritura directa: siempre afecta el propio número de ESTE personaje, sin
 * importar el modo. La usan el botón "+" de la hoja y el otorgamiento
 * manual del GM (tecla "I") — otorgar siempre es darle a alguien en
 * concreto, nunca es ambiguo.
 */
export async function adjustCount(actor, delta) {
  return applyIndividualCount(actor, getIndividualCount(actor) + delta);
}

/**
 * Gasto consciente del modo. En individual, resta directo de este
 * personaje. En compartido, resta primero de este personaje; si ya está en
 * 0, la resta la absorbe quien tenga más inspiración en el grupo.
 */
export async function spendInspiration(actingActor, amount = 1) {
  const own = getIndividualCount(actingActor);
  if (getPoolMode() !== POOL_MODES.SHARED || own >= amount) {
    return applyIndividualCount(actingActor, own - amount);
  }
  return spendFromGroup(amount);
}

async function spendFromGroup(amount) {
  const holder = findMaxHolder();
  if (!holder) return;

  if (holder.isOwner) {
    return applyIndividualCount(holder, getIndividualCount(holder) - amount);
  }

  // No somos dueños de quien tiene más: hace falta que alguien con permiso
  // aplique el descuento por nosotros. Los sockets de módulo de un jugador
  // normal no le llegan de forma confiable a OTRO jugador normal — solo al
  // GM sí. Con socketlib es una única ejecución garantizada; sin él, se
  // depende de que el GM esté conectado (nada que aprobar de su parte, se
  // aplica solo en segundo plano).
  if (isSocketlibAvailable()) {
    const socket = getSocket();
    if (socket) {
      await socket.executeAsGM(applySpendFromActorId, holder.id, amount);
      return;
    }
  }

  if (!game.users.activeGM) {
    ui.notifications.warn(game.i18n.localize("REALLY-INSPIRED.Warning.NoGMForBorrow"));
    return;
  }
  game.socket.emit(SOCKET_CHANNEL, { type: "spendFrom", actorId: holder.id, amount });
}

function findMaxHolder() {
  let best = null;
  for (const actor of game.actors.filter(a => a.type === "character" && a.hasPlayerOwner)) {
    if (!best || getIndividualCount(actor) > getIndividualCount(best)) best = actor;
  }
  return best && getIndividualCount(best) > 0 ? best : null;
}

async function applySpendFromActorId(actorId, amount) {
  const actor = game.actors.get(actorId);
  if (!actor) return;
  const current = getIndividualCount(actor);
  if (current >= amount) return applyIndividualCount(actor, current - amount);
}

function onSpendRequest(message = {}) {
  if (message.type !== "spendFrom") return;
  if (!game.user.isGM) return;
  applySpendFromActorId(message.actorId, message.amount);
}

async function applyIndividualCount(actor, value) {
  const clamped = Math.clamp(value, 0, getMaxPerCharacter());
  await actor.setFlag(MODULE_ID, FLAG_COUNT, clamped);
  await syncVanillaFlag(actor, getCount(actor) > 0);
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

  // Cambió el número de ALGÚN personaje: en modo compartido eso mueve el
  // total del grupo, así que cada cliente revisa si el checkbox vainilla de
  // sus propios personajes sigue reflejando ese total.
  const countChanged = foundry.utils.getProperty(changes, `flags.${MODULE_ID}.${FLAG_COUNT}`) !== undefined;
  if (countChanged && getPoolMode() === POOL_MODES.SHARED) syncMyCharactersVanillaFlags();

  // Otro módulo (automatización de reglas, macros) pudo togglear el flag
  // vainilla por su cuenta. Si es así, ajustamos nuestro contador para no
  // quedar desincronizados.
  const hasInspiration = foundry.utils.getProperty(changes, "system.attributes.inspiration");
  if (hasInspiration === undefined) return;
  if (!isResponsibleFor(actor)) return;

  const current = getIndividualCount(actor);
  if (hasInspiration) {
    if (current === 0) applyIndividualCount(actor, 1);
    return;
  }

  if (current > 0) {
    applyIndividualCount(actor, current - 1);
  } else if (getPoolMode() === POOL_MODES.SHARED) {
    // El flag de este personaje mostraba "true" solo porque el grupo tenía
    // inspiración (su propio número está en 0); el gasto externo se
    // absorbe de quien realmente tenga con qué pagarlo.
    spendFromGroup(1);
  }
}

function syncMyCharactersVanillaFlags() {
  const hasInspiration = getGroupTotal() > 0;
  for (const actor of game.actors.filter(a => a.type === "character" && a.isOwner)) {
    syncVanillaFlag(actor, hasInspiration);
  }
}

/**
 * Evita que dos clientes reaccionen al mismo cambio a la vez. El dueño
 * jugador conectado tiene prioridad; el GM solo actúa como respaldo si
 * nadie más está conectado para ese actor.
 */
function isResponsibleFor(actor) {
  if (!actor.isOwner) return false;
  if (!game.user.isGM) return true;
  const hasOnlineNonGMOwner = game.users.some(
    u => u.active && !u.isGM && actor.testUserPermission(u, "OWNER")
  );
  return !hasOnlineNonGMOwner;
}
