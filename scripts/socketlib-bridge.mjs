import { MODULE_ID } from "./constants.mjs";

let socket = null;

export function isSocketlibAvailable() {
  return game.modules.get("socketlib")?.active === true;
}

/**
 * Solo se usa para un caso puntual: cuando en modo compartido hay que
 * gastar la inspiración de un personaje que no es el propio.
 *
 * socketlib dispara "socketlib.ready" DENTRO de su propio hook "init", de
 * forma síncrona (confirmado en su código fuente). Si el init de socketlib
 * corre antes que el nuestro, ese evento ya pasó cuando llegamos a
 * escucharlo, y un Hooks.once nunca repite eventos pasados — nos lo
 * perderíamos para toda la sesión. Por eso revisamos primero si
 * `window.socketlib` ya existe (se asigna justo antes de disparar el
 * hook) y solo esperamos el hook si todavía no está listo.
 */
export function registerSocketlibBridge(handlerFn) {
  if (!isSocketlibAvailable()) return;
  if (globalThis.socketlib) {
    setUpSocket(handlerFn);
  } else {
    Hooks.once("socketlib.ready", () => setUpSocket(handlerFn));
  }
}

/**
 * Nunca debe poder tumbar el resto del init del módulo si algo sale mal
 * (por ejemplo, socketlib.registerModule() devuelve undefined si el
 * manifiesto no declara "socket": true, o si socketlib cambia su API en
 * el futuro). Si falla, seguimos sin socketlib en vez de romper todo.
 */
function setUpSocket(handlerFn) {
  try {
    const registered = socketlib.registerModule(MODULE_ID);
    if (!registered) {
      console.warn(`${MODULE_ID} | socketlib.registerModule() did not return a socket; continuing without socketlib.`);
      return;
    }
    registered.register("spendFromActor", handlerFn);
    socket = registered;
  } catch (err) {
    console.warn(`${MODULE_ID} | Failed to set up socketlib integration; continuing without it.`, err);
  }
}

export function getSocket() {
  return socket;
}
