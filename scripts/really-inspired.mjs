import { MODULE_ID } from "./constants.mjs";
import { registerSettings } from "./settings.mjs";
import { registerInspirationHooks } from "./inspiration.mjs";
import { registerSheetHooks } from "./sheet.mjs";
import { registerChatHooks } from "./chat.mjs";
import { registerKeybindings } from "./keybindings.mjs";
import { registerTidy5eIntegration } from "./tidy5e.mjs";

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing`);
  registerSettings();
  registerInspirationHooks();
  registerSheetHooks();
  registerChatHooks();
  registerKeybindings();
  registerTidy5eIntegration();
});
