# Score Keeper

A two-player score keeper for your phone. The screen is split down the middle, one side per player, and it's laid out for landscape.

## Using it

- **Tap a side** to give that player a point. **−** takes one away.
- **Tap a name** to rename the player.
- The buttons in the middle: **undo**, **swap sides** (players keep their color), **reset** (tap it twice), and **full screen** (where the browser allows it).
- Scores are saved on the device, so a reload or a closed tab doesn't lose the game.
- The screen stays on while the board is open.

Holding the phone upright? The board turns itself sideways, so turn the phone and it reads correctly — even with rotation lock on.

**Add it to your home screen** for the best experience: on Android it opens full screen and locked to landscape; on iPhone it opens without the browser bars. After the first visit it also works offline.

On a computer: <kbd>←</kbd> / <kbd>→</kbd> add a point, <kbd>Shift</kbd> + arrow takes one away, <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Z</kbd> undoes.

## Running locally

Plain HTML, CSS and JavaScript: no build step, no dependencies.

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

To try it on your phone over Wi-Fi, run `python -m http.server 8000 --bind 0.0.0.0` and open `http://<your-computer's-IP>:8000` on the phone. Offline support and keep-screen-on need HTTPS, so those only work once it's deployed.

## Deploying

Any static host works (GitHub Pages, Netlify, Cloudflare Pages, …). Every path is relative, so it can live in a subfolder such as `username.github.io/score-keeper/`.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Markup |
| `style.css` | Layout, including the quarter turn in portrait |
| `app.js` | Scores, undo, saving, tap handling, full screen, keep-awake |
| `sw.js` | Offline cache (network first, so updates show up right away) |
| `manifest.webmanifest` | Home-screen settings: full screen, landscape, icons |
| `icons/` | App icons and favicon |
