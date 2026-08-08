import { getCount, getMax, canAdjust, adjustCount, spendInspiration } from "./inspiration.mjs";

/**
 * Tidy5e Sheet (tema "quadrone") tiene su propia UI de "inspiración
 * bancada" (contador + botones), pero solo la activa si algún módulo le
 * registra de dónde sacar los datos. Si nadie lo hace, muestra su checkbox
 * normal de toda la vida. No hace falta tocar su HTML para nada — Tidy
 * dibuja su propio widget, nosotros solo le damos los números y la lógica.
 *
 * El tema "classic" (más viejo) de Tidy5e no tiene este gancho todavía; en
 * ese tema, Tidy sigue mostrando el checkbox vainilla sin cambios.
 */
export function registerTidy5eIntegration() {
  Hooks.on("tidy5e-sheet.ready", api => {
    api.config.actorInspiration.configureBankedInspiration({
      getData: (app, actor) => ({
        value: getCount(actor),
        max: getMax(actor)
      }),
      change: async (app, actor, delta) => {
        if (!canAdjust(actor)) return;
        if (delta > 0) await adjustCount(actor, delta);
        else if (delta < 0) await spendInspiration(actor, -delta);
      }
    });
  });
}
