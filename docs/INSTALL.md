# Installation de CodeFlow

## Prérequis de développement

- Windows 10/11
- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) (rustc / cargo)
- WebView2 (inclus sur Windows 11 ; installé automatiquement sur Windows 10 si besoin)

## Lancer en développement

```bash
cd apps/desktop
npm install
npm run tauri:dev
```

## Construire l'installateur Windows

```bash
cd apps/desktop
npm run tauri:build
```

L'installateur NSIS est généré dans `apps/desktop/src-tauri/target/release/bundle/nsis/`.

## Environnements de programmation

CodeFlow exécute réellement le code de l'utilisateur. Au premier lancement, l'écran **Environnements de programmation** détecte les outils présents et propose leur installation via `winget`.

| Runtime | Paquet winget | Usage |
|---------|---------------|--------|
| Python 3.12 | `Python.Python.3.12` | Exécution `.py` |
| .NET SDK 8 | `Microsoft.DotNet.SDK.8` | Compilation / exécution C# |
| LLVM-MinGW | `MartinStorsjo.LLVM-MinGW.UCRT` | Compilation C++ (`g++` / `clang++`) |
| Temurin JDK 21 | `EclipseAdoptium.Temurin.21.JDK` | Compilation / exécution Java |

### Installation manuelle (si winget est indisponible)

1. Python : https://www.python.org/downloads/ — cocher « Add python.exe to PATH »
2. .NET SDK : https://dotnet.microsoft.com/download
3. C++ : installer LLVM-MinGW ou MinGW-w64 et ajouter le dossier `bin` au PATH
4. JDK : https://adoptium.net/

Après installation, **redémarrez CodeFlow** pour recharger le PATH.

### Vérification rapide

```powershell
python --version
dotnet --version
g++ --version
javac -version
java -version
```

## Données utilisateur

- Base de progression : `%LOCALAPPDATA%\CodeFlow\codeflow.db`
- Projets sauvegardés : `%LOCALAPPDATA%\CodeFlow\projects\`
- Sandbox d'exécution : `%LOCALAPPDATA%\CodeFlow\sandbox\`

## Sécurité d'exécution

Chaque exécution écrit le code dans un dossier temporaire isolé, applique un délai maximum (10 s par défaut) et capture stdout/stderr. Aucune exécution n'est déléguée à un serveur distant.
