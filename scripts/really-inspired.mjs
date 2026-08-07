import { MODULE_ID } from "./constants.mjs";
import { registerSettings } from "./settings.mjs";
import { registerSocket } from "./socket.mjs";
import { registerInspirationHandlers } from "./inspiration.mjs";
import { registerSheetHooks } from "./sheet.mjs";
import { registerChatHooks } from "./chat.mjs";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing`);
  registerSettings();
  registerInspirationHandlers();
  registerSheetHooks();
  registerChatHooks();
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Ready`);
  registerSocket();
});
