# Diewriter

A keyboard-driven interactive horror fiction game. Runs in the browser.

**[Play](https://jkopas0.github.io/diewriter/)**

## Controls

All navigation is done by typing — no mouse required.

| Input | Action |
|---|---|
| Type a menu item | Selects it when the full label matches |
| `Tab` | Autocompletes the current partial match |
| `Escape` | Cancel input / return to main menu |
| `←` / `→` | Scroll the achievements list |
| Any key | Advance dialogue |

## Settings

Accessible from the main menu.

- **Audio** — sound effects volume, background noise volume (e.g. type `sound effects 80%`)
- **Graphics** — film grain, chromatic aberration, scanlines (each toggleable)

## Running locally

No build step. Serve the `www/` directory with any static file server:

```sh
npx serve www
# or
python3 -m http.server --directory www
```

Then open `http://localhost:3000` (or whatever port the server reports).

## Tech

- Vanilla JS, no framework or bundler
- WebGL canvas (1280×640)
- Post-processing: chromatic aberration, film grain, scanlines
- Audio: Web Audio API via `<audio>` elements
