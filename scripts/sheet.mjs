import { MODULE_ID } from "./constants.mjs";
import { getCount, getMax, canAdjust, adjustCount } from "./inspiration.mjs";

const TEMPLATE = `modules/${MODULE_ID}/templates/inspiration-widget.hbs`;

export function registerSheetHooks() {
  Hooks.on("renderActorSheetV2", onRenderActorSheet);
}

async function onRenderActorSheet(app, html) {
  const actor = app.actor;
  if (actor?.type !== "character") return;

  const root = html instanceof HTMLElement ? html : html[0];
  const header = root.querySelector("header.sheet-header .right");
  if (!header) return;

  root.querySelector("button.inspiration, .inspiration.unbutton")?.remove();
  root.querySelector(".really-inspired-widget")?.remove();

  const widget = await buildWidget(actor);
  header.insertBefore(widget, header.firstElementChild);
}

async function buildWidget(actor) {
  const current = getCount(actor);
  const max = getMax(actor);
  const adjustable = canAdjust(actor);

  const html = await foundry.applications.handlebars.renderTemplate(TEMPLATE, {
    current,
    max,
    canAdjust: adjustable,
    canIncrement: adjustable && current < max,
    canDecrement: adjustable && current > 0
  });

  const template = document.createElement("template");
  template.innerHTML = html.trim();
  const widget = template.content.firstElementChild;

  widget.querySelector(".ri-increment")?.addEventListener("click", () => adjustCount(actor, 1));
  widget.querySelector(".ri-decrement")?.addEventListener("click", () => adjustCount(actor, -1));

  return widget;
}
