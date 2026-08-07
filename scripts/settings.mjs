import { MODULE_ID, SETTINGS, POOL_MODES } from "./constants.mjs";
import { isSocketlibAvailable } from "./socketlib-bridge.mjs";

export function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.POOL_MODE, {
    name: "REALLY-INSPIRED.Settings.PoolMode.Name",
    hint: "REALLY-INSPIRED.Settings.PoolMode.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      [POOL_MODES.SHARED]: "REALLY-INSPIRED.Settings.PoolMode.Shared",
      [POOL_MODES.INDIVIDUAL]: "REALLY-INSPIRED.Settings.PoolMode.Individual"
    },
    default: POOL_MODES.INDIVIDUAL,
    requiresReload: true
  });

  game.settings.register(MODULE_ID, SETTINGS.MAX_PER_CHARACTER, {
    name: "REALLY-INSPIRED.Settings.MaxPerCharacter.Name",
    hint: "REALLY-INSPIRED.Settings.MaxPerCharacter.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 1,
    range: { min: 1, max: 20, step: 1 }
  });

  game.settings.register(MODULE_ID, SETTINGS.PLAYERS_CAN_ADJUST, {
    name: "REALLY-INSPIRED.Settings.PlayersCanAdjust.Name",
    hint: "REALLY-INSPIRED.Settings.PlayersCanAdjust.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  // Solo existe cuando socketlib está disponible; ver shared-pool-backend.mjs.
  if (isSocketlibAvailable()) {
    game.settings.register(MODULE_ID, SETTINGS.SHARED_POOL_SETTING, {
      scope: "world",
      config: false,
      type: Number,
      default: 0
    });
  }
}

/**
 * Personajes de jugador que cuentan para el tope del pool compartido:
 * actores type=character con dueño jugador, sin importar cuántos
 * controle una misma cuenta.
 */
export function getPlayerCharacterCount() {
  return game.actors.filter(a => a.type === "character" && a.hasPlayerOwner).length;
}

export function getMaxSharedPool() {
  const maxPerCharacter = game.settings.get(MODULE_ID, SETTINGS.MAX_PER_CHARACTER);
  return maxPerCharacter * getPlayerCharacterCount();
}
