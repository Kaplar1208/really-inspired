import { MODULE_ID } from "./constants.mjs";
import { registerSettings } from "./settings.mjs";
import { registerPoolActor } from "./pool-actor.mjs";
import { registerInspirationHooks } from "./inspiration.mjs";
import { registerSheetHooks } from "./sheet.mjs";
import { registerChatHooks } from "./chat.mjs";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing`);
  registerSettings();
  registerPoolActor();
  registerInspirationHooks();
  registerSheetHooks();
  registerChatHooks();
});
