import { MODULE_ID } from "./constants.mjs";
import { getCount, getMax, canAdjust, adjustCount, spendInspiration, getIndividualCount, getMaxPerCharacter } from "./inspiration.mjs";

const TEMPLATE = `modules/${MODULE_ID}/templates/inspiration-widget.hbs`;

export function registerSheetHooks() {
  Hooks.on("renderActorSheetV2", onRenderActorSheet);

  // Cambiar poolMode/maxPerCharacter/playersCanAdjust en Configurar Ajustes
  // no toca ningún actor, así que no dispara el auto-render de las hojas
  // abiertas por sí solo. Forzamos ese refresco a mano aquí.
  Hooks.on("updateSetting", setting => {
    if (!setting.key?.startsWith(`${MODULE_ID}.`)) return;
    for (const actor of game.actors.filter(a => a.type === "character")) {
      if (actor.sheet?.rendered) actor.sheet.render();
    }
  });
}

async function onRenderActorSheet(app, html) {
  const actor = app.actor;
  if (actor?.type !== "character") return;

  // renderActorSheetV2 es genérico: dispara para CUALQUIER hoja de
  // personaje basada en ApplicationV2, no solo la de dnd5e. Módulos como
  // Tidy5e Sheet reusan nombres de clase parecidos ("sheet-header",
  // "inspiration"), así que sin este chequeo terminaríamos borrando y
  // reemplazando la UI de OTRO módulo por accidente. Solo actuamos si es
  // realmente la hoja por defecto de dnd5e.
  if (app.constructor.name !== "CharacterActorSheet") return;

  const root = html instanceof HTMLElement ? html : html[0];
  const header = root.querySelector("header.sheet-header");
  if (!header) return;

  root.querySelector("button.inspiration, .inspiration.unbutton")?.remove();
  root.querySelector(".really-inspired-widget")?.remove();

  // Insertado como overlay del header (no dentro de .right): esa columna usa
  // flex-direction:column con hijos posicionados por variables CSS muy
  // específicas (nivel, insignia de gestas, botones de descanso). Meter un
  // bloque normal ahí empuja todo lo demás. El propio header ya es
  // position:relative, así que anclamos el widget de forma independiente.
  const widget = await buildWidget(actor);
  header.appendChild(widget);
}

async function buildWidget(actor) {
  const current = getCount(actor);
  const max = getMax(actor);
  const adjustable = canAdjust(actor);

  // "+" siempre otorga a ESTE personaje: además de no pasarse del máximo
  // mostrado (el del grupo en modo compartido), tampoco puede pasarse del
  // tope individual de este personaje en concreto.
  const canIncrement = adjustable && current < max && getIndividualCount(actor) < getMaxPerCharacter();
  const canDecrement = adjustable && current > 0;

  const html = await foundry.applications.handlebars.renderTemplate(TEMPLATE, {
    current,
    max,
    canAdjust: adjustable,
    canIncrement,
    canDecrement
  });

  const template = document.createElement("template");
  template.innerHTML = html.trim();
  const widget = template.content.firstElementChild;

  widget.querySelector(".ri-increment")?.addEventListener("click", () => adjustCount(actor, 1));
  widget.querySelector(".ri-decrement")?.addEventListener("click", () => spendInspiration(actor, 1));

  return widget;
}
