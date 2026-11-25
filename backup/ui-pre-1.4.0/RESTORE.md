# Restaurer l'interface d'avant la 1.4.0

Cette copie est l'UI CodeFlow **avant** la refonte Piste C (Theme C), au moment de la 1.3.4.

Le commit git correspondant est étiqueté `ui-pre-1.4.0` (HEAD d'avant les changements 1.4.0).

## Contenu

- `styles/` — `index.css`, `tokens.css`
- `app/` — coquille et routeur
- `shared/ui/` — boutons, cartes, champs
- `features/` — écrans
- `App.tsx`, `main.tsx`

## Restaurer les fichiers

Depuis la racine du dépôt :

```powershell
$src = "backup\ui-pre-1.4.0"
$dst = "apps\desktop\src"
Copy-Item -Force "$src\styles\*" "$dst\styles\"
Copy-Item -Recurse -Force "$src\app\*" "$dst\app\"
Copy-Item -Recurse -Force "$src\shared\ui\*" "$dst\shared\ui\"
Copy-Item -Recurse -Force "$src\features\*" "$dst\features\"
Copy-Item -Force "$src\App.tsx" "$dst\App.tsx"
Copy-Item -Force "$src\main.tsx" "$dst\main.tsx"
```

Puis recompiler (`npm run tauri build` dans `apps/desktop`).

## Restaurer via git

```powershell
git checkout ui-pre-1.4.0 -- apps/desktop/src/styles apps/desktop/src/app apps/desktop/src/shared/ui apps/desktop/src/features apps/desktop/src/App.tsx apps/desktop/src/main.tsx
```

Cela ramène uniquement ces chemins. Le mode maintenance, la version et les commandes ajoutées en 1.4.0 restent dans les autres fichiers tant qu'on ne revient pas sur tout le commit.

Pour retrouver l'arbre complet d'avant la refonte : `git switch --detach ui-pre-1.4.0` (lecture seule) ou créer une branche à partir de ce tag.
