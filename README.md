# BetterPip

BetterPip est un CLI fait avec NodeJS (oui oui) visant à améliorer `pip` pour les développeurs Python.


## Prérequis

* [nodejs v15+ et npm](https://nodejs.org) installé sur votre système.
* [Python](https://www.python.org) et [Pip](https://pypi.org/project/pip) installé sur votre système.
	* La commande de Python doit être `python`, `python2`, ou `python3` (les commandes telles que `python2.9` ne sont pas compatible).
	* La commande de Pip doit être `pip`.
* [Git](https://git-scm.com) installé sur votre système.


## Installation

**Via NPM :**
```bash
$ (sudo) npm install --global betterpip
```

**Installation automatique :**

*script permettant d'installer NodeJS/npm, python/pip et git automatiquement*

* [Windows](https://github.com/johan-perso/betterpip/blob/main/installation_script/windows.cmd)
* [Unix](https://github.com/johan-perso/betterpip/blob/main/installation_script/unix.sh) : `curl -sL https://raw.githubusercontent.com/johan-perso/betterpip/main/installation_script/unix.sh | bash`


## Pourquoi ?

Car Pip n'est pas assez complet, alors que npm (l'équivalent pour NodeJS) l'est bien plus, et permet des choses telle qu'installer un CLI en une commande.

Etant plus un développeur NodeJS qu'un développeur Python, j'ai crée ce CLI avec une syntaxe similaire à NPM, mais en utilisant les éléments de Pip.


## Wiki

Le wiki est disponible [ici](https://github.com/johan-perso/betterpip/wiki).


## Licence

MIT © [Johan](https://johanstick.me)
