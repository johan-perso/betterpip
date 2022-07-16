#!/usr/bin/env node

// Lazy Load Modules
var _require = require;
var require = function (moduleName) {
    var module;
    return new Proxy(function () {
        if (!module) {
            module = _require(moduleName)
        }
        return module.apply(this, arguments)
    }, {
        get: function (target, name) {
            if (!module) {
                module = _require(moduleName)
            }
            return module[name];
        }
    })
};

// Importer quelques librairies
const chalk = require('chalk');
const boxen = require('boxen');
const inquirer = require('inquirer');
const open = require('open');
const fs = require('fs');
const path = require('path');
const ora = require('ora'); var spinner = ora();

// Obtenir le nom des commandes à utiliser
var pythonCommand;
var pipCommand = (process?.env?.BETTERPIP_PIP_COMMAND?.length) ? process.env.BETTERPIP_PIP_COMMAND : "pip"

// Système de mise à jour
const pkg = require('./package.json')
const notifier = require('update-notifier')({ pkg, updateCheckInterval: 10 })
if(!process.env.BETTERPIP_SILENT_OUTPUT && notifier.update && pkg.version !== notifier.update.latest){
	console.log(boxen("Mise à jour disponible " + chalk.dim(pkg.version) + chalk.reset(" → ") + chalk.green(notifier.update.latest) + "\n" + chalk.cyan("npm i -g " + pkg.name) + " pour mettre à jour", {
		padding: 1,
		margin: 1,
		align: 'center',
		borderColor: 'yellow',
		borderStyle: 'round'
	}))
}

// Fonction pour afficher un assistant de création de package
async function createPackage(){
	// Préparer la liste des informations à inclure dans le package
	var answers = {}

	// Si l'argument -y est présent
	if(process.argv.includes('-y') || process.env.BETTERPIP_DEFAULT_VALUE_FOR_INIT || process.env.BETTERPIP_SILENT_OUTPUT){
		answers.name = path.basename(process.cwd())
		answers.description = ""
		answers.author = require('os').userInfo().username
		answers.globalCommands = []
		if(!answers.mainFile && fs.existsSync(path.join(process.cwd(), '__init__.py'))) answers.mainFile = '__init.py'
		if(!answers.mainFile && fs.existsSync(path.join(process.cwd(), 'app.py'))) answers.mainFile = 'app.py'
		if(!answers.mainFile && fs.existsSync(path.join(process.cwd(), 'main.py'))) answers.mainFile = 'main.py'
		if(!answers.mainFile && fs.existsSync(path.join(process.cwd(), 'index.py'))) answers.mainFile = 'index.py'
		if(!answers.mainFile) answers.mainFile = fs.readdirSync(process.cwd()).find(file => file.endsWith('.py'))
		if(!answers.mainFile) answers.mainFile = "" // Si on a trouvé aucun fichier, on en met pas
	} else { // Sinon, demander les informations à l'utilisateur
		// Afficher une aide
		console.log(`Cet assistant vous permet de générer un fichier "python-package.json" pour ce projet.\nToutes les valeurs sont facultatives à l'exception du fichier principale.\n`)

		// Poser des questions avec Inquirer
		answers = await inquirer.prompt([
			{
				type: 'input',
				name: 'name',
				message: 'Nom',
				default: path.basename(process.cwd())
			},
			{
				type: 'input',
				name: 'description',
				message: 'Description'
			},
			{
				type: 'input',
				name: 'author',
				message: 'Auteur',
				validate: function(value){
					if(value.length > 48){
						return 'Veuillez entrer un nom de moins de 48 caractères';
					}
					return true;
				}
			},
			{
				type: 'input',
				name: 'mainFile',
				message: 'Chemin du fichier principal',
				validate: function(value){
					// Si y'a aucune valeur, on s'en fout du reste :)
					if(!value) return true;

					// Vérifier si le fichier existe
					if(!fs.existsSync(path.join(value))){
						return `Le fichier "${value}" n'existe pas`;
					}

					// Vérifier si le fichier est un fichier python
					if(path.extname(value) != '.py'){
						return 'Le fichier n\'est pas un fichier python';
					}

					// Sinon bah niquel
					return true;
				}
			},
			{
				type: 'input',
				name: 'globalCommands',
				message: 'Commandes globales pour lancer le script',
				validate: function(value){
					// Diviser par chaque virgule
					var commands = value.split(',')
					
					// Si il n'y a aucun élement, on arrête les vérifications d'après
					if(!commands.length || (commands.length == 1 && commands[0] == '')) return true

					// Vérifier chaque commande
					for(var i = 0; i < commands.length; i++){
						// Si une commande contient un espace, refuser
						if(commands[i].includes(' ')) return "Les commandes ne doivent pas contenir d'espace, si vous souhaiter en mettre plusieurs, séparez-les par une virgule"

						// Si une commande contient un caractère non alphanumérique, refuser
						if(!commands[i].match(/^[a-zA-Z0-9-]+$/)) return "Les commandes ne doivent pas contenir de caractères spéciaux"

						// Si une commande fait parti d'une liste de commande déjà utilisé par la plupart des systèmes
						if(isCommonCommand(commands[i])) return `La commande "${commands[i]}" est déjà utilisé par certain systèmes`

						// Vérifier que le fichier ne contient pas de caractère non autorisé sur un système Unix
						if(commands[i].includes('/') || commands[i].includes('\\')) return `La commande "${commands[i]}" contient un caractère non autorisé`

						// Vérifier que le fichier ne contient pas de caractère non autorisé sur un système Windows
						if(commands[i].includes('*') || commands[i].includes('?') || commands[i].includes('"') || commands[i].includes('<') || commands[i].includes('>') || commands[i].includes('|')) return `La commande "${commands[i]}" contient un caractère non autorisé`
					}

					// Si tout est ok, retourner true
					return true
				}
			}
		])

		// Avoir une meilleure liste des commandes globales
		var globalCommands = answers.globalCommands.split(',')
		if(!globalCommands.length || (globalCommands.length == 1 && globalCommands[0] == '')) globalCommands = null
	}

	// Créer le package
	var package = {
		name: answers.name || "",
		description: answers.description || "",
		author: answers.author || "",
		mainFile: path.join(answers.mainFile || '').replace(path.join(process.cwd(), './'), '') || "",
		globalCommands: globalCommands || []
	}

	// Créer le fichier python-package.json
	fs.writeFileSync(path.join(process.cwd(), 'python-package.json'), JSON.stringify(package, null, 2))

	// Afficher le résultat
	console.log(chalk.bold(`\nLe package a été créé avec succès !`) + `\nLes dépendances s'ajouteront quand vous en installerez une depuis BetterPip.`)

	// Ouvrir le fichier si la variable est défini
	if(process.env.BETTERPIP_OPEN_PACKAGE_AFTER_INIT) open(path.join(process.cwd(), 'python-package.json'))
}

// Fonction pour vérifier si une commande fait pas parti de la liste des commandes les plus courantes
function isCommonCommand(command){
	// Liste des commandes les plus courantes
	var common_cmd = ["cscript","wscript","active","add","append","arp","assign","assoc","at","atmadm","attach-vdisk","attrib","attributes","auditpol","autochk","autoconv","autofmt","automount","bcdboot","bcdedit","bdehdcfg","begin","bitsadmin","bootcfg","break","cacls","call","cd","certreq","certutil","change","chcp","chdir","chglogon","chgport","chgusr","chkdsk","chkntfs","choice","cipher","clean","cleanmgr","clip","cls","cmd","cmdkey","cmstp","color","comp","compact","convert","copy","cprofile","create","date","dcgpofix","defrag","del","delete","detach","detail","dfsdiag","dfsrmig","diantz","dir","diskcomp","diskcopy","diskpart","diskperf","diskraid","diskshadow","dispdiag","dnscmd","doskey","driverquery","echo","edit","endlocal","end","erase","eventcreate","eventquery","eventtriggers","Evntcmd","exec","exit","expand","expose","extend","extract","fc","filesystems","find","findstr","finger","flattemp","fondue","for","forfiles","format","freedisk","fsutil","ftp","ftype","fveupdate","getmac","gettype","goto","gpfixup","gpresult","gpt","gpupdate","graftabl","help","helpctr","hostname","icacls","if","import","inactive","inuse","ipconfig","ipxroute","irftp","jetpack","klist","ksetup","ktmutil","ktpass","label","list","load","lodctr","logman","logoff","lpq","lpr","macfile","makecab","manage","mapadmin","md","merge","mkdir","mklink","mmc","mode","more","mount","mountvol","move","mqbkup","mqsvc","mqtgsvc","msdt","msg","msiexec","msinfo32","mstsc","nbtstat","netcfg","net","netsh","netstat","nfsadmin","nfsshare","nfsstat","nlbmgr","nslookup","ntbackup","ntcmdprompt","ntfrsutl","offline","online","openfiles","pagefileconfig","path","pathping","pause","pbadmin","pentnt","perfmon","ping","pnpunattend","pnputil","popd","powershell","print","prncnfg","prndrvr","prnjobs","prnmngr","prnport","prnqctl","prompt","pubprn","pushd","pushprinterconnections","pwlauncher","qappsrv","qprocess","query","quser","qwinsta","rcp","rd","rdpsign","recover","refsutil","reg","regini","regsvr32","relog","rem","remove","ren","rename","repair","replace","rescan","reset","retain","revert","rexec","risetup","rmdir","robocopy","route","rpcinfo","rpcping","rsh","rundll32","rwinsta","san","sc","schtasks","scwcmd","secedit","select","serverceipoptin","servermanagercmd","serverweroptin","set","setlocal","setx","sfc","shadow","shift","showmount","shrink","shutdown","simulate","sort","start","subcommand","subst","sxstrace","sysocmgr","systeminfo","takeown","tapicfg","taskkill","tasklist","tcmsetup","telnet","tftp","time","timeout","title","tlntadmn","tpmtool","tpmvscmgr","tracerpt","tracert","tree","tscon","tsdiscon","tsecimp","tskill","tsprof","type","typeperf","tzutil","unexpose","uniqueid","unlodctr","ver","verifier","verify","vol","vssadmin","waitfor","wbadmin","wdsutil","wecutil","wevtutil","where","whoami","winnt","winnt32","winpop","winrs","winsat","wmic","writer","xcopy"]
	var common_powershell = ["Get-ChildItem","Invoke-Command","Import-Module","Export-Csv","Write-Host","Get-WmiObject","Get-Content","Get-Date","Invoke-WebRequest","Start-Process","Copy-Item","Set-ExecutionPolicy","Out-File","Where-Object","Import-Csv","Send-MailMessage","New-Object","Select-String","Remove-Item","Select-Object","Test-Path","Invoke-RestMethod","Install-Package","ForEach-Object","Write-Output","Get-Process","Get-Service","Format-Table","Test-Connection","New-Item","Get-EventLog","Get-WinEvent","Install-Module","Enter-PSSession","Get-Credential","Read-Host","Get-AppxPackage","Get-Acl","Get-Help","Start-Job","Add-PSSnapin","New-PSSession","Invoke-Expression","Add-Content","New-PSDrive","Move-Item","Get-Item","Compare-Object","Sort-Object","Test-NetConnection","Set-Acl","Set-Content","Start-Transcript","Get-HotFix","Get-ItemProperty","Add-Member","Remove-AppxPackage","Rename-Item","Add-Type","Get-Member","ConvertTo-SecureString","New-SelfSignedCertificate","Start-Sleep","Restart-Computer","Out-GridView","Format-List","Set-ItemProperty","Measure-Object","Split-Path","Get-Counter","Get-CimInstance","Add-Computer","Add-AppxPackage","ConvertTo-Html","Import-StartLayout","Set-Location","Get-NetAdapter","Export-StartLayout","Enable-PSRemoting","Get-Command","Get-ExecutionPolicy","Join-Path","Import-PSSession","Get-FileHash","Write-Error","Stop-Service","Stop-Process","Start-Service","Unblock-File","Get-Disk","Get-Module","ConvertTo-Json","New-WebServiceProxy","Reset-ComputerMachinePassword","Get-ScheduledTask","Write-EventLog","Set-Service","Out-String","Get-Printer","Out-Null","Resolve-DnsName","Get-WindowsUpdateLog","Restart-Service","Set-Variable","Compress-Archive","ConvertFrom-Json","New-SmbShare","Set-Item","Update-Help","Group-Object","Start-BitsTransfer","Get-Certificate","Register-ScheduledTask","Tee-Object","Test-ComputerSecureChannel","Measure-Command","ConvertFrom-SecureString","Get-Job","Export-Clixml","ConvertTo-Csv","Remove-AppxProvisionedPackage","New-ItemProperty","Get-PhysicalDisk","Set-TimeZone","Get-Package","Get-SmbShare","Get-Variable","Add-Printer","Resolve-Path","Select-Xml","Get-Random","Get-PSDrive","Expand-Archive","Receive-Job","New-NetFirewallRule","New-NetIPAddress","Get-NetIPAddress","Register-ObjectEvent","Get-SmbConnection","New-TimeSpan","Enable-WindowsOptionalFeature","Set-NetConnectionProfile","New-ScheduledTaskTrigger","Rename-Computer","Get-Event","Test-WSMan","Get-AppxProvisionedPackage","Wait-Process","Wait-Job","Write-Debug","Import-Certificate","New-EventLog","Get-Host","Invoke-WmiMethod","Update-Script","New-Service","ConvertFrom-Csv","Invoke-Item","Enable-WSManCredSSP","Get-Unique","Find-Package","Out-Host","Format-Volume","Format-Custom","Get-SmbServerConfiguration","Mount-DiskImage","Clear-Host","Start-DscConfiguration","Get-SmbOpenFile","Add-VpnConnection","Set-DnsClientServerAddress","Export-ModuleMember","Get-PSSession","Get-PSSnapin","Get-NetConnectionProfile","Get-NetFirewallRule","Push-Location","Get-Volume","New-NetLbfoTeam","Get-NetTCPConnection","Stop-Computer","Set-StrictMode","Set-NetFirewallRule","Add-AppxProvisionedPackage","Enable-BitLocker","Get-Location","Set-NetIPInterface","New-VirtualDisk","Remove-PSSession","Set-NetIPAddress","Register-ScheduledJob","Set-SmbServerConfiguration","New-Partition","Remove-PSDrive","Remove-Variable","Get-WindowsOptionalFeature","Import-Clixml","Import-PfxCertificate","Uninstall-Package","Set-AuthenticodeSignature","Set-NetAdapter","Set-Alias","Set-WmiInstance","Disable-WindowsOptionalFeature","Update-Module","New-LocalUser","Mount-WindowsImage","Get-ItemPropertyValue","New-Alias","New-JobTrigger","Get-History","New-CimSession","Get-LocalGroup","ConvertTo-Xml","New-PSSessionOption","Add-WindowsCapability","New-Variable","Convert-Path","Get-LocalGroupMember","Add-WindowsPackage","Invoke-CimMethod","ConvertFrom-String","Export-Certificate","Unregister-ScheduledTask","ConvertFrom-StringData","Install-PackageProvider","Get-LocalUser","Clear-Content","Remove-Module","Get-VpnConnection","Export-PfxCertificate","Get-NetIPConfiguration","Export-WindowsDriver","Grant-SmbShareAccess","Initialize-Disk","Get-NetIPInterface","Get-PfxCertificate","Invoke-Pester","Add-OdbcDsn","Format-Wide","Get-Partition","Set-Disk","Get-ScheduledJob","Get-PnpDevice","Get-Tpm","Disable-NetAdapterBinding","Get-PSRepository","Out-Default","Add-PrinterDriver","Set-WinUserLanguageList","Get-ScheduledTaskInfo","Enable-NetFirewallRule","Out-Printer","Add-PrinterPort","Set-WinSystemLocale","Find-Module","Get-NetAdapterVmq","Stop-Transcript","Get-SmbSession","Set-PSSessionConfiguration","Add-MpPreference","Set-SmbShare","Set-VpnConnection","Start-ScheduledTask","Suspend-BitLocker","Get-SmbShareAccess","Set-PSDebug","Get-StartApps","Add-VpnConnectionRoute","Get-VirtualDisk","Write-Information","New-ScheduledTask","Set-Culture","New-ScheduledTaskSettingsSet","New-ScheduledTaskAction","Set-Partition","Clear-Variable","Add-KdsRootKey","Exit-PSSession","Add-LocalGroupMember","Set-LocalUser","Remove-Computer","New-NetNat","Set-SmbClientConfiguration","Set-ScheduledTask","Remove-ItemProperty","Set-Printer","Set-PhysicalDisk","Set-Date","Repair-WindowsImage","Set-NetAdapterVmq","Remove-WmiObject","New-NetRoute","Optimize-Volume","New-Volume","New-StoragePool","New-SmbMapping","Set-DscLocalConfigurationManager","New-ScheduledTaskPrincipal","Get-Culture","Set-PSRepository","Set-NetFirewallProfile","Get-Alias","Get-DnsClientServerAddress","Set-MpPreference","Save-Module","Resize-Partition","Repair-Volume","Remove-Printer","Remove-PhysicalDisk","Remove-NetIPAddress","Register-PSRepository","Get-WindowsCapability","Get-BitLockerVolume","Get-Clipboard","Get-ComputerInfo","Get-InitiatorPort","Get-BitsTransfer","Get-AuthenticodeSignature","Get-AppvClientPackage","Set-WSManQuickConfig","New-Guid","Get-StorageJob","Uninstall-Module","Get-InstalledModule","Confirm-SecureBootUEFI","Set-Clipboard","Get-TlsCipherSuite","Clear-Disk"]
	var common_unix = ["cd", "ls", "pwd", "mkdir", "rmdir", "rm", "cp", "mv", "touch", "chmod", "chown", "chgrp", "ln", "cat", "less", "more", "grep", "fgrep", "egrep", "fgrep", "sed", "awk", "sort", "uniq", "head", "tail", "zcat", "zip", "gzip", "gunzip", "bzip2", "bunzip2", "bzcat", "tar", "untar", "xz", "unxz", "uncompress", "gzip", "gunzip", "zip", "unzip", "touch", "unalias", "alias", "man", "exit", "shutdown", "sudo", "htop", "top", "apt", "yum", "pacman", "brew", "echo", "ps", "kill", "ping", "history", "passwd", "which", "where", "shred", "type", "whoami", "whatis", "curl", "wget", "ssh"]
	var common_cli = ["vim", "vi", "neofetch", "python", "python3", "pip", "node", "npm", "heroku", "vercel", "vc", "twitterminal", "screen", "pm2", "nano", "emacs"]

	// Faire les vérifications
	if(common_cmd.includes(command)) return true
	if(common_powershell.includes(command)) return true
	if(common_unix.includes(command)) return true
	if(common_cli.includes(command)) return true
	return false
}

// Fonction pour vérifier si une commande existe sur le système
async function isCommandExist(command){
	// Vérifier si la commande existe
	var path = await require('lookpath').lookpath(command)

	// Retourner le résultat
	if(path) return true
	else return false
}

// Fonction pour déterminer la commande de python à utiliser (python, python2, python3, etc)
async function getPythonVersion(){
	// Si la variable est déjà défini
	if(pythonCommand) return pythonCommand

	// Si une variable d'environnement est définie
	if(process?.env?.BETTERPIP_PYTHON_COMMAND?.length){
		pythonCommand = process.env.BETTERPIP_PYTHON_COMMAND
		return pythonCommand
	}

	// Crée une promise
	return new Promise(async (resolve, reject) => {
		// Vérifier si python est installé
		var python = await isCommandExist('python')
		var python2 = await isCommandExist('python2')
		var python3 = await isCommandExist('python3')

		// Faire un array avec les versions installées
		var versions = []
		if(python) versions.push('python')
		if(python2) versions.push('python2')
		if(python3) versions.push('python3')

		// Si aucune version
		if(!versions.length){
			// Afficher un message d'erreur
			console.log(chalk.red('Aucune version de python n\'est trouvée sur votre système !'))
			console.log(chalk.dim('Commande essayées : ') + chalk.dim.bold('python, python2, python3'))

			// Rejetter la promise
			reject('No python version found')
			process.exit()
		}

		// Donner la meilleure version
		if(python3) pythonCommand = 'python3'
		else if(python2) pythonCommand = 'python2'
		else pythonCommand = 'python'
		return resolve(pythonCommand)
	})
}

// Fonction pour installer une commande
async function installCommand(command, filePath){
	// Importer os
	var os = require('os')

	// Crée une promise
	return new Promise(async (resolve, reject) => {
		// Sous Windows
		if(process.platform == 'win32'){
			// Vérifier si le dossier betterpip existe
			if(!fs.existsSync(path.join(os.homedir(), 'AppData', 'Roaming', 'BetterPip'))){
				console.log(chalk.bold(`Le dossier BetterPip n'existe pas, exécuter la commande ${chalk.blue('betterpip doctor')} et réesayer.`))
				reject('Dossier BetterPip introuvable.')
				process.exit()
			}

			// Dans ce dossier, crée un fichier .cmd vers le fichier avec le nom de la commande
			fs.writeFileSync(path.join(os.homedir(), 'AppData', 'Roaming', 'BetterPip', `${command}.cmd`), `@echo off\n@rem\nrem better-pip_v${require('./package.json').version}\n${await getPythonVersion()} ${path.resolve(filePath)}`, { encoding: 'utf8' })

			// Retourner true
			resolve(true)
		}

		// Sous Linux, macOS ou Android
		else if(process.platform == 'linux' || process.platform == 'darwin' || process.platform == 'android'){
			// Dans le dossier /usr/local/bin, crée un fichier avec le nom de la commande
			fs.writeFileSync(path.join('/usr/local/bin', command), `#!/bin/bash\n# better-pip_v${require('./package.json').version}\n${await getPythonVersion()} ${path.resolve(filePath.replace(/\\/g,'/'))}`, { encoding: 'utf8' })

			// Rendre le fichier exécutable
			fs.chmodSync(path.join('/usr/local/bin', command), '755')

			// Retourner true
			resolve(true)
		}
	})
}

// Fonction pour supprimer une commande
async function removeCommand(commandName){
	// Importer os
	var os = require('os')

	// Crée une promise
	return new Promise(async (resolve, reject) => {
		// Sous Windows
		if(process.platform == 'win32'){
			// Vérifier si le dossier betterpip existe
			if(!fs.existsSync(path.join(os.homedir(), 'AppData', 'Roaming', 'BetterPip'))){
				console.log(chalk.bold(`Le dossier BetterPip n'existe pas, exécuter la commande ${chalk.blue('betterpip doctor')} et réesayer.`))
				reject('Dossier BetterPip introuvable.')
				process.exit()
			}

			// Trouver et supprimer si il existe la commande
			if(fs.existsSync(path.join(os.homedir(), 'AppData', 'Roaming', 'BetterPip', `${commandName}.cmd`))){
				fs.unlinkSync(path.join(os.homedir(), 'AppData', 'Roaming', 'BetterPip', `${commandName}.cmd`))
				resolve('COMMAND_DELETED')
			} else {
				resolve('COMMAND_NOT_FOUND')
			}
		}

		// Sous Linux, macOS ou Android
		else if(process.platform == 'linux' || process.platform == 'darwin' || process.platform == 'android'){
			// Dans le dossier /usr/local/bin, trouver un fichier avec le nom de la commande
			if(fs.existsSync(path.join('/usr/local/bin', commandName))){
				// Obtenir son contenu
				var content = fs.readFileSync(path.join('/usr/local/bin', commandName), { encoding: 'utf8' })

				// Si le fichier ne contient pas "# better-pip_v"
				if(!content.includes('# better-pip_v')) resolve('INVALID_COMMAND');

				// Si c'est le cas contraire, supprimer
				else {
					// Supprimer le fichier
					fs.unlinkSync(path.join('/usr/local/bin', commandName))

					// Retourner true
					resolve('COMMAND_DELETED')
				}
			}

			// Si il n'existe pas
			else resolve('COMMAND_NOT_FOUND')
		}
	})
}

// Fonction pour installer des modules depuis le fichier package
async function installModuleFromPackage(){
	// Obtenir le package
	var pythonPackage;
	try { pythonPackage = _require(path.join(process.cwd(), 'python-package.json')) } catch(err){ pythonPackage = {} }

	// Vérifier qu'il y a des modules à installer
	if(!pythonPackage.dependencies) return console.log(chalk.red(`Aucun module n'a été défini dans le fichier package. Pour installer un module par son nom, utiliser la commande comme ceci : `) + chalk.red.bold('betterpip install NomDuModule'))

	// Installer les modules
	for(var module in pythonPackage.dependencies){
		if(pythonPackage.dependencies[module] == '*') await installModule(module)
		else await installModule(`${module}==${pythonPackage.dependencies[module]}`)
	}
}

// Fonction pour installer un CLI depuis GitHub
async function installCliFromGithub(){
	// Obtenir le nom du repo
	var fullName = process.argv?.join(' ')?.replace(process.argv[0], '')?.replace(process.argv[1], '')?.replace(process.argv[2], '')?.replace('-g','')?.replace('--global','')?.replace('--github','')?.trim()

	// Si aucun nom de repo donnée
	if(!fullName) return console.log(chalk.red(`Aucun nom de répertoire n'a été défini. Pour installer un CLI depuis GitHub, utiliser la commande comme ceci : `) + chalk.red.bold('betterpip install --github CréateurDuRepo/NomDuRepo'))

	// Obtenir le nom du repo, et le nom de son créateur
	var [owner, repo] = fullName?.replace('https://github.com/','')?.replace('http://github.com/','')?.split('/')

	// Si aucun nom de créateur/nom de répertoire
	if(!owner) return console.log(chalk.red(`Aucun nom de créateur n'a été défini. Pour installer un CLI depuis GitHub, utiliser la commande comme ceci : `) + chalk.red.bold(`betterpip install --github ${chalk.underline('CréateurDuRepo')}/NomDuRepo`))
	if(!repo) return console.log(chalk.red(`Aucun nom de répertoire n'a été défini. Pour installer un CLI depuis GitHub, utiliser la commande comme ceci : `) + chalk.red.bold(`betterpip install --github CréateurDuRepo/${chalk.underline('NomDuRepo')}`))

	// Importer node-fetch
	var fetch = require('node-fetch')

	// Vérifier si le repo existe
	var checkIfRepoExist = await fetch(`https://api.github.com/repos/${owner}/${repo}`).then(res => res.json())

	// En cas d'erreur
	if(checkIfRepoExist.message || !checkIfRepoExist.full_name){
		console.log(`Erreur : ${(checkIfRepoExist?.message?.replace('Not Found','Repo introuvable')) || JSON.stringify(checkIfRepoExist) || checkIfRepoExist}`)
		return process.exit()
	}

	// Si le repo existe, modifier le spinner
	else console.log(`Répertoire ${chalk.green(checkIfRepoExist.full_name)} trouvé.${checkIfRepoExist.default_branch != 'main' ? ` Branche : ${checkIfRepoExist.default_branch}.` : ''}`)

	// Obtenir la liste des fichiers
	var fileList = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${checkIfRepoExist.default_branch}`).then(res => res.json())

	// Si le repo n'est pas tronqué, vérifier qu'il contient un fichier python-package.json
	if(!fileList.truncated && !fileList?.tree?.find(file => file.path == 'python-package.json')){
		console.log(chalk.red(`Aucun fichier python-package.json n'a été trouvé dans le répertoire ${chalk.green(checkIfRepoExist.full_name)}`))
		console.log(`👉 ${checkIfRepoExist.html_url}`)
		return process.exit()
	}

	// Télécharger tout les fichiers avec un "git clone"
	var clone;
	try {
		require('child_process').execFileSync('git', ['clone', checkIfRepoExist.clone_url], { stdio: 'inherit', cwd: path.resolve(process.cwd()) })
		clone = true
	} catch(err){ clone = false }

	// En cas d'erreur
	if(!clone) return process.exit();

	// Modifier le cwd pour aller dans le dossier
	process.chdir(path.join(process.cwd(), repo))

	// Si il y a un fichier python-package.json dans le dossier cloné
	if(fs.existsSync(path.join(process.cwd(), 'python-package.json'))){
		// Obtenir le package
		var pythonPackage;
		try { pythonPackage = _require(path.join(process.cwd(), 'python-package.json')) } catch(err){ pythonPackage = {} }

		// Si il y a des modules à installer, les installer
		if(pythonPackage.dependencies) await installModuleFromPackage() & console.log('\n')

		// Si il a des commandes à installer, les installer
		if(pythonPackage.globalCommands) await linkGlobalCommand()
	}
}

// Fonction pour installer un module
async function installModule(moduleName){
	// Obtenir le nom du/des module
	if(!moduleName) var moduleNames = process.argv.slice(3)
	else var moduleNames = [moduleName]

	// Si on a qu'un "module", et que c'est un fichier
	if(moduleNames.length == 1 && fs.existsSync(moduleNames[0])){
		// Demander si on est sûr de l'installation
		if(!process.env.BETTERPIP_SILENT_OUTPUT) var askConfirm = await inquirer.prompt([{
			type: 'confirm',
			name: 'askConfirm',
			message: `Voulez-vous installer le fichier ?`,
			default: false
		}])
		if(!askConfirm?.askConfirm && !process.env.BETTERPIP_SILENT_OUTPUT) return process.exit()

		// Utiliser Pip pour installer le fichier
		var install;
		try {
			install = require('child_process').execFileSync(pipCommand, ['install', '-r', moduleNames[0]], { stdio: 'inherit', cwd: path.resolve(process.cwd()) })
		} catch(e){
			install = 'failed'
		}

		// Afficher le résultat
		if(install == 'failed' || install?.toString()?.includes('ERROR')) return console.log(chalk.bold(`Le fichier n'a pas pu être installé !`))
		else console.log(chalk.bold(`Le fichier a été installé avec succès !`))

		// Sortir de la fonction
		return
	}

	// Si aucun modules, installer à partir du package
	if(!moduleNames.length) return installModuleFromPackage()

	// Pour chaque module dans l'array
	for(var moduleName of moduleNames){
		// Utiliser Pip pour installer le module
		var install;
		try {
			install = require('child_process').execFileSync(pipCommand, ['install', moduleName], { stdio: 'inherit', cwd: path.resolve(process.cwd()) })
		} catch(e){
			install = 'failed'
		}

		// Afficher le résultat
		if(install == 'failed' || install?.toString()?.includes('ERROR')) return console.log(chalk.bold(`Le module ${moduleName} n'a pas pu être installé !`))
		else console.log(chalk.bold(`Le module ${moduleName} a été installé avec succès !`))

		// Ajouter dans le python-package.json si il n'y est pas
		var pythonPackage;
		try { pythonPackage = _require(path.join(process.cwd(), 'python-package.json')) } catch(err){ pythonPackage = {} }
		pythonPackage.dependencies = pythonPackage.dependencies || {}
		if(!moduleName.split('==')[1]) pythonPackage.dependencies[moduleName] = '*'
		if(moduleName.split('==')[1]) pythonPackage.dependencies[moduleName.split('==')[0]] = moduleName.split('==')[1]
		fs.writeFileSync(path.join(process.cwd(), 'python-package.json'), JSON.stringify(pythonPackage, null, 2))
	}
}

// Fonction pour désinstaller un module
async function uninstallModule(moduleName){
	// Obtenir le nom du/des module
	if(!moduleName) var moduleNames = process.argv.slice(3)
	else var moduleNames = [moduleName]

	// Si on a qu'un "module", et que c'est un fichier
	if(moduleNames.length == 1 && fs.existsSync(moduleNames[0])){
		// Demander si on est sûr de l'installation
		if(!process.env.BETTERPIP_SILENT_OUTPUT) var askConfirm = await inquirer.prompt([{
			type: 'confirm',
			name: 'askConfirm',
			message: `Voulez-vous désinstaller à partir du fichier ?`,
			default: false
		}])
		if(!askConfirm?.askConfirm && !process.env.BETTERPIP_SILENT_OUTPUT) return process.exit()

		// Utiliser Pip pour désinstaller
		var install;
		try {
			install = require('child_process').execFileSync(pipCommand, ['uninstall', '-r', moduleNames[0], '-y'], { stdio: 'inherit', cwd: path.resolve(process.cwd()) })
		} catch(e){
			install = 'failed'
		}

		// Afficher le résultat
		if(install == 'failed' || install?.toString()?.includes('ERROR')) return console.log(chalk.bold(`Le fichier n'a pas pu être installé !`))
		else console.log(chalk.bold(`Le fichier a été installé avec succès !`))

		// Sortir de la fonction
		return
	}

	// Si auucn modules, afficher une erreur
	if(!moduleNames.length) return console.log(chalk.red('Veuillez entrer un nom de module, exemple : ') + chalk.red.bold('betterpip uninstall NomDuModule'))

	// Pour chaque module dans l'array
	for(var moduleName of moduleNames){
		// Ne garder que ce qui est présent avec le "=="
		if(moduleName.split('==')[1]) var moduleName = moduleName.split('==')[0]

		// Utiliser Pip pour désinstaller le module
		var uninstall;
		try {
			uninstall = require('child_process').execFileSync(pipCommand, ['uninstall', moduleName, '-y'], { stdio: 'inherit', cwd: path.resolve(process.cwd()) })
		} catch(e){
			uninstall = 'failed'
		}

		// Afficher le résultat
		if(uninstall == 'failed' || uninstall?.toString()?.includes('ERROR')) return console.log(chalk.bold(`Le module ${moduleName} n'a pas pu être désinstallé !`))
		else console.log(chalk.bold(`Le module ${moduleName} a été désinstallé avec succès !`))

		// Supprimer du python-package.json
		var pythonPackage;
		try { pythonPackage = _require(path.join(process.cwd(), 'python-package.json')) } catch(err){ pythonPackage = {} }
		if(pythonPackage.dependencies) delete pythonPackage.dependencies[moduleName]
		fs.writeFileSync(path.join(process.cwd(), 'python-package.json'), JSON.stringify(pythonPackage, null, 2))
	}
}

// Fonction pour ajouter les commandes du python-package.json dans l'OS
async function linkGlobalCommand(){
	// Obtenir le package
	var pythonPackage;
	try { pythonPackage = _require(path.join(process.cwd(), 'python-package.json')) } catch(err){ pythonPackage = {} }

	// Si aucun élément dans le package
	if(!Object.keys(pythonPackage).length) return console.log(chalk.red('Impossible de trouver un fichier python-package.json lisible dans le dossier actuelle.'))

	// Si aucune commande globale dans le package
	if(!pythonPackage?.globalCommands?.length) return console.log(chalk.red('Aucune commande globale n\'a été définie dans le fichier python-package.json.'))

	// Si les commandes globales n'est pas un array
	if(!Array.isArray(pythonPackage.globalCommands)) return console.log(chalk.red('Les commandes globales ne sont pas valide dans le python-package.json.'))

	// Si il manque le chemin du fichier principale
	if(!pythonPackage.mainFile) return console.log(chalk.red('Le fichier principal n\'a pas été défini dans le python-package.json.'))

	// Si le fichier principale n'existe pas
	if(!fs.existsSync(path.join(process.cwd(), pythonPackage.mainFile))) return console.log(chalk.red('Le fichier principal n\'existe pas.'))

	// Vérifier chaque commande
	for(var command of pythonPackage.globalCommands){
		// Si la commande contient des caractère non alphanumérique (les tirets restent autorisés)
		if(!command.match(/^[a-zA-Z0-9-]+$/)) return console.log(chalk.red(`La commande ${command} contient des caractères non alphanumériques.`))

		// Si la commande fait parti d'une liste de commande déjà utilisé par la plupart des systèmes
		if(isCommonCommand(command)) return console.log(chalk.red(`La commande ${command} est déjà utilisée par la plupart des systèmes.`))

		// Si la commande existe déjà sur le système
		if(await isCommandExist(command)){
			// Dire que la commande existe déjà
			console.log(chalk.red(`La commande ${chalk.bold(command)} existe déjà sur le système.`))

			// Demander si on veut la remplacer
			if(!process.env.BETTERPIP_SILENT_OUTPUT) var replace = await inquirer.prompt([{
				type: 'confirm',
				name: 'replace',
				message: `Voulez-vous la remplacer ?`,
				default: false
			}])

			// Si on ne veut pas la remplacer, l'enlever de l'array
			if(!replace?.replace && !process.env.BETTERPIP_SILENT_OUTPUT) pythonPackage.globalCommands = pythonPackage.globalCommands.filter(c => c != command)
		}
	}

	// Si il n'y a plus de commande dans le package
	if(!pythonPackage.globalCommands.length) return console.log(chalk.red(`Vous avez refusé l'installation ${pythonPackage?.globalCommands?.length > 1 ? 'des commandes' : 'de la commande'}.`))

	// Demander confirmation avant d'installer toute les commandes
	if(!process.env.BETTERPIP_SILENT_OUTPUT){
		console.log(`${pythonPackage?.globalCommands?.length > 1 ? 'Les commandes suivantes seront' : 'La commande suivante sera'} installé sur votre appareil: ${chalk.bold(pythonPackage.globalCommands.join(', '))}`)
		var confirm = await inquirer.prompt([{
			type: 'confirm',
			name: 'confirm',
			message: 'Êtes-vous sûr ?',
			default: false
		}])

		// Si on refuse ou qu'il n'y a aucune commande à installer
		if(!confirm?.confirm || !pythonPackage.globalCommands.length) return console.log(chalk.red(`Vous avez refusé l'installation ${pythonPackage?.globalCommands?.length > 1 ? 'des commandes' : 'de la commande'}.`))
	}

	// Afficher un spinner
	spinner.text = "Début de l'installation"
	spinner.start()

	// Installer les commandes
	for(var command of pythonPackage.globalCommands){
		spinner.text = `Installation de ${chalk.blue(command)}`
		spinner.start()
		await installCommand(command, pythonPackage.mainFile)
		spinner.stop()
	}

	// Afficher le résultat
	console.log(`\n${pythonPackage?.globalCommands?.length > 1 ? 'Les commandes' : 'La commande'} ${chalk.bold(pythonPackage.globalCommands.join(', '))} ${pythonPackage?.globalCommands?.length > 1 ? 'ont été installées' : 'a été installé'} avec succès !`)
	console.log(chalk.dim(`Il se peut que votre appareil ait besoin d'être redémarré pour que ${pythonPackage?.globalCommands?.length > 1 ? 'les commandes soient utilisables' : 'la commande soit utilisable'}.`))
}

// Fonction pour supprimer une commande globale
async function unlinkGlobalCommand(){
	// Obtenir le nom de la commande à partir des arguments
	var commands;
	if(process.argv[3]) commands = [process.argv[3]]

	// Si c'est pas dans les arguments, obtenir à partir du package
	else {
		// Obtenir le package
		var pythonPackage;
		try { pythonPackage = _require(path.join(process.cwd(), 'python-package.json')) } catch(err){ pythonPackage = {} }

		// Si aucun élément dans le package
		if(!Object.keys(pythonPackage).length) return console.log(chalk.red('Impossible de trouver un fichier python-package.json lisible dans le dossier actuelle.'))

		// Si aucune commande globale dans le package
		if(!pythonPackage?.globalCommands?.length) return console.log(chalk.red('Aucune commande globale n\'a été définie dans le fichier python-package.json.'))

		// Si les commandes globales n'est pas un array
		if(!Array.isArray(pythonPackage.globalCommands)) return console.log(chalk.red('Les commandes globales ne sont pas valide dans le python-package.json.'))

		// Vérifier chaque commande pour voir si elle contient des caractère non valide
		for(var command of pythonPackage.globalCommands){
			if(!command.match(/^[a-zA-Z0-9-]+$/)) return console.log(chalk.red(`La commande ${command} contient des caractères non alphanumériques.`))
		}

		// Définir commands à partir du package
		commands = pythonPackage.globalCommands
	}

	// Demander confirmation avant de supprimer toute les commandes
	if(!process.env.BETTERPIP_SILENT_OUTPUT){
		console.log(`${commands?.length > 1 ? 'Les commandes suivantes seront supprimées' : 'La commande suivante sera supprimée'} de votre appareil: ${chalk.bold(commands.join(', '))}`)
		var confirm = await inquirer.prompt([{
			type: 'confirm',
			name: 'confirm',
			message: 'Êtes-vous sûr ?',
			default: false
		}])

		// Si on refuse ou qu'il n'y a aucune commande à supprimer
		if(!confirm?.confirm || !commands.length) return console.log(chalk.red(`Vous avez refusé la suppression ${commands?.length > 1 ? 'des commandes' : 'de la commande'}.`))
	}

	// Afficher un spinner
	spinner.text = "Début de la suppression"
	spinner.start()

	// Supprimer toute les commandes
	for(var command of commands){
		// Modifier le spinner
		spinner.text = `Suppression de ${chalk.blue(command)}`

		// Supprimer le commande
		var remove = await removeCommand(command)
		
		// Modifier le spinner
		if(remove == 'COMMAND_DELETED') spinner.succeed()
		else {
			spinner.text = remove.replace('COMMAND_NOT_FOUND','Commande introuvable').replace('INVALID_COMMAND','Commande non valide (non installé avec BetterPip)')
			spinner.fail()
		}
	}

	// Afficher le résultat
	console.log(chalk.dim(`Il se peut que votre appareil ait besoin d'être redémarré pour que l'action soit prise en compte.`))
}

// Fonction pour vérifier certains éléments
async function doCheck(){
	// Afficher le spinner
	spinner.text = 'Préparation...';
	spinner.start()

	// Importer quelques librairies
	var os = require('os')
	var child_process = require('child_process')

	// Liste des éléments vérifiés et leur résultat
	var elements = []
	var otherElements = []

	// Obtenir le nombre de vérifications à faire
	var verifMax = 3
	if(os.platform() == 'win32') verifMax++

	// Modifer le spinner
	spinner.text = `Vérification 1/${verifMax}...`;

	// Vérifier si Python est installé sur le système
	try {
		var check = child_process.execSync(`${await getPythonVersion()} -V`, { stdio: 'pipe' })
		elements.push({ name: 'Python', value: true, version: check.toString().split(' ')[1].replace(/[^\d.-]/g, '') || 'N/A' })
	} catch(err){ elements.push({ name: 'Python', value: false, version: 'N/A' }) }

	// Modifer le spinner
	spinner.text = `Vérification 2/${verifMax}...`;

	// Vérifier si pip est installé sur le système
	try {
		var check = child_process.execSync(`${pipCommand} --version`, { stdio: 'pipe' })
		elements.push({ name: 'Pip', value: true, version: check.toString().split(' ')[1] || 'N/A' })
	} catch(err){ elements.push({ name: 'Pip', value: false, version: 'N/A' }) }

	// Modifer le spinner
	spinner.text = `Vérification 3/${verifMax}...`;

	// Vérifier si git est installé sur le système
	try {
		var check = child_process.execSync('git --version', { stdio: 'pipe' })
		elements.push({ name: 'Git', value: true, version: check?.toString()?.split(' ')[2]?.trim() || 'N/A' })
	} catch(err){ elements.push({ name: 'git', value: false, version: 'N/A' }) }

	// Si on est sous Windows, vérifier si un dossier est ajouté dans path
	if(os.platform() == 'win32'){
		// Modifer le spinner
		spinner.text = `Vérification 4/${verifMax}...`;

		// Vérifier si le dossier BetterPip existe (si non, le créer)
		if(!fs.existsSync(path.join(os.homedir(), 'AppData', 'Roaming', 'BetterPip'))) fs.mkdirSync(path.join(os.homedir(), 'AppData', 'Roaming', 'BetterPip'))

		// Vérifier si le dossier est dans Path
		var pathEnv = process.env.Path.split(';')
		var pathBetterPip = path.join(os.homedir(), 'AppData', 'Roaming', 'BetterPip')

		// Si c'est pe le cas, modifier Path pour l'inclure
		if(!pathEnv.includes(pathBetterPip)){
			var editPathEnv;
			try {
				// Importer regedit
				var register = require('regedit')

				// Obtenir l'ancien path utilisateur/local (pas système/global)
				var oldPath = (await register?.promisified?.list('HKCU\\Environment'))['HKCU\\Environment']?.values['Path']?.value
				if(!oldPath) otherElements.push(chalk.red('FATAL: ') + "Path est introuvable dans HKCU\\Environment")

				// Modifier le path si BetterPip n'est pas déjà là
				if(oldPath && !oldPath?.split(';').includes(pathBetterPip)) await register.promisified.putValue({
					'HKCU\\Environment': {
						'Path': {
							value: `${pathBetterPip};${oldPath}`,
							type: 'REG_EXPAND_SZ'
						}
					}
				})
				if(oldPath && !oldPath?.split(';').includes(pathBetterPip)) editPathEnv = 'success'
			} catch(e){
				editPathEnv = 'failed_' + e
			}

			// En cas d'erreur
			if(editPathEnv && typeof editPathEnv == 'string' && editPathEnv?.startsWith('failed_')) console.log(chalk.red(`Impossible d'ajouter le dossier BetterPip dans le registre !`)) & console.log(editPathEnv.replace('failed_', ''))

			// Sinon dire que c'est niquel
			else if(editPathEnv) otherElements.push("Une valeur a été ajouté à Path pour qu'il soit possible d'installer des CLI avec BetterPip.")
		}
	}

	// Modifer le spinner
	spinner.text = 'Finalisation...';

	// Trier pour afficher les élements qui n'ont pas raté en haut
	elements.sort((a, b) => {
		if(a.value == true && b.value == false) return -1
		if(a.value == false && b.value == true) return 1
		return 0
	})

	// Afficher la liste des résultats
	spinner.stop()
	console.log(chalk.bold(`Résultats des analyses :\n`) + elements.map(element => {
		return `${element.value == true ? chalk.green('[√]') : chalk.red('[X]')} ${element.name}${element.value == true ? ` (${element.version})` : ''}`
	}).join('\n'))

	// Si il y a des note additionnelles, les afficher
	if(otherElements.length > 0) console.log(chalk.bold(`\nNotes additionnelles :\n`) + otherElements.join('\n'))
}

// Fonction pour lancer le fichier principale
async function startMainFile(){
	// Obtenir le package
	var pythonPackage;
	try { pythonPackage = _require(path.join(process.cwd(), 'python-package.json')) } catch(err){ pythonPackage = {} }

	// Si aucun élément dans le package
	if(!Object.keys(pythonPackage).length) return console.log(chalk.red('Impossible de trouver un fichier python-package.json lisible dans le dossier actuelle.'))

	// Si il manque le chemin du fichier principale
	if(!pythonPackage.mainFile) return console.log(chalk.red('Le fichier principal n\'a pas été défini dans le python-package.json.'))

	// Si le fichier principale n'existe pas
	if(!fs.existsSync(path.join(process.cwd(), pythonPackage.mainFile))) return console.log(chalk.red('Le fichier principal n\'existe pas.'))

	// Lancer le fichier principal
	try { require('child_process').execFileSync(await getPythonVersion(), [pythonPackage.mainFile], { stdio: 'inherit', cwd: path.resolve(process.cwd()) }) } catch(err){}
}

// Fonction pour crée un script d'installation
async function buildInstallationScript(){
	// Obtenir le fichier python-package.json
	var pythonPackage;
	try { pythonPackage = _require(path.join(process.cwd(), 'python-package.json')) } catch(err){ pythonPackage = {} }
	if(!Object.keys(pythonPackage).length) return console.log(chalk.red('Impossible de trouver un fichier python-package.json lisible dans le dossier actuelle.'))

	// Si aucun nom dans le python-package.json
	if(!pythonPackage.name) return console.log(chalk.red('Le nom du package n\'a pas été défini dans le python-package.json.'))

	// Afficher une aide
	console.log(`Cet assistant vous permet de générer un script d'installation pour Windows (.cmd) et Linux (.sh).\nLe lien du repo GitHub permet de télécharger des fichiers lors de l'exécution du script\n`)

	// Obtenir le lien du repo GitHub
	var owner;
	var repo;
	await inquirer.prompt([
		{
			type: 'input',
			name: 'githubRepoName',
			message: 'Lien du repo GitHub',
			validate: function(value){
				// Obtenir le nom du repo et du créateur
				[owner, repo] = value?.replace('https://github.com/','')?.replace('http://github.com/','')?.split('/')

				// Si aucun nom de créateur/nom de répertoire
				if(!owner) return chalk.red(`Aucun nom de créateur n'a été défini.`)
				if(!repo) return chalk.red(`Aucun nom de répertoire n'a été défini.`)

				// Sinon niquel
				return true
			}
		}
	])

	// Importer node-fetch
	var fetch = require('node-fetch')

	// Vérifier si le repo existe
	var checkIfRepoExist = await fetch(`https://api.github.com/repos/${owner}/${repo}`).then(res => res.json())

	// En cas d'erreur
	if(checkIfRepoExist.message || !checkIfRepoExist.full_name){
		console.log(`Erreur : ${(checkIfRepoExist?.message?.replace('Not Found','Repo introuvable')) || JSON.stringify(checkIfRepoExist) || checkIfRepoExist}`)
		return process.exit()
	}

	// Obtenir la liste des fichiers dans le repo
	var fileList = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${checkIfRepoExist.default_branch}`).then(res => res.json())

	// Si le repo n'est pas tronqué, vérifier qu'il contient un fichier python-package.json
	if(!fileList.truncated && !fileList?.tree?.find(file => file.path == 'python-package.json')){
		console.log(chalk.red(`Aucun fichier python-package.json n'a été trouvé dans le répertoire ${chalk.green(checkIfRepoExist.full_name)}`))
		console.log(`👉 ${checkIfRepoExist.html_url}`)
		return process.exit()
	}

	// Si un dossier "build" existe déjà, supprimer "windows_install.cmd" et "unix_install.sh"
	if(fs.existsSync(path.join(process.cwd(), 'build'))){
		try { fs.unlinkSync(path.join(process.cwd(), 'build', 'windows_install.cmd')) } catch(err){}
		try { fs.unlinkSync(path.join(process.cwd(), 'build', 'unix_install.sh')) } catch(err){}
	} else {
		// Si il n'existe pas, le crée
		if(!fs.existsSync(path.join(process.cwd(), 'build'))) fs.mkdirSync(path.join(process.cwd(), 'build'))
	}

	// Script pour Windows
	function build_windows(){
		fs.writeFileSync(path.join(process.cwd(), 'build', 'windows_install.cmd'), `@echo off\nbetterpip -v >nul 2>&1 && (\n	betterpip install -g ${owner}/${repo}\n) || (\n	git clone ${checkIfRepoExist.clone_url}\n	cd ${repo}\n	${pythonPackage.dependencies && Object.keys(pythonPackage.dependencies)?.length > 0 ? `pip install ${Object.keys(pythonPackage.dependencies).map(dependency => `${dependency}${pythonPackage.dependencies[dependency] == '*' ? '' : `==${pythonPackage.dependencies[dependency]}`}`).join(' ')}` : ''}\n	echo.\n	echo # Installateur généré avec BetterPip\n	echo # Pour une meilleur installation: github.com/johan-perso/betterpip\n)`.replace(/\n/g, '\r\n'))
	}

	// Script pour Linux
	function build_linux(){
		fs.writeFileSync(path.join(process.cwd(), 'build', 'unix_install.sh'), `#!/usr/bin/env bash\n##########################################\n### Généré par BetterPip               ###\n### github.com/johan-perso/betterpip   ###\n### johanstickman.com                  ###\n##########################################\n\n# Si la commande betterpip est installé sur le système, l'utiliser pour installer le script\nif hash betterpip 2>/dev/null; then\n	betterpip install -g ${owner}/${repo}\n# Sinon, installer avec pip et git (installation manuelle)\nelse\n	git clone ${checkIfRepoExist.clone_url}\n	cd ${repo}\n	${pythonPackage.dependencies && Object.keys(pythonPackage.dependencies)?.length > 0 ? `pip install ${Object.keys(pythonPackage.dependencies).map(dependency => `${dependency}${pythonPackage.dependencies[dependency] == '*' ? '' : `==${pythonPackage.dependencies[dependency]}`}`).join(' ')}` : ''}\n	echo -e "\\nInstallateur généré avec BetterPip.\\nPour une meilleur installation: github.com/johan-perso/betterpip"\nfi`)
	}

	// Générer tout les scripts
	build_windows()
	build_linux()

	// Dire que c'est bon
	console.log(chalk.green(`Les scripts devraient se trouver dans le dossier ${chalk.yellow('build')}.`))
}

// Fonction pour afficher les informations sur un module
async function showModuleInfo(moduleName){
	// Obtenir le nom du module
	if(!moduleName) moduleName = process.argv[3]

	// Si il n'y a toujours pas de module
	if(!moduleName) return console.log(chalk.red('Veuillez entrer un nom de module, exemple : ') + chalk.red.bold('betterpip info NomDuModule'))

	// Afficher les informations
	try { require('child_process').execFileSync(pipCommand, ['show', moduleName], { stdio: 'inherit', cwd: path.resolve(process.cwd()) }) } catch(err){}
}

// Fonction pour afficher la liste des modules installé
async function listModules(){
	try { require('child_process').execFileSync(pipCommand, ['list'], { stdio: 'inherit', cwd: path.resolve(process.cwd()) }) } catch(err){}
}

// Fonction pour afficher la page d'aide
function showHelp(){
	console.log(`
 Utilisation
   $ ${chalk.bold('betterpip')} <sous commande>
   ${chalk.dim('(ou alors "bpip")')}

 Sous commandes :
   init             createPackage        Assistant pour générer un fichier python-package.json
   install          add                  Permet d'installer un module
   uninstall        remove               Désinstalle un module
   check            doctor               Vérifie certains éléments de BetterPip
   info             show                 Affiche des information sur un module
   list             tree                 Affiche la liste des modules installés
   build                                 Permet de générer un script d'installation pour votre module
   link                                  Permet d'associer les commandes globales du python-package.json au système
   unlink                                Supprime une/les commandes globales du système
   start            run                  Lance le fichier principale à partir du python-package.json
   help                                  Affiche cette page d'aide
   version          v                    Affiche la version de BetterPip

 Créateur :
   🌐 ${chalk.cyan(`https://${chalk.bold('johanstickman.com')}`)}
   🐦 ${chalk.cyan(`https://${chalk.bold('twitter.com/Johan_Stickman')}`)}
   ❔ ${chalk.cyan(`https://${chalk.bold('contact.johanstickman.com')}`)}

 À propos :
   ${chalk.cyan(`https://github.com/${chalk.bold('johan-perso/betterpip')}`)}
   Version ${chalk.bold.cyan(require('./package.json').version)}
`)
}

// Gérer les arguments
	// Install
	if(process.argv[2] == 'install' || process.argv[2] == 'i'|| process.argv[2] == 'add'){
		// Si les arguments contiennent "-g", "--global" ou "--github"
		if(process.argv.includes('-g') || process.argv.includes('--global') || process.argv.includes('--github')) installCliFromGithub()

		// Sinon
		else installModule()
	}
	// Uninstall
	else if(process.argv[2] == 'uninstall' || process.argv[2] == 'remove') uninstallModule()
	// Init
	else if(process.argv[2] == 'init' || process.argv[2] == 'createPackage') createPackage()
	// Doctor
	else if(process.argv[2] == 'doctor' || process.argv[2] == 'check') doCheck()
	// Info
	else if(process.argv[2] == 'info' || process.argv[2] == 'show') showModuleInfo()
	// List
	else if(process.argv[2] == 'list' || process.argv[2] == 'tree') listModules()
	// Link
	else if(process.argv[2] == 'link') linkGlobalCommand()
	// Unlink
	else if(process.argv[2] == 'unlink') unlinkGlobalCommand()
	// Build
	else if(process.argv[2] == 'build') buildInstallationScript()
	// Start
	else if(process.argv[2] == 'start' || process.argv[2] == 'run') startMainFile()
	// Version
	else if(process.argv[2] == 'version' || process.argv[2] == '-v') console.log(require('./package.json').version)
	// Help
	else if(process.argv[2] == 'help' || process.argv[2] == 'h') showHelp()
	else showHelp()
