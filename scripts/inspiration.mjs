import { MODULE_ID, SETTINGS, POOL_MODES } from "./constants.mjs";
import { getMaxSharedPool } from "./settings.mjs";
import { isSocketlibAvailable, registerSocketlibBridge, getSocket } from "./socketlib-bridge.mjs";

const FLAG_COUNT = "count";
const FLAG_PENDING_BORROW = "pendingBorrow";

// Marca los updates que nosotros mismos hacemos sobre system.attributes.inspiration,
// para que la sincronización reactiva de más abajo no reaccione a su propia escritura.
const INTERNAL_UPDATE = { [MODULE_ID]: { internal: true } };

export function registerInspirationHooks() {
  Hooks.on("updateActor", onUpdateActor);
  registerSocketlibBridge(applySpendFromActorId);
  Hooks.once("ready", () => {
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
  return spendFromGroup(amount, actingActor);
}

async function spendFromGroup(amount, actingActor) {
  const holder = findMaxHolder();
  if (!holder) return;

  if (holder.isOwner) {
    return applyIndividualCount(holder, getIndividualCount(holder) - amount);
  }

  // No somos dueños de quien tiene más: hace falta que alguien con permiso
  // aplique el descuento por nosotros. Con socketlib es una única ejecución
  // garantizada, sin depender de quién esté conectado.
  if (isSocketlibAvailable()) {
    const socket = getSocket();
    if (socket) {
      await socket.executeAsGM(applySpendFromActorId, holder.id, amount);
      return;
    }
  }

  // Sin socketlib: en vez de un socket propio (cuya entrega entre dos
  // clientes que no son GM no se pudo confirmar como confiable), usamos el
  // mismo mecanismo de sincronización de documentos que ya es confiable en
  // el resto del módulo. Escribimos la solicitud en NUESTRO propio actor
  // (siempre permitido); quien sea dueño de "holder" —o el GM como
  // respaldo— la recibe vía el update normal y la aplica (ver onUpdateActor
  // más abajo). Cada solicitud usa una CLAVE nueva (no solo un valor nuevo
  // dentro del mismo objeto): si se repite el mismo holder, Foundry solo
  // manda a los demás clientes lo que realmente cambió, y un valor idéntico
  // al de la solicitud anterior no cuenta como cambio y se omite del aviso.
  // Con una clave nueva cada vez, el objeto completo siempre viaja entero.
  const hasEligibleRecipient = game.users.some(
    u => u.active && (u.isGM || holder.testUserPermission(u, "OWNER"))
  );
  if (!hasEligibleRecipient) {
    ui.notifications.warn(game.i18n.localize("REALLY-INSPIRED.Warning.NoGMForBorrow"));
    return;
  }
  const requestId = foundry.utils.randomID();
  await actingActor.update({
    [`flags.${MODULE_ID}.${FLAG_PENDING_BORROW}.${requestId}`]: { holderId: holder.id, amount }
  });
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

async function applyIndividualCount(actor, value) {
  const clamped = Math.clamp(value, 0, getMaxPerCharacter());
  try {
    await actor.setFlag(MODULE_ID, FLAG_COUNT, clamped);
  } catch (err) {
    console.error(`${MODULE_ID} | Failed to update inspiration flag for`, actor.name, err);
    return;
  }
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

  // Solicitudes de préstamo escritas en el actor de quien gasta (ver
  // spendFromGroup): cada una vive bajo su propia clave (ver por qué en
  // spendFromGroup). Por cada solicitud nueva en este update, si somos
  // responsables del personaje mencionado, aplicamos el descuento.
  const pendingBorrows = foundry.utils.getProperty(changes, `flags.${MODULE_ID}.${FLAG_PENDING_BORROW}`);
  if (pendingBorrows) {
    for (const request of Object.values(pendingBorrows)) {
      const holder = game.actors.get(request.holderId);
      if (holder && isResponsibleFor(holder)) {
        applySpendFromActorId(request.holderId, request.amount);
      }
    }
    return;
  }

  // Cambió el número de ALGÚN personaje: en modo compartido eso mueve el
  // total del grupo, así que cada cliente revisa si el checkbox vainilla de
  // sus propios personajes sigue reflejando ese total, y refresca cualquier
  // hoja que tenga abierta (el cambio pudo venir de un personaje distinto
  // al que se está viendo, y esa hoja no se re-renderiza sola por eso).
  const countChanged = foundry.utils.getProperty(changes, `flags.${MODULE_ID}.${FLAG_COUNT}`) !== undefined;
  if (countChanged && getPoolMode() === POOL_MODES.SHARED) {
    syncMyCharactersVanillaFlags();
    refreshOpenCharacterSheets();
  }

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
    spendFromGroup(1, actor);
  }
}

/** Re-renderiza cualquier hoja de personaje ya abierta, sin importar de quién. */
function refreshOpenCharacterSheets() {
  for (const actor of game.actors.filter(a => a.type === "character")) {
    if (actor.sheet?.rendered) actor.sheet.render();
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
