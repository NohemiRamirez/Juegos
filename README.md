# 🏝️ El Secreto del Gran Archipiélago

Juego educativo en HTML/CSS/JS puro (sin instalaciones ni dependencias) para
practicar las tablas de multiplicar, pensado para niños de 9 a 11 años.

## Archivos

```
index.html    → estructura de todas las pantallas
style.css     → estilos visuales (paleta cálida tipo Ghibli/Stardew Valley)
script.js     → toda la lógica del juego
```

Imagenes: de momento se usan emojis, pero se usaran imagenes creadas por ia, o propias, no se busca generar ingresos o utilizar creaciones con derecho de autor sin permiso 

## Cómo se juega (resumen de la aventura)

1. **Pantalla de inicio**: elige niño o niña, se presenta la historia.
2. **Isla de la Semilla** 🌱: arrastra semillas para repartirlas en partes
   iguales entre los surcos (suma repetida / grupos iguales). 6 ejercicios.
3. **Puente colgante** 🌬️: mantener presionado el botón (o la barra
   espaciadora) para avanzar; si se suelta, el viento regresa al personaje
   al inicio.
4. **Templo de los Espejos** 🔮: se muestra una cuadrícula A×B ya construida
   y hay que llenar por completo la cuadrícula B×A tocando las casillas,
   demostrando visualmente que A×B = B×A. 5 ejercicios.
5. **Laberinto de piedra** 🌀: mover al personaje con flechas o los botones
   direccionales hasta la salida.
6. **Forja de los Elementos** ⚒️: se debe descomponer el segundo factor en
   dos partes (arrastrando "trozos de mineral" a dos casillas) y comprobar
   que la suma de los dos productos parciales da el resultado correcto
   (introducción a la propiedad distributiva). 5 ejercicios.
7. **Mar de las Rocas Flotantes** 🚤: mover el bote con las flechas
   izquierda/derecha esquivando obstáculos mientras avanza automáticamente.
8. **El Faro** 🏮: examen final de 10 multiplicaciones de opción múltiple.
   Al completarlas, ¡la niebla desaparece y el juego termina con la
   animación de victoria!

Cada isla se puede volver a jugar entrando otra vez desde el mapa (los
ejercicios se generan de nuevo al azar cada vez), así tu sobrina puede
practicar todo lo que quiera.

## Ideas para personalizar más adelante

- **Rangos de las tablas**: en `script.js`, cada isla genera sus números con
  `randInt(min, max)`. Por ejemplo, en la Isla de la Semilla:
  `i1.perHole = randInt(2, 9);` → cambia el `9` por `5` si quieres empezar
  solo con tablas más chicas.
- **Cantidad de ejercicios por isla**: son las constantes
  `I1_TOTAL_EXERCISES`, `I2_TOTAL_EXERCISES`, `I3_TOTAL_EXERCISES`,
  `I4_TOTAL_EXERCISES` al inicio de cada sección del archivo.
- **Arte propio**: si más adelante quieres reemplazar los emojis por
  dibujos/pixel art reales, lo más fácil es sustituir el `textContent` de los
  elementos (por ejemplo `seed.textContent = '🌱'`) por una imagen
  (`<img src="assets/semilla.png">`) o un `background-image` en `style.css`.
- **Guardar progreso**: actualmente el progreso se reinicia si se recarga la
  página. Se podría guardar en `localStorage` si quieres que continúe donde
  quedó la última vez.

¡Que disfrute la aventura! 🌟
