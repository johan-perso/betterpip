#!/usr/bin/env bash

# Si Betterpip est déjà installé
if hash betterpip 2>/dev/null; then
	echo "Betterpip est déjà installé"
	exit 0
fi

# Si Git n'est pas installé, l'installer
if hash git 2>/dev/null; then
	echo "Git est déjà installé"
else
	echo "Git n'est pas installé, installation..."
	sudo apt-get install -y git
fi

# Si Python n'est pas installé, l'installer
if hash python3 2>/dev/null; then
	echo "Python est déjà installé"
else
	echo "Python n'est pas installé, installation..."
	sudo apt-get install -y python3.6
fi

# Si NodeJS n'est pas installé, l'installer
if hash node 2>/dev/null; then
	echo "NodeJS est déjà installé"
else
	echo "NodeJS n'est pas installé, installation..."
	curl -sL https://deb.nodesource.com/setup_14.x | sudo bash -
	sudo apt-get install -y nodejs
fi

# Télécharger Betterpip
echo "Téléchargement de Betterpip"
git clone https://github.com/johan-perso/betterpip.git
cd betterpip

# Installer Betterpip
echo "Installation de Betterpip"
npm install
sudo npm link

# Nettoyer
echo "Nettoyage..."
rm .git -rf
rm installation_script -rf
rm LICENSE
rm package-lock.json
rm README.md
cd ..

echo "Installation terminée"
exit 0
