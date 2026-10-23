---
name: clima
description: Consulta la temperatura y el estado del clima actual de una ciudad (por defecto Chiclayo, Perú) usando Open-Meteo. Úsala cuando el usuario pida el clima, la temperatura o "cómo está el tiempo".
argument-hint: "[ciudad]"
allowed-tools: Bash(curl *)
---

# Clima local

Obtiene el clima actual desde Open-Meteo (gratis, sin API key). Responde siempre en español.

## Pasos

1. **Ciudad**: usa `$ARGUMENTS`; si está vacío, usa Chiclayo, Perú.
2. **Coordenadas**:
   - Chiclayo: latitud `-6.7714`, longitud `-79.8409`, zona horaria `America/Lima`.
   - Otra ciudad: resuélvela con
     `curl -s "https://geocoding-api.open-meteo.com/v1/search?name=<ciudad>&count=1&language=es"`
     y toma `latitude`, `longitude` y `timezone` del primer resultado.
3. **Clima actual**:
   ```
   curl -s "https://api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lon>&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,cloud_cover,wind_speed_10m&timezone=<tz URL-encoded>"
   ```
4. **Interpreta `weather_code`** (WMO):
   - 0 despejado · 1 mayormente despejado · 2 parcialmente nublado · 3 cielo cubierto
   - 45, 48 niebla
   - 51–57 llovizna · 61–67 lluvia · 71–77 nieve · 80–82 chubascos
   - 95–99 tormenta eléctrica
5. **Responde** con este formato:

   **<Ciudad>, <fecha y hora local>**
   - **Temperatura:** X °C (sensación térmica Y °C)
   - **Estado:** <descripción del código>, nubosidad Z %
   - **Humedad:** H %
   - **Viento:** V km/h

   Termina con la fuente: [Open-Meteo](https://open-meteo.com/).

## Notas

- Si la petición falla o no devuelve `current`, dilo claramente; no inventes datos ni uses pronósticos viejos.
- Es una lectura puntual. Para repetirla periódicamente, combínala con `/loop` (p. ej. `/loop 10m /clima`).
