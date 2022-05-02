@echo off
@rem

betterpip -v >nul 2>&1 && (
	echo BetterPip est déjà installé.
	pause
) || (
	rem Si Git n'est pas installé, l'installer
	git --version >nul 2>&1 || (
		echo Git n'est pas installé, installation...
		winget install Git.Git
	)

	rem Si NodeJS n'est pas installé, l'installer
	node -v >nul 2>&1 || (
		echo NodeJS n'est pas installé, installation...
		winget install OpenJS.NodeJS
	)

	rem Si Python n'est pas installé, l'installer
	python --version >nul 2>&1 || (
		echo Python n'est pas installé, installation...
		winget install Python.Python.3
	)

	rem Si Pip n'est pas installé, l'installer
	pip -V >nul 2>&1 || (
		echo Pip n'est pas installé, installation...
		winget install Python.Pip
	)

	rem Télécharger et installer BetterPip
	echo Téléchargement de BetterPip...
	git clone https://github.com/johan-perso/betterpip.git
	cd betterpip
	echo Installation de BetterPip...
	npm install
	npm link

	rem Nettoyage
	del .git /F /Q
	del installation_script /F /Q
	del LICENSE
	del README.md
	del package-lock.json
	cd ..

	rem Dire que c'est bon
	echo BetterPip est installé.
	pause
)
