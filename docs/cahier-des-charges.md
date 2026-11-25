# Cahier des charges — CodeFlow

**Produit :** CodeFlow 1.3.0  
**Identifiant :** `com.codeflow.desktop`  
**Date du document :** 25 novembre 2026  
**Nature :** spécification de l’état livré (application, contenu, distribution). Ce n’est pas une feuille de route.

Le texte décrit ce que le dépôt et les notes de version publiques mettent en œuvre. Lorsqu’un point n’est pas tranché par le code ou par une note GitHub, il est signalé comme tel.

Sources utilisées : application bureau (`apps/desktop`), contenu (`content/tracks`), serveur du dépôt (`apps/server`), dossier portable, guide `docs/INSTALL.md`, et notes des releases [Lysacae/CodeFlow](https://github.com/Lysacae/CodeFlow/releases) de la v1.0.0 à la v1.3.0.

### Ajouts 1.3.0

- Refonte pédagogique des quatre parcours : objectif, prérequis, exemple, résultat et récapitulatif. Les sorties attendues et les programmes de départ des exercices sont conservés. Vingt-cinq contrôles anti-triche ont été renforcés.
- Révision espacée (échecs, indices, solutions, maîtrise). Une seule réussite ne maîtrise pas une notion.
- Journal des erreurs réel, avec reprise de l'exercice.
- Pas à pas : trace Python complète (lignes, variables, appels). C#, C++ et Java enregistrent des lignes réellement exécutées quand l'instrumentation compile, sans lire les variables.

Le reste de ce cahier décrit l'état accumulé jusqu'à la 1.2.0. Les points ci-dessus s'y ajoutent.

## Sommaire

1. [Présentation](#1-présentation)
2. [Objectifs](#2-objectifs)
3. [Périmètre](#3-périmètre)
4. [Architecture](#4-architecture)
5. [Fonctionnalités](#5-fonctionnalités)
6. [Contenu pédagogique](#6-contenu-pédagogique)
7. [Exigences techniques](#7-exigences-techniques)
8. [Historique des versions](#8-historique-des-versions)
9. [Bugs connus et corrigés](#9-bugs-connus-et-corrigés)
10. [Contraintes et règles de release](#10-contraintes-et-règles-de-release)
11. [Glossaire](#11-glossaire)

---

## 1. Présentation

CodeFlow est une application Windows de bureau pour apprendre à programmer en **Python**, **C#**, **C++** et **Java**. L’élève lit des leçons en français, écrit dans un éditeur, exécute le programme sur sa machine, et avance dans un parcours verrouillé leçon par leçon.

Le compte (pseudo, mot de passe, photo facultative), la progression, les projets, les amis et la messagerie sont synchronisés via Supabase. L’expérience, le rang et 71 succès suivent le compte. Au lancement, si une release GitHub plus récente existe, une fenêtre propose de l’installer. Tant que cette mise à jour n’est pas installée, une icône de téléchargement reste visible à côté des paramètres.

Deux distributions existent :

- l’installateur NSIS `CodeFlow_*_x64-setup.exe` ;
- la version portable, lancée par `portable/Lancer-CodeFlow.bat`, qui place devant le `PATH` les runtimes livrés dans `portable/runtimes`.

L’interface de l’application est en français. L’éditeur Windows peut signaler un éditeur non vérifié : le README oriente alors vers la version portable, ou vers une autorisation manuelle de l’application.

## 2. Objectifs

### Pédagogiques

- Faire écrire et exécuter du vrai code, avec la sortie réelle de l’interpréteur ou du compilateur. L’exécution n’est pas simulée.
- Couvrir, pour chaque langage, trois chapitres : bases, structures utiles, puis un projet de ticket de caisse. Les chapitres 2 et 3, ainsi que les exercices tardifs du chapitre 1, expliquent la notion avant de demander le geste.
- Vérifier les exercices par comparaison exacte de la sortie, et, quand la leçon l’exige, par la structure du programme. Afficher le texte attendu sans la notion enseignée ne suffit pas.
- Proposer une série de questions à choix multiples, chronométrée, à part des leçons. La première maîtrise rapporte de l’expérience ; les répétitions en rapportent beaucoup moins.
- Expliquer une erreur par un assistant local, en trois paliers, en bas de la leçon, sans service d’intelligence artificielle distant.

### Produit

- Un compte par personne, réutilisable après réinstallation : progression, projets, amis et messages reviennent avec le pseudo.
- Une installation des langages depuis l’application (winget), un par un ou tous ensemble, et une édition portable qui embarque déjà les runtimes.
- Un classement entre comptes : progression, réussite des questions, temps pour finir les quatre séries. Chaque ligne ouvre le profil public, avec le bouclier de rang.
- Des mises à jour depuis GitHub Releases, installées par l’application, avec un récapitulatif des versions sautées et un rappel visuel tant que l’installation n’est pas faite.
- Une interface sobre, quatre thèmes, un mode Focus pendant les exercices, des amis, une messagerie, et une progression par rangs.

## 3. Périmètre

### Dans le périmètre livré

- Windows 10 et 11, processeur x64.
- Quatre langages, leçons, exercices, création d’un premier fichier, questions/réponses.
- Compte cloud, photo, changement de mot de passe, suppression de compte, récupération locale.
- Carnet de programmes, synchronisation cloud, réinstallation d’un projet sur un autre PC.
- Détection, installation et désinstallation des runtimes, y compris en lot.
- Classement, thèmes, mode Focus, mises à jour automatiques, icône de mise à jour disponible.
- Amis, demandes, blocage, messagerie (lecture, réactions, émojis, saisie en cours).
- Profil public, expérience, douze rangs, 71 succès.
- Tutoriel obligatoire une fois par compte, rouvert depuis la page du langage.
- Compte technique interne `DevTesting` (onglet Admin, journaux, leçons déverrouillées).

### Hors périmètre

- macOS, Linux, téléphone, tablette.
- Exécution du code sur un serveur. Le bac à sable est local.
- Cours dans une autre langue que le français.
- Tuteur conversationnel branché sur un modèle distant. L’assistant lit la sortie du compilateur et des règles locales.
- Espace public d’administration. L’onglet Admin n’apparaît que pour le pseudo `DevTesting`.
- Signature de code de l’éditeur. L’avertissement Windows « éditeur non vérifié » reste un cas prévu.
- Réglage de l’objectif quotidien dans l’interface. Le champ `dailyGoal` existe dans la progression (valeur par défaut 3) et se synchronise, sans écran pour le modifier. Le succès « Ambitieux » exige pourtant une valeur d’au moins 5 : il n’est pas atteignable depuis l’écran actuel.
- Signalement transmis à une modération. Le bouton affiche une confirmation locale et n’appelle aucun service. Voir la section 5.10.

Le serveur Express `apps/server` est dans le dépôt (pont documenté, script de publication de release). Le client livré ne l’appelle pas : il parle à Supabase et à l’API GitHub depuis le processus Rust.

## 4. Architecture

```text
CodeFlow.exe (Tauri 2)
  interface React 19 + Vite + Tailwind
  commandes Rust
        |                         |
        v                         v
  SQLite locale              Supabase Auth
  %LOCALAPPDATA%\CodeFlow    comptes, progression, projets,
        |                    amis, messages (app_metadata)
        +-- exécution locale (python, dotnet, g++, javac/java)
        +-- winget (installation des runtimes)
        +-- GitHub Releases Lysacae/CodeFlow (mises à jour)
```

### Poste de travail

| Élément | Rôle |
| --- | --- |
| Tauri 2 | Fenêtre native, commandes, installeur NSIS |
| React 19, React Router 7, Zustand | Écrans et état |
| Monaco | Éditeur de code |
| Tailwind 4 | Styles et thèmes |
| SQLite (`rusqlite`, bibliothèque embarquée) | Session locale, progression, programmes |
| `ureq` | Appels HTTPS vers Supabase et GitHub |

La fenêtre s’ouvre en 1280 × 840, minimum 960 × 640. Le maximum déclaré dans la configuration est 3840 × 2160 ; à l’exécution il est ramené à la zone de travail du moniteur, et recalculé quand la fenêtre se déplace ou quand l’échelle d’affichage change. Le document web est calé sur la taille intérieure de la fenêtre, pour éviter qu’elle s’étire hors de l’écran.

Après un Alt+Tab, ou quand une fenêtre élevée (droits administrateur) ne reçoit pas le rappel du shell, le processus force lui-même la restauration : `ShowWindow` en mode restauration, puis premier plan. Si Windows a laissé la fenêtre hors écran ou minuscule, elle est ramenée à 1280 × 840 et recentrée. Perdre le focus ne masque pas la fenêtre. Une taille 0 × 0, qui correspond à la réduction, n’est pas envoyée à la webview.

Le menu contextuel du navigateur intégré (WebView2), celui de Monaco, et le clic droit sur la page sont désactivés.

### Données locales

Tout est sous `%LOCALAPPDATA%\CodeFlow\` :

| Fichier ou dossier | Contenu |
| --- | --- |
| `codeflow.db` | Utilisateur actif, jetons, leçons, exercices, historique, programmes, thème, drapeau d’onboarding |
| `projects\` | Fichiers de projets |
| `sandbox\` | Dossier temporaire d’une exécution |
| `.codeflow-recovery.json` | Pseudo et mot de passe du dernier compte utilisé sur ce PC, fichier masqué |

Le navigateur intégré garde aussi, par compte, un cache de progression (`cf-prog-…`) et la liste locale des identifiants bloqués (`cf-blocked-…`).

Une base déjà utilisée (comptes présents, mise à jour) est marquée comme ayant déjà vu l’écran des environnements. Cet écran ne se rouvre donc pas à chaque connexion.

### Cloud

Le client crée un utilisateur Supabase Auth. L’adresse est fabriquée : le pseudo, réduit aux lettres, chiffres, `_` et `-`, suivi de `@accounts.codeflow.app`. Le pseudo affiché et la photo sont dans les métadonnées utilisateur. La progression est dans `app_metadata.progress`. Les projets sont dans `app_metadata.projects`. Les amis, les demandes, les fils de discussion et la liste des bloqués sont dans le même `app_metadata`, à côté de la progression.

Le client embarque l’adresse du projet Supabase et une clé de service, et appelle l’API d’administration Auth (création, lecture des profils, mise à jour, suppression définitive). Cette clé ne figure pas dans ce document. Conséquence assumée par l’implémentation actuelle : le binaire peut lister les comptes pour le classement, les profils publics, les taux de succès et l’onglet Admin.

Les jetons d’accès et de rafraîchissement sont gardés dans SQLite et dans le `localStorage` de la webview. Si le jeton d’accès expire dans moins de 30 secondes, le client demande un nouveau couple de jetons avant l’appel. Un message explicite demande de se reconnecter quand la session n’est plus récupérable.

La fusion de progression est « la plus récente gagne » (`updatedAt`). Si le cloud est plus récent, il remplace le local. Si le local est plus récent, il est poussé. Un envoi plus ancien que la copie cloud est refusé par le client Rust. Tant que la signature de la progression n’a pas changé, le client ne réécrit pas.

Limites de la messagerie, le blob étant partagé avec la progression et les projets :

| Limite | Valeur |
| --- | --- |
| Messages gardés par conversation | 30, les plus récents |
| Longueur d’un message | 280 caractères |
| Conversations par compte | 40 |
| Réaction | une par utilisateur et par message ; la même réaction la retire |

Chaque fil est recopié sur les deux comptes. Au-delà, les plus anciens sont tronqués.

### Mises à jour

`cloud_latest_update` lit les releases GitHub du dépôt `Lysacae/CodeFlow` (brouillons et préversions ignorés). Il retient la plus récente qui a un fichier, et concatène les notes de toutes les versions strictement plus neuves que la version installée, de la plus ancienne à la plus récente.

L’installateur choisi est l’asset dont le nom contient `setup` et se termine par `.exe`. À défaut, le premier `.exe`, puis le premier fichier.

- Copie installée : téléchargement du setup, fermeture de CodeFlow, lancement NSIS silencieux (`/S /UPDATE /R`).
- Copie portable : tentative de télécharger `CodeFlow.exe` à côté du setup, remplacement de l’exécutable en cours, relance. Si cet asset manque, repli sur le setup.

Le hook NSIS tue `CodeFlow.exe` avant une installation ou une mise à jour, pour pouvoir remplacer les fichiers.

### Serveur du dépôt

`apps/server` (Express, port 8787 par défaut) expose santé, inscription, connexion, profil, progression et dernière release. Il sert aussi au script `publish-release`. Ce n’est pas le chemin du client 1.2.0. La variable `VITE_CODEFLOW_API_URL` est déclarée dans les types Vite et n’est pas lue par les écrans.

### Distributions

| | Installateur | Portable |
| --- | --- | --- |
| Fichier | `CodeFlow_*_x64-setup.exe` | `portable/CodeFlow/CodeFlow.exe` |
| Lancement | Installation NSIS, mode utilisateur courant | `Lancer-CodeFlow.bat` |
| Runtimes | Proposés par winget dans l’application | Préfixés sur le `PATH` de la session s’ils sont dans `portable/runtimes` |
| Mise à jour | Setup silencieux | Remplacement de l’exe, ou setup en secours |
| Langues NSIS | Français et anglais déclarés, sélecteur masqué | — |

Les releases 1.0.0 à 1.0.4 ne publient que le setup. À partir de la 1.0.5, les deux fichiers sont attachés : `CodeFlow.exe` et le setup.

## 5. Fonctionnalités

### 5.1 Compte, profil, session

Inscription et connexion demandent un pseudo et un mot de passe. La photo est facultative.

| Règle | Valeur |
| --- | --- |
| Pseudo | 3 à 24 caractères, lettres ASCII, chiffres, `_`, `-` |
| Mot de passe | au moins 4 caractères |
| Photo | fichier image, 2 Mo maximum à la sélection ; recadrage carré ; JPEG 128 × 128, qualité 0,85 |

Le profil éditable s’ouvre depuis l’avatar dans l’en-tête. On peut changer le pseudo et la photo. Un nouveau mot de passe n’est accepté que si le mot de passe actuel est fourni et reconnu (nouvelle connexion de contrôle). L’ancien et le nouveau doivent différer. Le fichier de récupération local est mis à jour quand le pseudo change et qu’il correspond au compte mémorisé.

La suppression de compte demande le mot de passe, contrôle la connexion, puis efface l’utilisateur Supabase sans mise en corbeille (`should_soft_delete=false`). La récupération locale est retirée si le pseudo correspond.

La récupération locale ne couvre que le dernier compte utilisé sur cet ordinateur. Le fichier JSON contient le pseudo et le mot de passe encodés en Base64, puis le fichier est masqué. Ce n’est pas un chiffrement. Depuis l’écran de connexion, on peut retrouver le mot de passe à partir du pseudo, ou le pseudo seul.

La déconnexion efface la session active et les jetons. Le sondage social s’arrête avec la session.

### 5.2 Thèmes

Quatre thèmes, libellés d’interface : **Night** (défaut, identifiant `dark`), **Clair** (`light`), **Prune** (`prune`), **Salade** (`salad`). Le choix est dans Paramètres, stocké dans la progression, et suit le compte. Une valeur inconnue retombe sur Night. Essayer un thème, puis les quatre, alimente des succès.

### 5.3 Parcours, leçons, exercices

Le tableau de bord affiche la progression globale (leçons terminées sur le total, exercices réussis), le dernier cours, et les quatre langages. Le bouton « Reprendre » reste inactif tant qu’aucune leçon n’a été ouverte. Il n’y a plus, depuis la 1.1.1, de bouton « Vérifier les environnements » sur cet écran. Les environnements restent dans Paramètres.

Chaque langage a une page de parcours. Les chapitres se replient. Le chapitre en cours (ou le premier) est ouvert au départ. Un bouton **Tutoriel** rouvre le tutoriel pour ce langage.

Déverrouillage :

- les leçons d’un niveau se suivent dans l’ordre ;
- un niveau s’ouvre quand toutes les leçons du niveau précédent sont terminées ;
- les chapitres 2 et 3 restent fermés tant que le chapitre 1 n’est pas terminé ;
- finir le chapitre 1 ouvre le chapitre 2 et le chapitre 3. Le chapitre 2 n’est pas un prérequis du chapitre 3 ;
- le compte `DevTesting` ignore ces verrous.

Types de leçon :

- cours (texte et extraits de code) ;
- cours plus exercice, avec éditeur, exécution, et sortie à comparer ;
- assistant de création de fichier (`file-wizard`), une fois par langage, au chapitre 1.

À partir du niveau 2, un rappel court du langage est ajouté en tête de leçon (affichage, syntaxe, lecture d’erreur). Le niveau 1, qui enseigne déjà ces points, ne reçoit pas ce rappel. Ce rappel est aussi repris dans le tutoriel quand on l’ouvre depuis un langage.

L’écran d’exercice sépare le texte de consigne. Les paragraphes qui précèdent le dernier forment le bloc **Explication**. Le dernier paragraphe est le bloc **Exercice**, souligné. La sortie attendue est affichée ; un saut de ligne y est montré par le signe ↵.

L’exercice est réussi si les trois conditions tiennent :

1. le programme se termine bien ;
2. la sortie standard est identique au texte attendu, y compris majuscules, espaces, accents et ponctuation ;
3. les contrôles de structure, s’il y en a, passent.

Ces contrôles sont de trois sortes : texte obligatoire (`mustInclude`), motif obligatoire (`mustMatch`), motif interdit (`forbidCheats`). Les commentaires sont retirés avant le contrôle, pour qu’un mot-clé mis en commentaire ne fasse pas passer l’exercice. Un `print` du seul résultat attendu est refusé quand la leçon demande une variable, un test, une boucle ou une lecture de case. Le message le dit en français.

Le délai d’exécution est de 10 secondes. Au-delà, l’exécution est coupée. Chaque lancement écrit dans le bac à sable local. Rien n’est envoyé à un serveur pour être compilé.

L’assistant pédagogique est local. Il est placé sous l’éditeur, en bas de la leçon. Le bouton « Pourquoi mon programme ne fonctionne pas ? » n’est actif qu’après une exécution, et se désactive une fois l’exercice réussi. Chaque demande monte d’un palier, jusqu’à 3. Le palier 1 explique, le palier 2 reprend l’indice, le palier 3 explique la correction. Si l’exercice n’a pas de contrôle de structure, le palier 3 peut proposer l’instruction d’affichage du texte attendu. S’il en a un, cette instruction n’est pas proposée : le texte rappelle que la structure compte autant que la sortie. Une ampoule montre l’indice, seulement au chapitre 1 et seulement pour les niveaux 1 à 3.

Le mode Focus s’active à l’ouverture d’une leçon qui contient un exercice, et se quitte en sortant de la leçon ou avec le bouton dédié. Il masque l’en-tête (navigation, profil, déconnexion) pour laisser le cours et l’éditeur. L’icône de mise à jour, si une version est proposée, reste en haut à droite.

### 5.4 Questions / Réponses

Chaque langage a un questionnaire de 22 questions, 4 choix, 25 secondes par question. Il est accessible depuis la page du langage, sans condition de chapitre.

Règles :

- une bonne réponse est maîtrisée et ne revient pas ;
- une mauvaise réponse est écartée tout de suite, et ne revient que lorsqu’elle est la dernière encore non maîtrisée ; si c’est déjà le cas, un écran de pause s’intercale avant de la reposer ;
- le temps écoulé (zéro seconde) compte comme une mauvaise réponse ;
- le pourcentage affiché est le nombre de bonnes réponses sur le nombre de tentatives ;
- le temps de complétion est figé au moment où toutes les questions du langage sont maîtrisées.

La première maîtrise d’une question rapporte 24 XP. Chaque réussite supplémentaire de la même question ajoute au plus quelques points (`max(1, arrondi de 8 / n^1,25)`). Finir une série en moins de 12 secondes par question, en moins de 8, ou sans erreur, ouvre des succès distincts.

### 5.5 Carnet et projets

Le carnet liste les programmes enregistrés sur le PC et les projets du compte cloud. À l’ouverture, les projets locaux sont fusionnés avec le cloud : pour un même identifiant, la copie dont la date est la plus récente l’emporte.

Limites de synchronisation : 40 projets, 80 000 caractères par projet, 500 000 caractères au total. Au-delà du nombre, les plus anciens sont écartés après tri. Un projet trop gros est refusé avec un message qui cite le fichier.

« Réinstaller » recopie le projet cloud dans la base et le dossier locaux, puis relance une fusion. C’est le geste prévu après une réinstallation ou sur un autre ordinateur, une fois connecté au même compte.

On peut rouvrir un programme local, le modifier, l’exécuter et l’enregistrer. Le nombre de programmes et le nombre de langages concernés alimentent des succès.

### 5.6 Environnements

L’écran n’est imposé qu’au premier passage, quand la base ne contient encore aucun compte. Dès que la page s’affiche, le drapeau « onboarding fait » est posé. Une base qui a déjà des utilisateurs est marquée faite au démarrage, pour qu’une mise à jour ou une reconnexion ne renvoie pas sur cet écran. On y revient ensuite par Paramètres.

Détection après relecture du `PATH` machine et du `PATH` utilisateur. Les raccourcis factices de `WindowsApps` sont ignorés.

| Runtime | Outil reconnu | Paquet winget demandé par l’application |
| --- | --- | --- |
| Python | `py -3`, sinon `python` / `python3` | `Python.Python.3.12` |
| C# | `dotnet` | `Microsoft.DotNet.SDK.8` |
| C++ | `g++` ou `clang++` | `MartinStorsjo.LLVM-MinGW.UCRT` |
| Java | `javac` et `java` tous les deux | `EclipseAdoptium.Temurin.17.JDK` |

`docs/INSTALL.md` cite encore Temurin 21 pour Java. Le comportement installé est Temurin 17. Le guide d’installation n’a pas été aligné.

Installation : `winget install` avec identifiant exact, source `winget`, accords acceptés, `--silent` et `--disable-interactivity`. Les fenêtres de winget ne sont pas affichées (`CREATE_NO_WINDOW`). Une barre de progression est alimentée par la sortie de winget. Après coup, le `PATH` du processus est recalculé.

**Installer tout** enchaîne les runtimes encore absents, un par un, avec le libellé « Installation de {nom} ({n}/{total}) ». **Désinstaller tout** demande une confirmation, puis enchaîne les runtimes présents. Si une étape échoue après des réussites, le message indique combien ont été traités avant l’erreur. Un second lot ne démarre pas tant que le premier n’est pas fini.

Désinstallation unitaire : même silence. Plusieurs portées sont essayées. Si le processus n’est pas élevé, l’ordre est : commande sans portée, puis utilisateur, puis machine. S’il est élevé : machine, puis utilisateur, puis sans portée. Une nouvelle tentative n’a lieu que si le message indique un paquet introuvable dans cette portée, ou un refus lié aux droits d’administrateur. Ainsi une désinstallation d’un paquet installé pour l’utilisateur n’exige pas de relancer l’application en administrateur.

Si winget manque, l’écran le dit et le guide d’installation décrit l’installation manuelle. La version portable peut aussi préparer les runtimes avec `setup-runtimes.ps1`.

### 5.7 Classement

Trois onglets, photos de profil et bouclier de rang compris. Une ligne ouvre le profil public du compte.

| Onglet | Ordre |
| --- | --- |
| Progression | Somme leçons + exercices, puis nombre de leçons, puis pseudo |
| Réussite Q/R | Part des questions maîtrisées sur l’ensemble des questions des quatre langages (88), puis nombre maîtrisé, puis pseudo |
| Temps Q/R | D’abord les comptes qui ont terminé les quatre séries, du plus rapide au plus lent (somme des temps de complétion). Les autres sont derrière, triés par nombre de questions maîtrisées |

Le chargement initial a lieu à l’ouverture. Le bouton de rechargement est manuel. Un nouveau chargement avant 30 secondes est refusé, avec le texte « Patientez N s ». Il n’y a pas de rafraîchissement automatique toutes les 30 secondes.

La liste des comptes est lue avec la clé d’administration. Le jeton de l’utilisateur doit être présent et non vide. Un jeton d’accès expiré ne bloque pas cet écran : le commentaire du code indique que l’expiration ne doit pas masquer le classement. Les autres opérations cloud (profil, projets, progression) exigent, elles, un jeton encore valable ou rafraîchi.

### 5.8 Mises à jour

Au lancement, si une version plus récente a un fichier à télécharger, une fenêtre indique la version actuelle, la version distante, et les notes. L’utilisateur peut installer ou reporter. Reporter ne retire pas la mise à jour : une icône de téléchargement, avec un point, apparaît à gauche de l’engrenage des paramètres. Elle rouvre la même fenêtre. En mode Focus, cette icône reste fixée en haut à droite. Paramètres permet la même vérification, et l’installation si une version est proposée.

Les notes affichées passent par un filtre :

- les titres de section (ligne courte, sans ponctuation forte, au plus six mots ou 48 caractères, ou titre markdown) restent des titres, sans puce, avec une ligne vide avant les puces ;
- les lignes « Version x.y.z » ou « CodeFlow x.y.z » deviennent « Version x.y.z » ;
- une section intitulée « Distributions » est omise ;
- le reste est une puce ;
- les lignes vides en trop du texte source sont ignorées. Une seule ligne vide sépare les blocs.

Les notes de release 1.1.x et 1.2.0 utilisent les titres **Correction** et **Ajout** (et **Suppression** lorsqu’il y a lieu). Ces titres restent des titres dans la fenêtre. Les versions sautées sont toutes reprises, de la plus ancienne à la plus récente, chacune précédée de son numéro.

Si l’installation automatique échoue, l’application tente d’ouvrir l’URL de téléchargement.

### 5.9 En-tête et indicateurs

Hors mode Focus, l’en-tête tient sur une barre pleine largeur, qui ne s’étire pas avec le contenu.

À gauche : avatar et pseudo (ouvrent l’édition du profil), bouclier du rang (ouvre le profil public), icône Amis, icône Messagerie. Le badge de la messagerie compte les demandes d’ami reçues, pas les messages non lus. Ceux-ci sont indiqués dans la liste des discussions.

Au centre : Tableau de bord, Classement, Carnet. Le pseudo `DevTesting` voit en plus l’entrée Admin.

À droite : icône de téléchargement si une mise à jour est proposée, engrenage des paramètres, bouton Déconnexion.

Les attentes (chargement, déconnexion, installation, vérification de mise à jour, listes) affichent un indicateur circulaire. L’animation est une rotation CSS de 0,8 s, linéaire, infinie, portée par la classe du conteneur (`.cf-spin`), y compris quand l’utilisateur demande moins d’animations au système (la durée est alors ramenée à presque rien).

### 5.10 Amis et messagerie

Le panneau Amis s’ouvre depuis l’icône. On envoie une demande avec le pseudo exact (au moins 3 caractères). La liste montre les amis, avec Écrire, Bloquer et Signaler. Un ami ouvre son profil public. Les comptes bloqués sont listés en dessous, avec Débloquer.

Les demandes reçues et envoyées se traitent dans la messagerie : Accepter ou Refuser. On n’écrit qu’à un ami. Ouvrir une discussion marque les messages reçus comme lus.

| Geste | Comportement |
| --- | --- |
| Lecture | L’auteur voit « vu » une fois `readAt` posé |
| Réaction | Dix émojis (😀 😂 ❤️ 👍 🎉 🔥 ✨ 👏 😮 🙏). Une réaction par personne ; recliquer la retire. Le même choix est proposé sous le champ de saisie |
| Suppression d’un message | Seulement l’auteur, et seulement tant que le message n’est pas lu. Le serveur refuse ensuite |
| Suppression de la discussion | Confirmation, puis effacement du fil |
| Blocage | Retire l’ami, les demandes et le fil, des deux côtés si l’autre a aussi bloqué. La liste cloud fait foi ; les identifiants encore présents en local restent masqués |
| Signalement | Confirmation locale. Le texte affiché est « Signalement envoyé. Merci. » Aucun appel n’est envoyé |

Les actions d’un message (émoji, corbeille) apparaissent au survol, à côté de la bulle : à gauche pour un message envoyé, à droite pour un message reçu. Elles ne recouvrent pas le texte. La corbeille n’est là que si le message est encore supprimable.

Pendant la saisie, le client signale « en train d’écrire » (déclenchement vers 350 ms, puis toutes les 2,5 s tant que le champ n’est pas vide). L’autre voit trois points si ce signal a moins de 8 secondes. Le panneau est borné (`min(640 px, 86 % de la hauteur)`), et seule la liste des messages défile. Le défilement reste collé en bas si l’on est à moins de 48 px du bas ; sinon il ne saute pas.

Un sondage lit l’état social toutes les 4 secondes, seulement si l’onglet est visible, et aussi quand la fenêtre reprend le focus. Si rien n’a changé, l’état n’est pas réécrit. Une nouvelle demande ou un nouveau message joue un son, fait clignoter la barre des tâches, et pose un toast en bas à gauche (au plus 4, 6,5 s, clic pour fermer). Une erreur de sondage après le premier chargement réussi ne remplace pas l’écran.

### 5.11 Profil public, expérience, succès

Le bouclier de l’en-tête ouvre le profil du compte connecté. Le classement, la liste d’amis et l’adresse `/profil/{id}` ouvrent celui d’un autre compte. On y voit la photo, le niveau, l’XP, la barre vers le rang suivant, le bouclier, le nombre de leçons, d’exercices et de questions maîtrisées. Sur le profil d’un autre, Bloquer (ou Débloquer) et Signaler sont proposés. Signaler a le même comportement local que dans la messagerie.

L’XP se calcule ainsi :

- 48 XP par leçon déjà comptée ;
- l’XP des questions, avec la décroissance décrite en 5.4 ;
- l’XP des succès : 35 (commun), 100 (rare), 280 (ardu).

La courbe de niveau est exponentielle (raison 1,045, coût de base 48 XP). Le niveau est plafonné à 200 dans le calcul. Un parcours complet (leçons, premières maîtrises des Q/R, succès) atterrit dans le Titane. Le Tungstène, au niveau 100, demande de l’ordre de 82 000 XP et reste hors d’une pratique normale.

| Rang | Niveau minimum |
| --- | --- |
| Bronze | 1 |
| Fer | 8 |
| Argent | 14 |
| Or | 20 |
| Platine | 27 |
| Diamant | 34 |
| Émeraude | 41 |
| Jade | 48 |
| Perle | 54 |
| Améthyste | 58 |
| Titane | 62 |
| Tungstène | 100 |

Les boucliers sont des images (`/ranks/{id}.png`) affichées sans fond, sans bordure et sans ombre (classe `cf-plain-icon`). Ils apparaissent dans l’en-tête, sur le profil et dans le classement.

Les 71 succès sont définis dans le client. Le module refuse de démarrer si le nombre ou un indice de déblocage manque. Le profil les affiche tous : bordure bleue (commun, `#4f8cff`), rouge (rare, `#e85d6a`) ou violette (ardu, `#a78bfa`). Un succès obtenu montre sa description. Un succès fermé montre un indice court, et le pourcentage de comptes qui l’ont obtenu. Ce pourcentage vient d’une lecture de tous les profils.

Familles couvertes : ouverture du compte, photo, quatre thèmes, mode Focus, tutoriel, volumes de leçons et d’exercices, démarrage et fin de chaque langage, chapitres 1 et 3, questions (volume, vitesse, sans-faute, répétition), amis et messages (demande, acceptation, refus, lecture, émoji, réaction, message non lu supprimé), carnet, exécutions, aide demandée, objectif du jour, jours d’activité, classement, visite d’un profil, rangs Fer, Or, Diamant et Titane.

Un succès nouveau, après le premier chargement du compte, affiche un toast en bas à droite (au plus 3, environ 4,2 s). Le chargement initial ne rejoue pas les succès déjà obtenus.

### 5.12 Tutoriel

Le tutoriel est obligatoire une fois par compte. Il n’est plus inséré dans les leçons. Quatre étapes rappellent le parcours, l’exécution exacte, les questions et l’expérience, puis l’en-tête (classement, amis, messagerie). Ouvert depuis un langage, il ajoute le rappel de syntaxe de ce langage. Une fois terminé, il ne revient pas seul. Le bouton Tutoriel de la page du langage permet de le revoir, et on peut alors le passer.

### 5.13 Compte technique DevTesting

Ce n’est pas une fonction présentée aux élèves. Le pseudo, comparé sans tenir compte de la casse, doit être exactement `devtesting`.

Réservé à ce compte :

- onglet **Admin** : liste des comptes cloud, suppression d’un autre compte (confirmation, suppression définitive, progression et projets compris ; le compte connecté ne se supprime pas depuis cette liste), réinitialisation de sa propre progression locale puis tentative de synchronisation ;
- bouton **Logs** dans Paramètres : version, processus élevé ou non, chemin de winget, chemins de la base, des données, des projets et du bac à sable, état des runtimes, erreurs récentes ;
- ouverture de n’importe quelle leçon, même verrouillée.

Les commandes Rust correspondantes refusent tout autre compte.

## 6. Contenu pédagogique

Quatre parcours parallèles, 15 niveaux, 3 chapitres. Le chapitre 1 regroupe les niveaux 1 à 5, le chapitre 2 les niveaux 6 à 10, le chapitre 3 les niveaux 11 à 15.

| Chapitre | Niveaux | Sujets |
| --- | --- | --- |
| 1 | Découverte, Premier programme, Variables, Logique, Premiers exercices | Rôle du langage, exécution, code source, éditeur, erreurs, affichage, commentaires, fichier, variables, conditions, boucles, premiers exercices |
| 2 | Texte et formatage, Décisions avancées, Boucles utiles, collections, Fonctions | Chaînes, `else if`, combinaisons de tests, boucles, tableaux ou listes, fonctions, mini-projet « diagnostic » |
| 3 | Fonctions qui renvoient, Tableaux associatifs, Répéter et choisir, Texte, Projet : ticket de caisse | Valeurs de retour, dictionnaire / map, `while` et `switch`, traitement de texte, projet final |

Le niveau 9 s’intitule « Listes » en Python, « Tableaux et listes » en C#, « Tableaux » en C++ et en Java. Le projet final demande de préparer une ligne de ticket, puis d’assembler un ticket de caisse.

Les cours des chapitres 2 et 3, et les exercices devenus trop elliptiques en fin de chapitre 1, disent la notion avant la tâche. Un exemple chiffré n’est pas celui de l’exercice. Le dernier paragraphe est la tâche. Les contrôles de structure refusent le raccourci qui affiche le résultat. Exemple, en Python, sur les listes : le cours distingue l’index 0 de la valeur rangée dans la case, puis l’exercice demande `print(valeurs[0])` et refuse `print(10)`. Le même soin est porté aux quatre fichiers de parcours.

Volumes comptés dans les fichiers de contenu :

| Langage | Leçons | Exercices | Assistant de fichier | Questions |
| --- | --- | --- | --- | --- |
| Python | 49 | 30 | 1 | 22 |
| C# | 45 | 27 | 1 | 22 |
| C++ | 45 | 27 | 1 | 22 |
| Java | 45 | 27 | 1 | 22 |
| **Total** | **184** | **111** | **4** | **88** |

Python a quatre leçons et trois exercices de plus au chapitre 1 (28 leçons et 14 exercices, contre 24 et 11). Les chapitres 2 et 3 ont la même taille partout : 10 leçons et 6 exercices, puis 11 leçons et 10 exercices. Par rapport au décompte de la 1.1.3, C#, C++ et Java ont chacun un exercice de plus au chapitre 1. Les leçons, elles, n’ont pas changé de nombre.

Chaque question a un énoncé, quatre réponses, l’index de la bonne réponse, et une explication affichée après la tentative. Le délai est de 25 secondes dans les quatre fichiers.

Extensions et couleurs de parcours : `.py`, `.cs`, `.cpp`, `.java`. L’éditeur Monaco utilise le mode du langage correspondant.

## 7. Exigences techniques

### Plateforme

- Windows 10 ou 11, x64.
- WebView2 : présent sur Windows 11, installé si besoin sur Windows 10 (prérequis Tauri).
- Pour développer : Node.js 20+, Rust (édition 2021), puis `npm run tauri:dev` ou `npm run tauri:build` dans `apps/desktop`.

### Build livré

Versions alignées sur **1.2.0** dans `package.json`, `Cargo.toml`, `tauri.conf.json` et `src/shared/lib/version.ts`.

Profil Rust de release : une seule unité de génération, LTO, optimisation 3, `panic = abort`, symboles retirés. Cible du bundle : NSIS uniquement. Mode d’installation : utilisateur courant. Rétrogradation interdite (`allowDowngrades: false`).

### Exécution du code élève

| Langage | Chaîne |
| --- | --- |
| Python | interpréteur détecté, script dans le bac à sable |
| C# | `dotnet`, compilation puis exécution |
| C++ | `g++` ou `clang++`, puis exécutable |
| Java | `javac` puis `java` ; le nom de la classe publique est lu dans le source, sinon le fichier reste cohérent avec `Main` tel que les leçons le présentent |

Délai : 10 secondes. Sortie standard, erreur standard et sortie de compilation sont renvoyées à l’interface. Les processus enfants sont lancés sans fenêtre console. La comparaison de sortie est suivie, côté interface, des contrôles de structure décrits en 5.3.

### Réseau et session

- Inscription, connexion, profil, mot de passe, progression, projets, classement, amis, messages, profils publics, taux de succès : Supabase Auth.
- Mises à jour : API GitHub Releases, sans jeton.
- Pas d’exécution distante du code élève.
- Rafraîchissement du JWT avant expiration (marge de 30 secondes), puis nouvel essai de l’appel.
- Sondage social toutes les 4 secondes pendant que l’onglet est visible. Pas de réécriture si l’instantané est identique.
- Corps JSON côté serveur du dépôt limité à 2 Mo, ce qui couvre une photo. Le client, lui, refuse déjà une image source au-delà de 2 Mo avant envoi.

### Sécurité, état actuel

- Mot de passe de changement et de suppression revérifié par une connexion.
- Suppression cloud définitive, pas une désactivation.
- Récupération locale : Base64 et attribut « caché », sur un seul compte, sur la machine. Toute personne qui lit le fichier peut retrouver le mot de passe.
- Clé de service Supabase compilée dans le client. Elle ne doit pas être recopiée dans un document, un ticket ou un dépôt public. Le classement, les profils publics, les taux de succès et l’admin s’appuient sur elle.
- Jeton d’accès expiré : bloquant pour la synchro de progression et de projets (message de reconnexion), non bloquant pour l’affichage du classement tant qu’une chaîne de jeton non vide est présente.
- Blocage effectif, stocké dans le compte et rappelé en local. Signalement sans envoi : confirmation d’interface seulement.
- Menu contextuel retiré, ce qui limite le copier-coller par le menu du navigateur intégré. Ce n’est pas un contrôle d’accès. Le texte des messages reste sélectionnable.

### Interface

- Textes élèves en français.
- Quatre thèmes nommés ci-dessus.
- Fenêtre centrée, redimensionnable, maximisable, bornée par la zone de travail, restaurée après Alt+Tab y compris si le processus est élevé.
- Indicateurs de chargement animés sur les actions qui attendent.
- Toasts de succès en bas à droite, toasts sociaux en bas à gauche.

## 8. Historique des versions

Toutes les releases publiques listées ci-dessous ont été publiées le 24 novembre 2026. Les libellés reprennent les notes GitHub. « Correction », « Ajout » et « Suppression » sont les titres utilisés à partir de la 1.1.1. Avant cela, les notes sont une simple liste de puces. Les notes 1.1.5, 1.1.6, 1.1.7 et 1.2.0 disent « Correction de bug » sans nommer le défaut : le détail est en section 9, à partir du code 1.2.0.

| Version | Heure (UTC) | Correction | Ajout | Suppression |
| --- | --- | --- | --- | --- |
| 1.0.0 | 11:49 | — | Comptes et synchronisation de la progression | — |
| 1.0.1 | 12:28 | — | Connexion au compte sans installer de serveur | — |
| 1.0.2 | 12:42 | Correctif de connexion au compte | — | — |
| 1.0.3 | 13:04 | — | Leçons plus lisibles ; vérification des mises à jour dans Paramètres | — |
| 1.0.4 | 13:14 | — | Installation silencieuse des langages ; édition du profil | — |
| 1.0.5 | 13:38 | — | Désinstallation et détection des environnements ; thèmes Prune et Salade ; classement. Premier asset `CodeFlow.exe` | — |
| 1.0.6 | 14:09 | — | Installation automatique des mises à jour ; classement avec photos et progression ; thème Night ; synchronisation des projets entre PC | — |
| 1.0.7 | 14:24 | — | Notes de mise à jour plus courtes ; récapitulatif des versions manquées | — |
| 1.1.0 | 15:01 | — | Chapitre 3 et projets avancés ; questions/réponses chronométrées ; classements réussite et temps ; synchronisation des projets plus fiable. La note parle d’une refonte | — |
| 1.1.1 | 15:44 | « Correction de bug », sans préciser lequel | Recharge du classement ; sécurité du profil et du mot de passe ; indicateurs de chargement | Bouton « Vérifier les environnements » du tableau de bord |
| 1.1.2 | 16:11 | — | Suppression de compte | — |
| 1.1.3 | 16:42 | « Correction de bug », sans préciser lequel | — | — |
| 1.1.4 | 17:39 | Étirement de l’en-tête avec la fenêtre ; tutoriel retiré des leçons, obligatoire une fois par compte | Amis, demandes et messagerie ; succès, expérience et rangs | — |
| 1.1.5 | 18:23 | « Correction de bug », sans préciser lequel | Améliorations messagerie et succès | — |
| 1.1.6 | 18:51 | « Correction de bug », sans préciser lequel | Notifications sociales ; installation et désinstallation groupées des environnements | — |
| 1.1.7 | 19:25 | « Correction de bug », sans préciser lequel | — | — |
| 1.2.0 | 20:25 | « Correction de bug », sans préciser lequel | Notification de mise à jour ; leçons plus explicites | — |

La 1.2.0 est la version embarquée dans le dépôt au moment de ce document. Les tags GitHub 1.0.x et 1.1.x pointaient, lors du document 1.1.3, vers un même commit affiché. Le détail fichier par fichier de chaque palier n’est donc pas reconstructible depuis l’historique git local lorsque le clone n’a pas ces commits. Les notes restent le journal public ; le comportement décrit aux sections 5 et 9 est celui du code 1.2.0.

## 9. Bugs connus et corrigés

### Correctifs rattachés à une note

Ordre chronologique. Le symptôme est formulé à partir de la note et du comportement présent dans le code. Quand la note ne nomme pas le défaut, la ligne le dit.

1. **1.0.1 — Connexion dépendante d’un serveur.** La note ajoute la connexion sans installer de serveur. Le client 1.2.0 parle à Supabase depuis Rust, sans Express.
2. **1.0.2 — Connexion au compte.** La note dit seulement « Correctif de connexion au compte ». Le défaut précis n’est pas décrit.
3. **1.0.3 — Leçons difficiles à lire.** La note dit « Leçons plus lisibles ». Dans le code actuel, le rappel générique de syntaxe n’est injecté qu’après le niveau 1, pour ne pas répéter le chapitre de découverte. Le lien exact entre cette note et ce choix n’est pas écrit dans la release.
4. **1.0.4 — Installations bavardes, profil figé.** Installation winget silencieuse, et édition du profil (pseudo, photo).
5. **1.0.5 — Environnements et classement.** Désinstallation et détection reprises ; classement des utilisateurs ; thèmes Prune et Salade.
6. **1.0.6 — Mise à jour manuelle, projets isolés sur un PC.** Installation lancée par l’application ; classement avec photo et volumes de progression ; thème Night ; projets synchronisés entre machines.
7. **1.0.7 — Notes trop longues, versions sautées absentes.** Le filtre d’affichage raccourcit la présentation (titres sans puce, section Distributions omise). Le récapitulatif agrège chaque version strictement plus récente, de la plus ancienne à la plus récente.
8. **1.1.1 — Note « Correction de bug ».** Le défaut n’est pas nommé. Les ajouts nommés, eux, correspondent au code : bouton de rechargement du classement avec attente de 30 secondes ; changement de mot de passe seulement avec l’ancien mot de passe ; indicateurs de chargement animés ; retrait du bouton de vérification des environnements sur le tableau de bord.
9. **1.1.2 — Pas de suppression de compte.** Ajout de la suppression, avec mot de passe et effacement définitif.
10. **1.1.3 — Note « Correction de bug ».** Le défaut corrigé n’est pas nommé dans la release. On ne peut pas l’attribuer à un symptôme précis sans inventer.
11. **1.1.4 — En-tête et tutoriel.** La note corrige l’étirement de l’en-tête avec la fenêtre, et retire le tutoriel des leçons : il est obligatoire une fois par compte. Les ajouts nommés sont les amis, les demandes, la messagerie, les succès, l’expérience et les rangs. Dans le code 1.2.0, cela comprend la lecture (« vu »), les réactions, la suppression d’un message non lu, la barre d’émojis, le profil public et les douze rangs, du Bronze au Tungstène.
12. **1.1.5 — Note « Correction de bug », ajout « Améliorations messagerie et succès ».** Le défaut n’est pas nommé. Le code livré, pour ces deux zones, fait ceci : boucliers sans cadre blanc ; au survol, émoji et corbeille ; points de saisie ; liste de messages qui défile dans un panneau fixe ; suppression de discussion ; blocage ; signalement local seulement ; toast de succès ; bordure selon la rareté ; indice tant que le succès est fermé ; sondage qui ne réécrit rien si l’instantané est identique.
13. **1.1.6 — Note « Correction de bug ».** Le défaut n’est pas nommé. L’ajout nommé couvre les notifications sociales et l’installation ou la désinstallation groupée des environnements. Les actions de message sont placées à côté de la bulle, pas par-dessus. Les toasts sociaux sont en bas à gauche.
14. **1.1.7 — Note « Correction de bug ».** Le défaut n’est pas nommé. Le code de la leçon, lui, sépare explication et exercice, refuse une sortie juste si la structure ne correspond pas, et place l’assistant sous l’éditeur. Le palier 3 ne propose plus l’affichage littéral du texte attendu quand un contrôle de structure existe.
15. **1.2.0 — Note « Correction de bug », ajouts nommés.** La note ajoute la notification de mise à jour et des leçons plus explicites. L’icône de téléchargement à côté des paramètres correspond au premier ajout. Les cours des chapitres 2 et 3, et les consignes devenues trop courtes en fin de chapitre 1, correspondent au second, dans les quatre langages. Le défaut non nommé du côté fenêtre est, dans le code, la restauration après Alt+Tab : un processus élevé ou une fenêtre réduite ne restait pas toujours au premier plan ; la restauration est forcée, et une fenêtre laissée hors écran est recentrée.

### Défauts dont le correctif est dans le code 1.2.0

Ces points sont visibles dans l’implémentation. La release qui les a introduits n’est pas toujours nommée. Ils sont livrés, pas ouverts.

| Symptôme traité | Comportement livré |
| --- | --- |
| Session JWT expirée pendant la synchro | Marge de 30 secondes, rafraîchissement, nouvel essai, message demandant de se reconnecter pour les projets. Le jeton peut aussi être relu depuis SQLite si la webview l’a perdu |
| Classement inaccessible parce que le jeton d’accès a expiré | La liste est lue avec la clé d’administration. Un jeton non vide suffit. Le code commente explicitement ce choix |
| Fenêtre plus grande que l’écran, contenu étiré | Maximum égal à la zone de travail ; recalcul au déplacement et au changement d’échelle ; largeur et hauteur CSS calées sur la fenêtre |
| Fenêtre élevée ou réduite qui ne revient pas après Alt+Tab | Filtres de messages du shell autorisés ; `ShowWindow` restauration ; recentrage si la position est hors écran ou la taille minuscule. Perdre le focus ne cache pas la fenêtre |
| Indicateur de chargement immobile | Rotation CSS sur le conteneur `.cf-spin` (0,8 s). Cohérent avec l’ajout « Indicateurs de chargement » de la 1.1.1 |
| Bouton « Voir » en plus de l’icône œil | Un seul contrôle : icône œil, libellé accessible « Afficher le mot de passe » ou « Masquer le mot de passe » |
| Menu du clic droit | Désactivé dans WebView2, dans Monaco (`contextmenu: false`), et par un écouteur sur le document |
| Texte du niveau 1 répété en tête de leçon | `lessonIntro` n’est affiché que lorsque le niveau n’est pas le niveau 1 |
| Écran Environnements à chaque reconnexion | Drapeau `environments_onboarding_done`. Une base qui a déjà des utilisateurs est marquée faite. La page, une fois ouverte, pose le drapeau immédiatement |
| Désinstallation winget refusée sans droits administrateur | Plusieurs portées sont essayées. L’ordre dépend du fait que le processus est élevé ou non. On ne redemande une tentative que si le message parle de portée ou de droits |
| Exercice validé par un simple affichage du texte attendu | Contrôles `mustInclude`, `mustMatch` et `forbidCheats`, commentaires ignorés. L’assistant ne donne pas la ligne d’affichage quand ces contrôles existent |
| Sondage social qui fait clignoter l’interface sans nouveauté | Retour immédiat si l’instantané JSON est identique et qu’il n’y a pas d’avis nouveau |
| Bouclier de rang entouré d’un cadre blanc | Classe `cf-plain-icon` : fond transparent, bordure nulle, ombre nulle |

### Limites encore présentes

Ce ne sont pas des régressions datées. Ce sont des propriétés du produit 1.2.0 à connaître.

- Les notes 1.1.1, 1.1.3, 1.1.5, 1.1.6, 1.1.7 et 1.2.0 disent « Correction de bug » sans dire lequel. Le journal public est incomplet sur ces paliers. La section ci-dessus ne comble le trou que là où le code 1.2.0 montre un comportement nommé.
- `docs/INSTALL.md` indique Temurin 21. L’application installe `EclipseAdoptium.Temurin.17.JDK`.
- La récupération de mot de passe est un encodage Base64 dans un fichier local masqué, pas un coffre.
- La clé d’administration Supabase est dans le client. Le classement, les profils publics et les taux de succès ne reposent pas sur un droit limité au seul utilisateur connecté.
- L’objectif quotidien est une donnée de progression, sans réglage à l’écran. Le succès « Ambitieux » (objectif à 5 ou plus) n’a donc pas de geste dans l’interface.
- Le chapitre 3 s’ouvre avec le chapitre 2 dès la fin du chapitre 1.
- Le bouton Signaler, dans les amis, la messagerie et le profil public, n’envoie rien. Il affiche seulement « Signalement envoyé. Merci. »
- L’application n’est pas présentée comme signée. L’avertissement SmartScreen reste un cas d’usage de la version portable.

Aucun défaut ouvert, reproduit et non traité n’a été trouvé dans les notes de la 1.2.0 au-delà de ces limites.

## 10. Contraintes et règles de release

- **Deux artefacts, en même temps.** Après une correction ou une évolution qui change l’exécutable : `npm run tauri build` dans `apps/desktop`, puis l’installateur NSIS (`apps/desktop/src-tauri/target/release/bundle/nsis/CodeFlow_*_x64-setup.exe`) et la copie portable (`apps/desktop/src-tauri/target/release/codeflow.exe` vers `portable/CodeFlow/CodeFlow.exe`). La tâche n’est pas finie tant que les deux ne sont pas à jour. Depuis la 1.0.5, la release GitHub publie aussi les deux.
- **Numérotation.** Ligne 1.0 publiée de 1.0.0 à 1.0.7, puis passage en 1.1.0. Sur une ligne mineure, le correctif s’arrête à **.7**. La ligne 1.1 s’est arrêtée à 1.1.7. La suivante, **1.2.0**, est la version actuelle. Le prochain correctif de cette ligne est 1.2.1, jusqu’à 1.2.7, puis 1.3.0. Les quatre fichiers de version cités plus haut restent alignés.
- **Notes de mise à jour.** Courtes. Titres Correction, Ajout, Suppression quand il y a lieu. Pas de chapitre « Distributions » dans le texte montré à l’élève : le filtre le retire. Si l’élève a sauté des versions, chaque note intermédiaire est incluse, dans l’ordre chronologique des numéros.
- **Langue.** Interface élève en français. L’installeur déclare le français et l’anglais, sans afficher de sélecteur.
- **Fenêtre d’installation.** NSIS en mode utilisateur courant, sans rétrogradation. Le hook ferme CodeFlow avant de copier les fichiers.
- **Contenu.** Les leçons et les questions vivent dans `content/tracks/<langage>/`. Une leçon nouvelle suit le verrouillage existant : ordre dans le niveau, chapitre 1 obligatoire avant les chapitres 2 et 3. Un exercice qui enseigne une structure emporte des contrôles, pas seulement une sortie attendue.
- **Compte DevTesting.** Réservé à l’usage interne. Il ne fait pas partie du parcours présenté sur la page d’accueil du dépôt.

## 11. Glossaire

| Terme | Sens dans CodeFlow |
| --- | --- |
| Parcours | Ensemble des niveaux d’un langage |
| Chapitre | Groupe de niveaux. 1 = bases, 2 = approfondissement, 3 = projet |
| Niveau | Bloc titré (Découverte, Variables, etc.) contenant plusieurs leçons |
| Leçon | Écran de cours, parfois avec un exercice ou un assistant de fichier |
| Exercice | Code à exécuter ; réussi si la sortie égale le texte attendu et si la structure demandée est présente |
| Q/R | Questionnaire chronométré de 22 questions par langage |
| Carnet | Programmes enregistrés, en local et sur le compte |
| Runtime | Outil qui exécute ou compile : Python, .NET SDK, g++/clang++, JDK |
| winget | Gestionnaire de paquets Windows utilisé pour installer ou retirer ces outils |
| NSIS | Installeur Windows produit par Tauri |
| Portable | Dossier avec `CodeFlow.exe`, un script de lancement, et des runtimes optionnels |
| Mode Focus | Leçon sans en-tête de navigation |
| Night, Clair, Prune, Salade | Les quatre thèmes |
| Rang | Bronze, Fer, Argent, Or, Platine, Diamant, Émeraude, Jade, Perle, Améthyste, Titane, Tungstène |
| XP | Points d’expérience : leçons, questions, succès |
| Succès | Un des 71 objectifs du compte, de rareté commun, rare ou ardu |
| DevTesting | Pseudo du compte technique interne |
| Jeton / JWT | Preuve de session Supabase. Le jeton d’accès est courte durée ; le jeton de rafraîchissement le renouvelle |
| Bac à sable | Dossier local où le code de l’élève est écrit le temps d’une exécution |
| Setup | Fichier `CodeFlow_*_x64-setup.exe` |
| Vu | Mention affichée à l’auteur quand le destinataire a ouvert la discussion |
| Signalement | Confirmation locale, sans envoi |
