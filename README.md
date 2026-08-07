# Really Inspired

Módulo para Foundry VTT que gestiona la Inspiración de D&D5e, con soporte para un pool compartido entre todo el grupo o un contador individual por personaje.

## Requisitos

- Foundry VTT v13+
- Sistema dnd5e v3+

## ¿Qué hace?

### Modo de Inspiración: individual o compartido

Desde **Configurar Ajustes**, el GM elige cómo se maneja la Inspiración en la mesa:

- **Individual**: cada personaje tiene su propio contador, como en las reglas estándar.
- **Compartido**: hay un único "pool" de Inspiración para todo el grupo. Cualquier personaje puede usar de ese pool común, y lo que gasta uno lo gastan todos.

También se configura el **máximo de Inspiración por personaje**. En modo compartido, el máximo del pool se calcula automáticamente como ese número multiplicado por la cantidad de personajes de los jugadores.

### Un contador visible en la hoja de personaje

En vez del pequeño ícono de Inspiración de siempre (que solo se puede marcar o desmarcar), la hoja de personaje muestra un contador claro con el número actual y el máximo, más botones para sumar o restar. Por defecto solo el GM puede usarlos, pero hay una opción para permitir que los jugadores también ajusten su propia Inspiración.

### Ceder Inspiración desde el chat

Cuando alguien hace una tirada (de habilidad, salvación o ataque), cualquier jugador puede hacer **click derecho sobre ese mensaje del chat** y elegir **"Tirar con inspiración"**. Eso gasta 1 de inspiración de quien hizo click (no de quien tiró los dados) y genera una tirada nueva para repetir esa prueba, usando siempre los modificadores del personaje que tiró originalmente. Así, un jugador puede "regalarle" una repetición a otro compañero usando su propia Inspiración.

### El GM puede otorgar Inspiración con un atajo de teclado

Presionando la tecla **"I"**, el GM abre un pequeño diálogo para elegir a qué personaje darle 1 de Inspiración, sin tener que ir a buscar su hoja. El grupo se entera por un mensaje en el chat.

### Compatible con la Inspiración normal del sistema

El módulo mantiene sincronizado el indicador de Inspiración normal de dnd5e por si algún otro módulo o automatización de reglas lo usa: si el contador de un personaje tiene 1 o más, ese indicador aparece activo; si llega a 0, aparece desactivado.

## Idioma

La interfaz está traducida a **español e inglés**, y se ajusta automáticamente según el idioma configurado por cada usuario en Foundry (Configuración > Idioma) — no hace falta ninguna configuración adicional por parte del GM.
