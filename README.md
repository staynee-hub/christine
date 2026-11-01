# Family Recipe Book (iPhone app)

A home-screen app for iPhone, ported from the Family Recipe Book Claude artifact. You can search, filter, add, edit and delete recipes, and it works offline.

The app is in `docs/`. It is a web app (PWA): you install it from Safari with **Add to Home Screen**, so it needs no App Store, Mac or developer account.

## Privacy: no recipe data lives in this repo

This repository is **public**, so it contains only the app code. Your recipes are stored on your phone, in the app's own storage. The recipe file you import is never committed: `private/` is gitignored.

## One-time setup

1. **Publish the app with GitHub Pages.** Merge this branch into `main`. On GitHub, open the repo's **Settings → Pages**, set *Source* to **Deploy from a branch**, then pick branch `main` and folder `/docs` and save. After a minute the app is live at `https://staynee-hub.github.io/christine/`.
2. **Install it on your iPhone.** Open that link in **Safari**. Other browsers won't work for this. Tap **Share → Add to Home Screen**, then open the app from the new **Recipes** icon.
3. **Load your recipes.** Save `family-recipes.json` to the Files app. Then, in the app, tap **•••**, then **Import file**, and pick it.

## Day to day

- **Add a recipe:** tap the **+** button.
- **Search:** each word you type is matched separately, so `chicken air` finds air-fryer chicken dishes.
- **Back up:** tap **•••**, then **Export backup**, then **Save to Files**. Do this now and then. If you delete the app from your Home Screen, its recipes are deleted with it.
- **Bring in recipes Claude added to the artifact:** ask Claude for a fresh export of the artifact's recipes, then import that file. Importing matches recipes by ID and keeps whichever copy was edited last. It never deletes anything.

## Updating the app

Edit the files in `docs/`, then bump `CACHE` in `docs/sw.js` (for example `recipes-v2`) so phones download the new version. Your recipes are not affected.
