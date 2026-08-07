import { MODULE_ID } from "./constants.mjs";
import { getCount, getMax, adjustCount } from "./inspiration.mjs";

export function registerChatHooks() {
  Hooks.on("getChatMessageContextOptions", addRerollOption);
}

function addRerollOption(html, options) {
  options.push({
    name: game.i18n.localize("REALLY-INSPIRED.Chat.RerollOption"),
    icon: '<i class="fas fa-dice-d20"></i>',
    condition: canRerollWithInspiration,
    callback: rerollWithInspiration,
    group: "really-inspired"
  });
}

/**
 * Ceder inspiración es una acción de jugador: el GM no tiene inspiración
 * propia que gastar aquí, así que la opción no se le muestra.
 */
function canRerollWithInspiration(li) {
  if (game.user.isGM) return false;

  const message = game.messages.get(li.dataset.messageId);
  if (!message?.rolls?.length) return false;
  if (!(message.rolls[0] instanceof game.dnd5e.dice.D20Roll)) return false;

  return getSpendableCharacters().length > 0;
}

async function rerollWithInspiration(li) {
  const message = game.messages.get(li.dataset.messageId);
  if (!message) return;

  if (!game.user.isGM && !game.users.activeGM) {
    ui.notifications.warn(game.i18n.localize("REALLY-INSPIRED.Warning.NoGM"));
    return;
  }

  const actingActor = await chooseSpendingCharacter();
  if (!actingActor) return;

  await adjustCount(actingActor, -1);
  ui.notifications.info(game.i18n.format("REALLY-INSPIRED.Chat.SpentNotification", {
    actor: actingActor.name,
    remaining: getCount(actingActor),
    max: getMax(actingActor)
  }));

  // Re-tira la MISMA fórmula ya resuelta del roll original: como los
  // modificadores del tirador original quedaron fijos como números en esa
  // fórmula, el reroll usa sus stats, no los de quien cede la inspiración.
  const newRoll = await message.rolls[0].reroll();

  const isSelf = actingActor.id === message.speaker.actor;
  const flavor = isSelf
    ? game.i18n.localize("REALLY-INSPIRED.Chat.RerollFlavorSelf")
    : game.i18n.format("REALLY-INSPIRED.Chat.RerollFlavorGranted", { actor: actingActor.name });

  await newRoll.toMessage({
    speaker: message.speaker,
    flavor: message.flavor ? `${message.flavor}<br>${flavor}` : flavor,
    flags: {
      [MODULE_ID]: { sourceMessageId: message.id, grantedBy: actingActor.id }
    }
  });
}

/** Personajes propios con al menos 1 de inspiración disponible para gastar. */
function getSpendableCharacters() {
  return game.actors.filter(a => a.type === "character" && a.isOwner && getCount(a) > 0);
}

/**
 * Resuelve con qué personaje se gasta la inspiración. Si el jugador solo
 * controla uno con inspiración disponible, se usa directo; si controla
 * varios (p. ej. una cuenta que juega dos PJs), se le pregunta cuál.
 */
async function chooseSpendingCharacter() {
  const candidates = getSpendableCharacters();
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const buttons = candidates.map(actor => ({
    action: actor.id,
    label: `${actor.name} (${getCount(actor)}/${getMax(actor)})`
  }));

  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("REALLY-INSPIRED.Chat.ChooseCharacter.Title") },
    content: `<p>${game.i18n.localize("REALLY-INSPIRED.Chat.ChooseCharacter.Hint")}</p>`,
    buttons,
    rejectClose: false
  });

  return candidates.find(a => a.id === choice) ?? null;
}
