Claro. Aquí tienes un **guion por diapositivas**, pensado para exponer la presentación final de DSPLink en aproximadamente 10 minutos. La idea es que no leas cada bullet: usa cada diapositiva como apoyo visual y di estas ideas principales.

---

## Guion por diapositivas — Presentación DSPLink

### Diapositiva 1 — Portada

Buenos días. Hoy voy a presentar **DSPLink**, un sistema embebido para controlar un procesador digital de audio **ADAU1701**, montado en una tarjeta TSA1701, usando una **NUCLEO-F429ZI** como controlador principal.

La idea general es separar dos tareas: el procesamiento de audio en tiempo real queda en el DSP, mientras que el STM32 se encarga de inicializar, configurar, supervisar y modificar parámetros del sistema.

---

### Diapositiva 2 — Motivación del proyecto

El problema de fondo es que un DSP de audio no es simplemente un periférico más: necesita un programa, parámetros, registros de configuración y una secuencia de arranque coherente.

DSPLink busca convertir esa tarjeta DSP en un sistema embebido controlable: que pueda arrancar, cambiar presets, recibir entradas de usuario, actualizar parámetros y reportar errores de forma observable.

---

### Diapositiva 3 — Descripción general del sistema

El sistema tiene tres bloques principales: la **NUCLEO-F429ZI**, el **Multifunction Shield** y la tarjeta **TSA1701/ADAU1701**.

La NUCLEO actúa como controlador. El shield funciona como interfaz local: botones, display, LEDs y potenciómetro. Y la tarjeta TSA1701 ejecuta el procesamiento real de audio.

---

### Diapositiva 4 — Arquitectura: ruta de control y ruta de audio

Aquí es importante distinguir dos caminos.

La **ruta de audio** pasa por el ADAU1701: entrada analógica, procesamiento DSP y salida analógica. Esa ruta debe ser continua y en tiempo real.

La **ruta de control** pasa por el STM32: eventos de usuario, comunicación I2C/SPI, escritura de registros, actualización de parámetros y diagnóstico por UART.

Esta separación es la base del proyecto.

---

### Diapositiva 5 — ADAU1701 como núcleo de procesamiento

El ADAU1701 es un procesador de audio dedicado. Tiene ADCs, DACs, memoria de programa, memoria de parámetros y una interfaz de control.

Por eso no lo tratamos como un simple amplificador o codec. Lo tratamos como un subsistema programable que necesita una arquitectura de control alrededor.

---

### Diapositiva 6 — Bloque funcional del ADAU1701

En este diagrama se ve que el ADAU1701 integra varias partes: entradas analógicas, núcleo DSP, salidas analógicas, GPIO, interfaz de control y mecanismo de self-boot.

Esto justifica por qué DSPLink tiene varias responsabilidades: no basta con mandar un byte; hay que entender qué memoria, registro o función interna se está controlando.

---

### Diapositiva 7 — Diagrama de sistema ADAU1701

Este diagrama nos ayuda a ubicar el DSP en el sistema físico completo.

El ADAU1701 necesita alimentación, reloj, reset, señales analógicas y una interfaz de control. DSPLink se concentra en esa parte de control: arrancar el dispositivo, escribir configuración y actualizar parámetros mientras el audio sigue funcionando.

---

### Diapositiva 8 — Self-boot del ADAU1701

El ADAU1701 puede arrancar en modo **self-boot**, leyendo su programa y parámetros desde una EEPROM externa al liberar reset.

Eso significa que el DSP tiene cierta autonomía. Sin embargo, el self-boot por sí solo no da una interfaz flexible para supervisar, cambiar presets o diagnosticar fallas durante la operación.

---

### Diapositiva 9 — Self-boot con PC conectado

Esta figura es clave. Muestra cómo el PC, usando SigmaStudio, puede conectarse al bus I2C para programar la EEPROM del sistema.

En este modo, el computador se usa para cargar el diseño al sistema. Luego, cuando el PC se desconecta, el ADAU1701 puede arrancar desde la EEPROM.

DSPLink se ubica conceptualmente después de eso: permite que un STM32 tome el rol de supervisor y controlador en tiempo de ejecución.

---

### Diapositiva 10 — Self-boot vs DSPLink

Aquí la comparación es directa.

En self-boot puro, el ADAU1701 carga su configuración y opera con poca intervención externa.

En DSPLink, el STM32 agrega una capa de control: verifica el bus, aplica presets, responde a botones, actualiza parámetros, reporta errores y mantiene una máquina de estados.

Entonces DSPLink no reemplaza al DSP; lo convierte en parte de un sistema embebido controlado.

---

### Diapositiva 11 — Dirección y formato I2C del ADAU1701

Para controlar el DSP, el STM32 necesita escribir y leer por I2C.

La dirección depende de los bits de dirección y del bit de lectura/escritura. En la configuración base se usan direcciones como **0x68 para escritura** y **0x69 para lectura**.

Esto es importante porque el firmware debe saber construir correctamente cada transacción: dirección del chip, subdirección interna y datos.

---

### Diapositiva 12 — Operaciones I2C de escritura y lectura

Una escritura típica es:

**START → dirección con write → subdirección alta → subdirección baja → datos → STOP.**

Una lectura normalmente primero posiciona la subdirección y luego hace la lectura:

**START con write → subdirección → repeated START con read → datos → STOP.**

Esta diapositiva aterriza la comunicación: DSPLink no solo dice “uso I2C”; define cómo se accede realmente a memoria y registros.

---

### Diapositiva 13 — Temporización I2C

Aquí se muestran los diagramas temporales de lectura y escritura.

El valor de esta diapositiva es que la comunicación debe ser verificable. Si hay ACK, NACK, timeout o una condición de stop inesperada, eso no debe ocultarse. Debe convertirse en un estado o error observable.

Por eso `dsplink_bus` no debería ser una función suelta, sino una capa que controla transacciones, errores y reportes.

---

### Diapositiva 14 — Registros relevantes para DSPLink

Esta es una de las diapositivas más técnicas.

DSPLink usa varias regiones importantes: memoria de parámetros, registros de safeload, direcciones de safeload y el registro **0x081C**, que corresponde al control del núcleo DSP.

La idea principal es que cada dirección tiene un propósito. No son números mágicos: representan mecanismos concretos del ADAU1701.

---

### Diapositiva 15 — DSP Core Control, 0x081C

Este registro es importante porque participa en el control del núcleo y en la activación de ciertas operaciones internas.

Para la exposición no necesitamos memorizar todos los bits, pero sí explicar que este registro conecta el control externo con acciones internas del DSP.

En particular, al actualizar parámetros en tiempo real, el firmware debe coordinar datos, direcciones y control del núcleo para que el cambio se aplique de forma coherente.

---

### Diapositiva 16 — Safeload

Safeload es uno de los conceptos más importantes del proyecto.

Si escribimos parámetros directamente mientras el DSP está corriendo, podemos dejar el procesamiento en un estado intermedio. Por ejemplo, en un filtro o mezclador, cambiar solo parte de los coeficientes puede producir errores audibles.

Safeload permite cargar primero los datos en registros temporales y luego transferirlos de forma controlada. Así se actualizan parámetros sin detener el audio y reduciendo efectos indeseados.

---

### Diapositiva 17 — Flujo de actualización de parámetros

El flujo completo es:

el usuario mueve un potenciómetro o cambia un preset; el STM32 convierte ese valor a un formato compatible con el DSP; luego escribe los valores y direcciones de safeload; finalmente activa la transferencia hacia la memoria de parámetros.

Este flujo muestra la cadena completa entre interfaz física y acción interna del ADAU1701.

---

### Diapositiva 18 — Multifunction Shield

El Multifunction Shield es la interfaz local del sistema.

Los botones sirven para seleccionar o confirmar acciones. El potenciómetro puede modificar un parámetro. Los LEDs y el display muestran estado, preset o error.

Lo importante es que estas señales físicas se convierten en eventos de software.

---

### Diapositiva 19 — GPIO, debounce y entradas físicas

Esta diapositiva conecta la interfaz local con el diseño embebido.

Un botón físico no produce directamente una decisión del sistema. Primero hay que leerlo, filtrar rebotes, convertirlo en evento y entregarlo a la FSM.

Por eso conceptos como debounce, entrada GPIO, ADC auxiliar o salida LED son relevantes para explicar cómo una interacción física se vuelve comportamiento del sistema.

---

### Diapositiva 20 — Estructura del firmware

Aquí explicamos los módulos principales.

`main.c` inicializa el sistema y ejecuta el lazo principal.
`dsplink_bus` maneja I2C/SPI.
`dsplink_boot` maneja el arranque del DSP.
`dsplink_state` organiza el estado global.
`dsplink_presets` aplica modos de audio.
`dsplink_params` convierte y escribe parámetros.
`mfs` maneja la interfaz local.
`uart_debug` entrega evidencia y diagnóstico.

La arquitectura está separada por responsabilidades.

---

### Diapositiva 21 — Flujo de arranque del firmware

El arranque sigue una secuencia lógica.

Primero se inicializa HAL, reloj, UART, MFS e I2C. Luego se escanea o verifica el bus. Después se intenta inicializar o configurar el DSP. Si todo sale bien, el sistema entra a READY. Si falla, entra a ERROR.

Esta secuencia evita que el sistema actúe como si el DSP estuviera listo cuando realmente no lo está.

---

### Diapositiva 22 — Parser o carga de imagen de self-boot

Aquí aparece una idea más cercana al código: el firmware puede interpretar comandos o datos exportados desde el flujo de SigmaStudio.

La importancia de esto es que el programa del DSP no se inventa manualmente byte por byte. Proviene de una herramienta de diseño de audio, y el STM32 necesita una forma ordenada de transferir esa configuración.

DSPLink sirve como puente entre la representación generada para el DSP y la ejecución embebida.

---

### Diapositiva 23 — Modelo formal de FSM

La FSM se define como:

**M = (S, E, A, δ, s₀).**

Esto significa: conjunto de estados, eventos, acciones, función de transición y estado inicial.

En DSPLink, estados como INIT, BUS_CHECK, DSP_BOOT, READY, PRESET_ACTIVE, PARAM_UPDATE y ERROR representan modos reales del sistema, no simples nombres decorativos.

---

### Diapositiva 24 — Diagrama FSM

Aquí se ve el comportamiento reactivo.

El sistema arranca en INIT, verifica el bus, intenta arrancar el DSP y llega a READY. Desde READY puede cambiar presets, actualizar parámetros o entrar a error.

La transición importante es que cada evento tiene una consecuencia clara. Por ejemplo, un error de bus no se ignora: lleva al sistema a ERROR.

---

### Diapositiva 25 — Estado, UI y parámetros

Esta diapositiva conecta botones, potenciómetro y presets.

Un botón puede seleccionar el siguiente preset. Otro puede activar bypass. El potenciómetro puede cambiar un valor continuo. Pero esos cambios no se aplican directamente de forma caótica: pasan por validación, conversión y finalmente por safeload.

Así el sistema mantiene orden entre entrada física, estado lógico y escritura al DSP.

---

### Diapositiva 26 — Trazabilidad

Esta es una diapositiva clave para defender el proyecto.

La cadena es:

**señal física → driver → evento → estado → acción → evidencia.**

Por ejemplo: botón físico → módulo MFS → evento de preset → FSM → `dsplink_presets` → escritura I2C/safeload → UART/display/audio como evidencia.

Si puedo explicar esa cadena, entonces el proyecto no es solo código: es un sistema embebido trazable.

---

### Diapositiva 27 — Requerimientos verificables

Los requerimientos deben poder probarse.

Por ejemplo: el sistema debe inicializar el DSP; debe reportar error si no hay comunicación; debe cambiar de preset con una entrada física; debe actualizar parámetros; debe mostrar evidencia por UART o interfaz local.

Cada requerimiento tiene que tener un criterio de aceptación. No basta con decir “funciona”; hay que decir cómo se comprueba.

---

### Diapositiva 28 — Plan de validación

Aquí aparecen las pruebas.

Una prueba es de arranque: verificar que el sistema llega a READY.
Otra es de comunicación: comprobar escritura o lectura I2C.
Otra es de interfaz: presionar botón y observar cambio de preset.
Otra es de parámetros: mover potenciómetro y ver actualización.
Y otra es de error: simular falla del bus y verificar que el sistema entra a ERROR.

La validación convierte el diseño en evidencia.

---

### Diapositiva 29 — Características de desempeño del ADAU1701

Esta diapositiva no significa que ya medimos el desempeño final del sistema. Es una referencia del componente.

El ADAU1701 está diseñado para audio: tiene ADCs, DACs, filtros internos y procesamiento dedicado. Eso justifica por qué el procesamiento en tiempo real se deja al DSP y no al STM32.

La NUCLEO controla; el ADAU1701 procesa.

---

### Diapositiva 30 — Conclusiones

Para cerrar, DSPLink es un sistema embebido que integra hardware real, protocolo de comunicación, firmware modular, FSM y validación.

El aporte principal no es solo escribir registros del ADAU1701. El aporte es construir una arquitectura completa: arranque, control, interfaz, actualización segura de parámetros, manejo de errores y evidencia observable.

En resumen: DSPLink muestra cómo una señal física puede producir un evento, cómo ese evento cambia el estado del sistema, cómo ese estado genera una acción sobre el DSP y cómo esa acción se valida con evidencia real.
