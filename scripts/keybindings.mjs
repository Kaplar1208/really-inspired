import { MODULE_ID } from "./constants.mjs";
import { adjustCount, getIndividualCount, getMaxPerCharacter } from "./inspiration.mjs";

export function registerKeybindings() {
  game.keybindings.register(MODULE_ID, "grantInspiration", {
    name: "REALLY-INSPIRED.Keybind.GrantInspiration.Name",
    hint: "REALLY-INSPIRED.Keybind.GrantInspiration.Hint",
    restricted: true,
    editable: [{ key: "KeyI" }],
    onDown: () => {
      openGrantDialog();
      return true;
    }
  });
}

async function openGrantDialog() {
  const characters = game.actors.filter(a => a.type === "character" && a.hasPlayerOwner);
  if (!characters.length) {
    ui.notifications.warn(game.i18n.localize("REALLY-INSPIRED.Warning.NoCharacter"));
    return;
  }

  const max = getMaxPerCharacter();
  const buttons = characters.map(actor => ({
    action: actor.id,
    label: `${actor.name} (${getIndividualCount(actor)}/${max})`
  }));

  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("REALLY-INSPIRED.GrantDialog.Title") },
    content: `<p>${game.i18n.localize("REALLY-INSPIRED.GrantDialog.Hint")}</p>`,
    buttons,
    rejectClose: false
  });
  if (!choice) return;

  const actor = characters.find(a => a.id === choice);
  if (!actor) return;

  if (getIndividualCount(actor) >= max) {
    ui.notifications.warn(game.i18n.format("REALLY-INSPIRED.Warning.AlreadyMax", { actor: actor.name }));
    return;
  }

  await adjustCount(actor, 1);

  await ChatMessage.create({
    speaker: { actor: actor.id, alias: actor.name },
    flavor: game.i18n.format("REALLY-INSPIRED.Chat.GrantedByGM", {
      actor: actor.name,
      remaining: getIndividualCount(actor),
      max
    })
  });
}
