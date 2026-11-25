# CodeFlow API

Pont entre l’app desktop, **Supabase** (comptes + progression) et **GitHub Releases** (mises à jour).

## Config

Copier `.env.example` → `.env` :

```
PORT=8787
SUPABASE_URL=https://xzxvuwvjaxrlgxywogiu.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxx
GITHUB_RELEASES_REPO=Lysacae/CodeFlow
```

Ne jamais committer `.env` / la clé secrète.

## Lancer

```bash
cd apps/server
npm install
npm run dev
```

## Publier une mise à jour

```bash
npm run publish-release -- 1.0.1 chemin/vers/CodeFlow_*_x64-setup.exe "Notes"
```

Cela crée une release sur `https://github.com/Lysacae/CodeFlow/releases`.

## Client

```bash
set VITE_CODEFLOW_API_URL=https://votre-api
```

Sans variable : `http://127.0.0.1:8787`.
