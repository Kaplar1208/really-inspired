import { MODULE_ID } from "./constants.mjs";

let socket = null;

export function isSocketlibAvailable() {
  return game.modules.get("socketlib")?.active === true;
}

/**
 * Solo se usa para un caso puntual: cuando en modo compartido hay que
 * gastar la inspiración de un personaje que no es el propio. Sigue el
 * patrón estándar documentado por socketlib (engancharse a
 * "socketlib.ready" en vez de asumir un orden de carga entre módulos).
 */
export function registerSocketlibBridge(handlerFn) {
  if (!isSocketlibAvailable()) return;
  Hooks.once("socketlib.ready", () => {
    socket = socketlib.registerModule(MODULE_ID);
    socket.register("spendFromActor", handlerFn);
  });
}

export function getSocket() {
  return socket;
}
