import { MODULE_ID } from "./constants.mjs";
import { getCount, adjustCount } from "./inspiration.mjs";

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

  const actingActor = getActingCharacter();
  if (!actingActor) return false;

  return getCount(actingActor) > 0;
}

async function rerollWithInspiration(li) {
  const message = game.messages.get(li.dataset.messageId);
  if (!message) return;

  const actingActor = getActingCharacter();
  if (!actingActor) {
    ui.notifications.warn(game.i18n.localize("REALLY-INSPIRED.Warning.NoCharacter"));
    return;
  }

  if (!game.users.activeGM) {
    ui.notifications.warn(game.i18n.localize("REALLY-INSPIRED.Warning.NoGM"));
    return;
  }

  await adjustCount(actingActor, -1);

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

function getActingCharacter() {
  return game.user.character
    ?? game.actors.find(a => a.type === "character" && a.isOwner)
    ?? null;
}
