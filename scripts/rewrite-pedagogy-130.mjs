import fs from "fs";

const root = new URL("../content/tracks/", import.meta.url);

const LANG = {
  python: {
    name: "Python",
    run: "l'interpréteur lit le fichier de haut en bas, sans compilation séparée",
    comment: "Une ligne qui commence par # est un commentaire : Python l'ignore.",
    block: "Un bloc commence après les deux-points et se décale de 4 espaces.",
    end: "Pas de point-virgule en fin de ligne.",
    show: 'print("Bonjour")',
  },
  csharp: {
    name: "C#",
    run: "le SDK .NET compile le programme, puis l'exécution produit la sortie",
    comment: "Une ligne qui commence par // est un commentaire : le compilateur l'ignore.",
    block: "Un bloc est entouré d'accolades { }.",
    end: "Chaque instruction se termine par un point-virgule.",
    show: 'Console.WriteLine("Bonjour");',
  },
  cpp: {
    name: "C++",
    run: "le compilateur traduit le fichier en programme, puis ce programme affiche la sortie",
    comment: "Une ligne qui commence par // est un commentaire : le compilateur l'ignore.",
    block: "Un bloc est entouré d'accolades { }.",
    end: "Chaque instruction se termine par un point-virgule.",
    show: 'std::cout << "Bonjour" << std::endl;',
  },
  java: {
    name: "Java",
    run: "javac compile la classe, puis java exécute main",
    comment: "Une ligne qui commence par // est un commentaire : le compilateur l'ignore.",
    block: "Un bloc est entouré d'accolades { }.",
    end: "Chaque instruction se termine par un point-virgule. Le code d'un exercice tient dans la classe déjà ouverte.",
    show: 'System.out.println("Bonjour");',
  },
};

function pack(objective, prereq, how, result, recap, example) {
  return { objective, prereq, how, result, recap, example };
}

function concept(lang, id, title, prev) {
  const L = LANG[lang];
  const before = prev
    ? `Prérequis : la leçon « ${prev} ». Aucune autre notion n'est utilisée.`
    : "Prérequis : aucun. C'est le point de départ du parcours.";
  const rules = [
    [/what-is/, pack(
      `Savoir ce qu'est un programme ${L.name} : une suite d'ordres, pas une discussion.`,
      before,
      `${L.show} est un ordre d'affichage. Le texte entre guillemets est la donnée. Le nom de l'instruction est le verbe.`,
      "La sortie ne contient que Bonjour, sans les guillemets et sans le nom de l'instruction.",
      `Un programme ne fait que ce qui est écrit, dans l'ordre. ${L.end}`,
      L.show,
    )],
    [/why/, pack(
      `Expliquer pourquoi ${L.name} convient pour débuter, sans le confondre avec les autres langages du tableau de bord.`,
      before,
      `L'exemple affiche un mot. Vous n'avez pas encore de variable : le message est écrit en toutes lettres.`,
      "Une seule ligne apparaît dans la Sortie.",
      `${L.name} reste lisible parce que l'affichage ressemble à une phrase. La rigueur (guillemets, ${lang === "python" ? "indentation" : "point-virgule"}) vient juste après.`,
      L.show,
    )],
    [/how/, pack(
      `Décrire ce qui se passe entre le clic sur Exécuter et le texte dans la Sortie, pour ${L.name}.`,
      before,
      L.run + ". Une ligne fausse arrête le processus et la Sortie montre l'erreur réelle, pas une simulation.",
      "Un exemple correct affiche son message. Un exemple incorrect n'affiche pas un résultat inventé : il montre l'erreur.",
      "Lisez toujours la Sortie après un essai. C'est le seul juge du programme.",
      L.show,
    )],
    [/source/, pack(
      "Distinguer le code source (le texte que vous tapez) du résultat affiché.",
      before,
      "Les guillemets font partie du source. Ils ne sont pas affichés. Sans eux, le mot serait un nom à chercher.",
      "La Sortie montre le texte intérieur, pas les guillemets.",
      `Le source doit respecter la syntaxe de ${L.name}. ${L.end}`,
      L.show,
    )],
    [/editor/, pack(
      "Utiliser l'éditeur, Exécuter, Réinitialiser et la zone Sortie sans les confondre.",
      before,
      "L'éditeur colorie le code. Exécuter lance vraiment l'outil du langage. Réinitialiser remet le texte de départ, pas votre dernière idée.",
      "Tant que vous n'avez pas cliqué sur Exécuter, la Sortie ne change pas.",
      "Le numéro de ligne à gauche sert à retrouver une erreur. Il ne fait pas partie du programme.",
      null,
    )],
    [/indent/, pack(
      lang === "python"
        ? "Comprendre que l'indentation est une règle de syntaxe, pas une décoration."
        : "Utiliser l'indentation pour lire un bloc, même si les accolades font foi.",
      before,
      L.block + " Une ligne du bloc ne doit pas revenir au bord gauche trop tôt.",
      "Un bloc bien formé s'exécute. Un décalage illégal est refusé avant le résultat.",
      lang === "python"
        ? "Quatre espaces sous les deux-points. Ne mélangez pas espaces et tabulations."
        : "Indentez pour vous relire. Les accolades, elles, décident du bloc.",
      null,
    )],
    [/errors/, pack(
      "Lire une erreur sans la prendre pour un échec définitif.",
      before,
      "Le message cite souvent un nom (SyntaxError, point-virgule, symbole introuvable) et une ligne. Corrigez cette ligne, puis relancez.",
      "Après correction, l'erreur disparaît et la Sortie montre le résultat, ou une erreur suivante plus précise.",
      "Une erreur de syntaxe empêche l'exécution. Une erreur plus tard veut dire que la lecture a réussi, puis qu'une opération a échoué.",
      null,
    )],
    [/l2-print$|-print$/, pack(
      "Afficher un texte exact, accents et ponctuation compris.",
      before,
      `${L.show.replace("Bonjour", "Bienvenue dans la programmation !")} envoie cette phrase. Les guillemets ne sortent pas.`,
      "La Sortie doit être exactement : Bienvenue dans la programmation !",
      "Changer le texte entre guillemets change la sortie. Le reste de l'instruction reste.",
      null,
    )],
    [/several-prints$|l2-lines$/, pack(
      "Produire deux lignes distinctes, dans l'ordre demandé.",
      before,
      "Chaque affichage écrit une ligne puis passe à la suivante. Deux instructions donnent deux lignes. Une seule instruction avec les deux mots les collerait.",
      "Première ligne, puis seconde ligne. Rien entre les deux, rien après.",
      "L'ordre des lignes du source est l'ordre des lignes affichées.",
      null,
    )],
    [/comments$/, pack(
      "Mettre une note dans le source sans qu'elle s'affiche.",
      before,
      L.comment + " Le commentaire peut expliquer une ligne. Il ne remplace pas l'instruction.",
      "La Sortie ignore le commentaire. Seul l'affichage réel apparaît.",
      "Un commentaire ne corrige pas une erreur et ne compte pas comme du code pour un exercice.",
      null,
    )],
    [/quotes$|l2-syntax$/, pack(
      "Voir pourquoi un texte a des guillemets et une instruction a sa ponctuation.",
      before,
      L.end + " Les guillemets entourent le texte. Les parenthèses, quand il y en a, entourent l'argument.",
      "Une forme correcte s'exécute. Une forme cassée s'arrête sur une erreur de syntaxe.",
      "Ne fermez pas un guillemet trop tôt : le reste de la phrase serait lu comme du code.",
      L.show,
    )],
    [/first-file$/, pack(
      `Créer un fichier ${L.name} dont le nom et le contenu se correspondent.`,
      before,
      "Le fichier enregistré contient le source. CodeFlow l'exécute comme les exercices, dans le bac à sable.",
      "Après enregistrement, le parcours peut continuer. Le fichier reste dans le carnet.",
      lang === "java"
        ? "En Java, le nom du fichier doit suivre le nom de la classe publique."
        : "Le nom du fichier rappelle le langage. Le contenu, lui, doit rester un programme valide.",
      null,
    )],
    [/declare$/, pack(
      "Créer une variable et afficher son contenu, pas son nom.",
      before,
      "Le nom est à gauche du signe =. La valeur est à droite. L'affichage reçoit le nom, sans guillemets, pour lire la boîte.",
      "La Sortie montre la valeur, ici Paris, pas le mot ville.",
      "print du nom et print du texte entre guillemets ne sont pas le même geste.",
      null,
    )],
    [/names$/, pack(
      "Choisir un nom de variable lisible et légal.",
      before,
      "Un nom commence par une lettre. Il n'a pas d'espace ni d'accent. ville et Ville seraient deux noms différents.",
      "Un nom illégal est une erreur de syntaxe. Un nom correct ne s'affiche pas tout seul : il faut une instruction.",
      "Nommez d'après le contenu (score, prenom), pas x1 si le rôle n'est pas évident.",
      null,
    )],
    [/types$/, pack(
      "Reconnaître un texte, un nombre entier et une valeur vraie ou fausse.",
      before,
      "Les guillemets fabriquent un texte. Un nombre s'écrit sans guillemets. Mélanger les deux dans un calcul change le sens, ou provoque une erreur.",
      "Afficher un nombre montre ses chiffres. Afficher un texte montre les caractères.",
      "Le type décide des opérations permises. On additionne des nombres. On colle des textes.",
      null,
    )],
    [/modify$/, pack(
      "Remplacer la valeur d'une variable, puis afficher la valeur actuelle.",
      before,
      "La deuxième affectation écrase la première. L'ancienne valeur n'est plus là. L'affichage placé après les deux lignes voit la dernière.",
      "La Sortie montre 10, pas 0, parce que l'affichage est après le remplacement.",
      "L'ordre des lignes compte. Afficher entre les deux affectations montrerait encore 0.",
      null,
    )],
    [/concat$/, pack(
      "Construire une phrase à partir d'un texte fixe et d'une variable.",
      before,
      "L'espace fait partie du texte \"Bonjour \". Le + colle ce texte et la valeur de la variable. Il ne colle pas les noms.",
      "Avec Sam dans la variable, la Sortie est Bonjour Sam.",
      "Écrire Bonjour Sam d'un seul bloc contourne l'exercice : la variable ne sert plus.",
      null,
    )],
    [/numbers$/, pack(
      "Calculer avec des variables numériques et afficher le calcul, pas le résultat figé.",
      before,
      "+ additionne, - soustrait, * multiplie, / divise. Les noms a et b portent les nombres. L'affichage reçoit a + b.",
      "7 et 3 donnent 10. La Sortie montre 10 parce que le calcul a été fait, pas parce que 10 était écrit en dur.",
      "Des guillemets autour de 7 en feraient un texte. Le calcul n'aurait plus le même sens.",
      null,
    )],
    [/l4-conditions$|conditions$/, pack(
      "N'afficher un message que si une comparaison est vraie.",
      before,
      "La comparaison se lit : score est-il supérieur ou égal à 10 ? Si oui, le bloc s'exécute. Sinon, il est sauté.",
      "Avec 12, le message Réussi apparaît. Avec 9, il n'apparaîtrait pas.",
      "Afficher Réussi sans le test réussit la sortie de cet exemple et rate l'objectif.",
      null,
    )],
    [/else-if$/, pack(
      "Enchaîner plusieurs cas exclusifs : un seul message doit sortir.",
      before,
      "Le premier test vrai gagne. Les suivants ne sont pas lus. else n'est pris que si tous les tests ont échoué.",
      "note vaut 14. 14 < 10 est faux, 14 < 14 est faux, donc else affiche Bien.",
      "L'ordre des seuils compte. Un seuil large placé en premier avale les cas plus précis.",
      null,
    )],
    [/l4-else$|l5-else$/, pack(
      "Prévoir le cas où le test est faux, avec else.",
      before,
      "if prend le cas vrai. else prend le cas faux. Les deux blocs ne s'exécutent pas ensemble.",
      "La valeur de départ rend un seul des deux messages vrai. L'autre doit quand même être écrit : il sert pour une autre valeur.",
      "Sans else, un test faux n'affiche rien. Ce n'est pas ce que demande l'exercice.",
      null,
    )],
    [/operators$|compare$/, pack(
      "Choisir le bon signe de comparaison.",
      before,
      "== teste l'égalité. != teste la différence. <, >, <= et >= comparent l'ordre. Un seul = est une affectation, pas un test.",
      "Une comparaison vaut vrai ou faux. Elle ne s'affiche pas toute seule : elle décide d'un bloc.",
      "Ne confondez pas = et ==. Le premier range une valeur. Le second pose une question.",
      null,
    )],
    [/and-or$/, pack(
      "Combiner deux comparaisons dans un même test.",
      before,
      "et (and, &&) exige que les deux côtés soient vrais. ou (or, ||) suffit qu'un côté soit vrai.",
      "Le bloc ne s'exécute que si la combinaison entière est vraie.",
      "Écrivez deux comparaisons complètes. Un mot seul entre les deux n'est pas un test.",
      null,
    )],
    [/l4-loops$/, pack(
      "Répéter un affichage avec une boucle, au lieu de recopier les lignes.",
      before,
      "La boucle donne à i les valeurs prévues, une par tour. L'affichage de i est dans le corps, donc il se répète.",
      "Vous voyez 0, puis 1, puis 2, chacun sur sa ligne.",
      "Trois affichages copiés hors de la boucle imitent la sortie et ratent la notion.",
      null,
    )],
    [/c2-for$/, pack(
      "Choisir les bornes d'une boucle pour obtenir 1, 2 et 3.",
      before,
      lang === "python"
        ? "range(1, 4) commence à 1 et s'arrête avant 4."
        : "Le compteur part de 1 et continue tant qu'il n'a pas dépassé 3.",
      "Trois lignes : 1, 2, 3. Pas de 0, pas de 4.",
      "Affichez i dans la boucle. N'écrivez pas les trois nombres à la main.",
      null,
    )],
    [/l4-while$|c3-while$/, pack(
      "Répéter tant qu'une condition reste vraie, et modifier ce qui la rendra fausse.",
      before,
      "while teste, exécute le corps, puis reteste. Si le compteur ne change pas, la boucle ne s'arrête pas et le délai coupe le programme.",
      "En affichant n puis en retirant 1, vous obtenez 3, 2, 1.",
      "L'affichage est dans la boucle. La diminution aussi. L'un sans l'autre ne convient pas.",
      null,
    )],
    [/accumulate$/, pack(
      "Ajouter une valeur à un total à chaque tour de boucle.",
      before,
      "total commence à 0, avant la boucle. Dans la boucle, total devient total plus la valeur du tour. L'affichage est après la boucle, une seule fois.",
      "Le total final apparaît une fois, pas une ligne par tour.",
      "Afficher le total dans la boucle montrerait les totaux intermédiaires. Ce n'est pas la même consigne.",
      null,
    )],
    [/collections$/, pack(
      "Lire une case précise d'une collection, en commençant à l'index 0.",
      before,
      "La première case est l'index 0, la deuxième l'index 1. Le nom de la collection suivi de l'index lit la case. Ce n'est pas un texte.",
      "valeurs[0] vaut 10. L'affichage montre 10.",
      "Écrire 10 directement ne lit pas la collection. L'index 1 lirait 20, pas la première case.",
      null,
    )],
    [/functions$/, pack(
      "Définir une fonction, puis l'appeler. La définition seule n'affiche rien.",
      before,
      "Le corps de la fonction est le bloc indenté ou entre accolades. L'appel, plus bas, exécute ce corps.",
      "L'appel affiche Pret. Sans appel, la Sortie reste vide même si la fonction est correcte.",
      "Remplacer l'appel par un affichage direct saute la notion d'appel.",
      null,
    )],
    [/c2-project$/, pack(
      "Assembler un test et deux messages pour décrire un niveau.",
      before,
      "Le seuil est 80. Au-dessus ou égal, un message. En dessous, l'autre. Les deux textes doivent être présents.",
      "Avec 85, la Sortie est Niveau eleve, sans accent : c'est le texte exact demandé.",
      "Le else reste écrit même s'il ne s'exécute pas pour 85. Il documente l'autre cas.",
      null,
    )],
    [/return$/, pack(
      "Renvoyer une valeur avec return, pour que l'appelant puisse l'afficher.",
      before,
      "return quitte la fonction et donne le résultat à l'endroit de l'appel. Un affichage dans la fonction ne remplace pas ce retour.",
      "L'appelant affiche ce qui a été renvoyé. Sans return utile, l'appelant n'a pas le calcul.",
      "return 0 est un résultat figé. Le return du calcul sert pour toutes les valeurs.",
      null,
    )],
    [/produit$/, pack(
      "Faire renvoyer le produit de deux paramètres, pas un nombre écrit en dur.",
      before,
      "prix * quantite est recalculé à chaque appel. L'affichage est déjà écrit autour de l'appel : ne le remplacez pas.",
      "produit(2, 2) affiche 4.",
      "return 4 ne marcherait que pour cet appel. L'exercice le refuse.",
      null,
    )],
    [/somme$/, pack(
      "Réutiliser la même fonction deux fois et additionner les retours.",
      before,
      "Chaque appel a ses propres arguments. Les deux résultats sont des nombres. Leur somme s'affiche une fois.",
      "8 × 1 et 3 × 2 font 8 et 6, donc 14.",
      "Gardez les deux appels. print(14) efface le calcul.",
      null,
    )],
    [/dict-sum$/, pack(
      "Parcourir une table et additionner ses valeurs.",
      before,
      "La boucle visite chaque entrée. total augmente de la valeur, pas de la clé. L'affichage du total est après la boucle.",
      "4 et 2 font 6. Une seule ligne : 6.",
      "Laisser l'affichage avant la boucle montre 0. Il faut le déplacer après.",
      null,
    )],
    [/dict$/, pack(
      "Lire une valeur à partir d'une clé texte, pas d'un index.",
      before,
      "La clé est entre guillemets, parce que c'est un texte. La table rend le nombre associé. Une clé absente est une erreur d'exécution.",
      "La clé Lea vaut 18.",
      "18 écrit tout seul ne consulte pas la table. Max vaudrait 12, ce n'est pas la clé demandée.",
      null,
    )],
    [/branch$/, pack(
      "Ajouter un cas précis avant le cas par défaut.",
      before,
      "Les cas sont testés dans l'ordre. Le cas par défaut ne doit pas passer devant le cas 3, sinon il vole l'exécution.",
      "jour vaut 3, donc Mercredi.",
      "Un affichage de Mercredi hors du cas 3 ne répond pas à la consigne.",
      null,
    )],
    [/c3-text$/, pack(
      "Transformer un texte avec l'outil du langage, sans réécrire le résultat à la main.",
      before,
      "La variable garde codeflow. La méthode de mise en majuscules fabrique un nouveau texte pour l'affichage.",
      "La Sortie est CODEFLOW.",
      "Taper CODEFLOW entre guillemets ignore la variable. L'exercice le refuse.",
      null,
    )],
    [/words$/, pack(
      "Compter les mots d'une phrase en la découpant sur les espaces.",
      before,
      "Le découpage produit une liste de mots. La longueur de cette liste est le nombre de mots, pas le nombre de lettres.",
      "un deux trois fait 3.",
      "print(3) ne découpe rien. L'outil de découpage doit rester visible.",
      null,
    )],
    [/ligne$/, pack(
      "Changer les arguments d'un appel pour changer le résultat, sans toucher à la formule.",
      before,
      "La fonction est déjà correcte. 2 et 2 donnent 4. 3 et 3 donnent 9. Seuls les arguments de l'appel changent.",
      "La Sortie devient 9.",
      "print(9) abandonne la fonction. L'appel doit rester.",
      null,
    )],
    [/c3-project$/, pack(
      "Calculer un total de ticket à partir d'une table de prix et de quantités.",
      before,
      "ligne reçoit la table, le nom et la quantité, puis renvoie prix fois quantité. Le total additionne trois appels. L'affichage montre le mot Total et la variable total.",
      "La Sortie exacte est Total 9.",
      "Total 9 écrit en un seul texte ne calcule rien. Le return doit multiplier la case par la quantité.",
      null,
    )],
    [/combine$/, pack(
      "Reprendre un calcul déjà vu avec de nouveaux nombres, sans guide ligne à ligne.",
      before,
      "Vous placez 4 et 6, puis vous affichez le produit. Le programme de départ a des zéros : ils doivent changer.",
      "4 × 6 font 24.",
      "C'est le même geste que l'addition, avec une multiplication. Le résultat figé est refusé.",
      null,
    )],
    [/fix$/, pack(
      "Réparer une ligne qui ne peut pas être lue, puis vérifier la Sortie.",
      before,
      "Le mot CodeFlow est un texte. Il lui manque le guillemet ouvrant. Une fois les deux guillemets en place, l'instruction redevient un affichage.",
      "La Sortie est CodeFlow.",
      "Ajouter un commentaire ne répare pas la syntaxe. Il faut corriger la ligne elle-même.",
      null,
    )],
    [/mini$/, pack(
      "Refaire seul un message construit avec une variable, sur un nouveau prénom.",
      before,
      "La variable nom vaut Alex. Vous ajoutez l'affichage qui colle Bonjour, une espace, et cette variable.",
      "La Sortie est Bonjour Alex.",
      "Le texte tout fait Bonjour Alex est refusé : la variable doit servir.",
      null,
    )],
    [/decision$/, pack(
      "Compléter un test déjà commencé, sans l'effacer.",
      before,
      "points vaut 15, le seuil est 10. Le bloc indenté affiche Validé seulement parce que le test est vrai.",
      "La Sortie est Validé.",
      "Gardez le if. Un affichage seul ne montre pas la décision.",
      null,
    )],
    [/c2-strings$|strings$/, pack(
      `Relire un texte ${L.name} : guillemets, variable, et affichage sont trois choses différentes.`,
      before,
      "La variable contient le texte. L'affichage de la variable montre son contenu. L'affichage d'un autre texte entre guillemets ignore la variable.",
      "Vous voyez la valeur stockée, pas le nom de la variable.",
      "Un texte peut contenir des espaces. Ils comptent dans la Sortie.",
      null,
    )],
    [/compose$/, pack(
      "Assembler un salut et une variable déjà remplie.",
      before,
      "L'espace est dans le texte fixe. La variable apporte le nom. L'affichage reçoit l'assemblage.",
      "La Sortie est Bonjour CodeFlow.",
      "Ne remplacez pas la variable par le mot CodeFlow dans les guillemets.",
      null,
    )],
    [/escape$/, pack(
      "Placer un caractère spécial dans un texte sans casser les guillemets.",
      before,
      "Une barre oblique inverse annonce un caractère spécial : souvent un guillemet à l'intérieur du texte, ou un passage à la ligne.",
      "La Sortie montre le caractère voulu, pas la barre oblique, sauf si la leçon demande de l'afficher.",
      "Un guillemet non annoncé ferme le texte trop tôt et provoque une erreur de syntaxe.",
      null,
    )],
  ];
  for (const [test, body] of rules) {
    if (test.test(id)) return { ...body, title };
  }
  return pack(
    `FALLBACK ${title}`,
    before,
    `Reliez chaque phrase de l'explication à un symbole de ${L.name}. ${L.run}.`,
    "Le résultat visible est celui de la Sortie, pas celui que vous imaginez.",
    `${L.block} ${L.end}`,
    null,
  );
}

function pushRule(ex, bucket, rule) {
  ex.validate.checks = ex.validate.checks || {};
  const list = ex.validate.checks[bucket] || [];
  const key = JSON.stringify(rule);
  if (!list.some((item) => JSON.stringify(item) === key)) list.push(rule);
  ex.validate.checks[bucket] = list;
}

function strengthen(lang, id, ex) {
  let changed = false;
  const before = JSON.stringify(ex.validate.checks || null);
  if (/l2-print$|-print$/.test(id)) {
    pushRule(ex, "mustInclude", {
      text: ex.validate.expected,
      message: "Affichez exactement le message demandé, accent et point d'exclamation compris.",
    });
    pushRule(ex, "forbidCheats", {
      pattern: "Bonjour",
      message: "Remplacez le texte de départ. Bonjour ne doit plus apparaître.",
    });
  }
  if (/several-prints$|l2-lines$/.test(id)) {
    pushRule(ex, "mustMatch", {
      pattern: "(print[\\s\\S]{0,200}print|WriteLine[\\s\\S]{0,200}WriteLine|cout[\\s\\S]{0,240}cout|println[\\s\\S]{0,200}println)",
      message: "Deux affichages sont nécessaires, un pour chaque ligne.",
    });
  }
  if (/-fix$/.test(id)) {
    pushRule(ex, "mustMatch", {
      pattern: "[\"']CodeFlow[\"']",
      message: "CodeFlow doit être un texte entre guillemets.",
    });
  }
  if (/functions$/.test(id)) {
    const starter = ex.starterCode;
    let pattern = "dire\\s*\\(";
    if (/def\s+dire/.test(starter)) pattern = "def\\s+dire\\s*\\([\\s\\S]{0,800}dire\\s*\\(";
    else if (/void\s+Dire/.test(starter)) pattern = "void\\s+Dire\\s*\\([\\s\\S]{0,800}Dire\\s*\\(";
    else if (/void\s+dire/.test(starter)) pattern = "void\\s+dire\\s*\\([\\s\\S]{0,800}dire\\s*\\(";
    pushRule(ex, "mustMatch", {
      pattern,
      message: "Définissez la fonction puis appelez-la. Un affichage isolé ne suffit pas.",
    });
    pushRule(ex, "mustInclude", { text: "Pret", message: "Le corps doit afficher Pret." });
  }
  if (/l4-loops$|c2-for$/.test(id)) {
    const pattern = {
      python: "print\\s*\\(\\s*i\\s*\\)",
      csharp: "WriteLine\\s*\\(\\s*i\\s*\\)",
      cpp: "cout\\s*<<\\s*i\\b",
      java: "println\\s*\\(\\s*i\\s*\\)",
    }[lang];
    pushRule(ex, "mustMatch", {
      pattern,
      message: "Affichez la variable de boucle i. Ne recopiez pas les nombres un par un.",
    });
  }
  if (/dict-sum$/.test(id)) {
    pushRule(ex, "mustMatch", {
      pattern: "total\\s*(\\+=|=\\s*total\\s*\\+)",
      message: "Ajoutez chaque valeur au total dans la boucle. N'écrivez pas 6 directement.",
    });
  }
  changed = JSON.stringify(ex.validate.checks || null) !== before;
  return changed;
}

function reshapePrompt(lesson) {
  const ex = lesson.exercise;
  const parts = ex.prompt.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const task = parts[parts.length - 1];
  const earlier = parts.slice(0, -1).join(" ");
  const expected = ex.validate.expected.replace(/\n/g, "↵");
  ex.objective = lesson.sections.find((s) => s.heading === "Objectif")?.body || lesson.title;
  ex.concept = lesson.title;
  ex.prompt = [
    `Objectif. ${ex.objective}`,
    earlier
      ? `Marche à suivre. ${earlier}`
      : "Marche à suivre. Partez du programme proposé et modifiez seulement ce que la tâche demande.",
    `Contraintes. La sortie comparée est exactement « ${expected} ». Majuscules, espaces, accents et retours à la ligne comptent. Afficher ce texte sans la notion de la leçon est refusé quand un contrôle de structure est prévu.`,
    task,
  ].join("\n\n");
}

function enrichLesson(lang, lesson, prevTitle) {
  const body = concept(lang, lesson.id, lesson.title, prevTitle);
  const sections = [
    { type: "prose", heading: "Objectif", body: body.objective },
    { type: "prose", heading: "Prérequis", body: body.prereq },
  ];
  let explained = false;
  for (const section of lesson.sections) {
    if (section.type === "prose" && section.body) {
      sections.push({
        type: "prose",
        heading: explained ? undefined : "Explication",
        body: section.body,
      });
      explained = true;
    } else if (section.type === "code" && section.code) {
      sections.push({ type: "code", code: section.code });
      sections.push({ type: "prose", heading: "Comment ça marche", body: body.how });
      sections.push({ type: "prose", heading: "Résultat attendu", body: body.result });
    }
  }
  if (!lesson.sections.some((section) => section.type === "code") && body.example) {
    sections.push({ type: "code", code: body.example });
    sections.push({ type: "prose", heading: "Comment ça marche", body: body.how });
    sections.push({ type: "prose", heading: "Résultat attendu", body: body.result });
  } else if (!lesson.sections.some((section) => section.type === "code")) {
    sections.push({ type: "prose", heading: "Comment ça marche", body: body.how });
    sections.push({ type: "prose", heading: "Résultat attendu", body: body.result });
  }
  sections.push({ type: "prose", heading: "À retenir", body: body.recap });
  lesson.sections = sections;
}

const report = {
  lessons: 0,
  lessonsExpanded: 0,
  lessonsCoreKept: 0,
  exercises: 0,
  promptsRestructured: 0,
  checksStrengthened: 0,
  expectedKept: 0,
  starterKept: 0,
  quizzes: 0,
  quizNotesExtended: 0,
  unmatched: [],
};

for (const lang of ["python", "csharp", "cpp", "java"]) {
  const trackPath = new URL(`${lang}/track.json`, root);
  const track = JSON.parse(fs.readFileSync(trackPath, "utf8"));
  let prev = null;
  for (const level of track.levels) {
    for (const lesson of level.lessons) {
      report.lessons += 1;
      const originalWords = (lesson.sections || [])
        .filter((s) => s.type === "prose")
        .map((s) => s.body || "")
        .join(" ");
      const originalProse = (lesson.sections || [])
        .filter((s) => s.type === "prose")
        .map((s) => s.body)
        .join("\n");
      enrichLesson(lang, lesson, prev);
      const stillThere = (lesson.sections || [])
        .filter((s) => s.heading === "Explication" || !s.heading)
        .map((s) => s.body || "")
        .join("\n");
      if (originalProse && stillThere.includes(originalProse.split("\n")[0])) report.lessonsCoreKept += 1;
      report.lessonsExpanded += 1;
      if (String(lesson.sections[0]?.body || "").startsWith("FALLBACK")) {
        report.unmatched.push(lesson.id);
      }
      if (lesson.exercise) {
        report.exercises += 1;
        const expected = lesson.exercise.validate.expected;
        const starter = lesson.exercise.starterCode;
        reshapePrompt(lesson);
        report.promptsRestructured += 1;
        if (strengthen(lang, lesson.id, lesson.exercise)) report.checksStrengthened += 1;
        if (lesson.exercise.validate.expected === expected) report.expectedKept += 1;
        if (lesson.exercise.starterCode === starter) report.starterKept += 1;
      }
      prev = lesson.title;
    }
  }
  fs.writeFileSync(trackPath, JSON.stringify(track, null, 2) + "\n");

  const quizPath = new URL(`${lang}/quiz.json`, root);
  const quiz = JSON.parse(fs.readFileSync(quizPath, "utf8"));
  for (const question of quiz.questions) {
    report.quizzes += 1;
    if (question.explanation.length < 110) {
      const choice = question.choices[question.answer];
      question.explanation = `${question.explanation} La réponse juste est : ${choice} Les autres propositions décrivent un autre mécanisme, déjà écarté par la leçon correspondante.`;
      report.quizNotesExtended += 1;
    }
  }
  fs.writeFileSync(quizPath, JSON.stringify(quiz, null, 2) + "\n");
}

const badPatterns = [];
for (const lang of ["python", "csharp", "cpp", "java"]) {
  const track = JSON.parse(fs.readFileSync(new URL(`${lang}/track.json`, root), "utf8"));
  for (const level of track.levels) {
    for (const lesson of level.lessons) {
      const checks = lesson.exercise?.validate?.checks;
      if (!checks) continue;
      for (const rule of [...(checks.mustMatch || []), ...(checks.forbidCheats || [])]) {
        const pattern = typeof rule === "string" ? rule : rule.pattern;
        if (!pattern) continue;
        try {
          new RegExp(pattern);
        } catch (error) {
          badPatterns.push(`${lesson.exercise.id}: ${pattern} (${error.message})`);
        }
      }
    }
  }
}
report.badPatterns = badPatterns;
console.log(JSON.stringify(report, null, 2));
