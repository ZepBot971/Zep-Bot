const axios = require('axios');
const fs = require('fs-extra');
const _ = require('lodash');
const log = require('./logger/log.js');
const chalk = require('chalk');
const langCode = require('./config.json').language;

let pathLanguageFile = `${process.cwd()}/languages/${langCode}.lang`;
if (!fs.existsSync(pathLanguageFile)) {
	log.warn("LANGUAGE", `Can't find language file ${langCode}.lang, using default language file "${process.cwd()}/languages/en.lang"`);
	pathLanguageFile = `${process.cwd()}/languages/en.lang`;
}
const readLanguage = fs.readFileSync(pathLanguageFile, "utf-8");
const languageData = readLanguage
	.split(/\r?\n|\r/)
	.filter(line => line && !line.trim().startsWith("#") && !line.trim().startsWith("//") && line != "");

global.language = {};
for (const sentence of languageData) {
	const getSeparator = sentence.indexOf('=');
	const itemKey = sentence.slice(0, getSeparator).trim();
	const itemValue = sentence.slice(getSeparator + 1, sentence.length).trim();
	const head = itemKey.slice(0, itemKey.indexOf('.'));
	const key = itemKey.replace(head + '.', '');
	const value = itemValue.replace(/\\n/gi, '\n');
	if (!global.language[head])
		global.language[head] = {};
	global.language[head][key] = value;
}

function getText(head, key, ...args) {
	if (!global.language[head]?.[key])
		return `Can't find text: "${head}.${key}"`;
	let text = global.language[head][key];
	for (let i = args.length - 1; i >= 0; i--)
		text = text.replace(new RegExp(`%${i + 1}`, 'g'), args[i]);
	return text;
}

(async () => {
	const { data: versions } = await axios.get('https://raw.githubusercontent.com/ntkhang03/Goat-Bot-V2/main/versions.json');
	const currentVersion = require('./package.json').version;
	const versionsNeedToUpdate = versions.slice(versions.findIndex(v => v.version === currentVersion) + 1);
	if (versionsNeedToUpdate.length === 0)
		return log.info("SUCCESS", getText("updater", "latestVersion"));

	fs.writeFileSync(`${process.cwd()}/versions.json`, JSON.stringify(versions, null, 2));
	log.info("UPDATE", getText("updater", "newVersions", chalk.yellow(versionsNeedToUpdate.length)));

	for (const version of versionsNeedToUpdate) {
		log.info("UPDATE", `Update version ${version.version}`);
		const { files, deleteFiles } = version;

		for (const filePath in files) {
			const description = files[filePath];
			const fullPath = `${process.cwd()}/${filePath}`;
			const { data: getFile } = await axios.get(`https://github.com/ntkhang03/Goat-Bot-V2/raw/main/${filePath}`, {
				responseType: 'arraybuffer'
			});

			if (filePath === "config.json") {
				const currentConfig = require('./config.json');
				for (const key in files[filePath])
					_.set(currentConfig, key, files[filePath][key]);

				if (fs.existsSync(`${process.cwd()}/config.backup.json`)) {
					let backupConfig = 1;
					while (fs.existsSync(`${fullPath.slice(0, -5)}_${backupConfig}.backup.json`))
						backupConfig++;
					fs.copyFileSync(fullPath, `${fullPath.slice(0, -5)}_${backupConfig}.backup.json`);
				}
				else {
					fs.copyFileSync(fullPath, `${process.cwd()}/config.backup.json`);
				}
				fs.writeFileSync(fullPath, JSON.stringify(currentConfig, null, 2));
				console.log(chalk.bold.blue('[↑]'), `${filePath}`);
			}
			else if (fs.existsSync(fullPath)) {
				fs.writeFileSync(fullPath, Buffer.from(getFile));
				console.log(chalk.bold.blue('[↑]'), `${filePath}:`, chalk.hex('#858585')(description));
			}
			else {
				const cutFullPath = filePath.split('/');
				cutFullPath.pop();
				for (let i = 0; i < cutFullPath.length; i++) {
					const path = `${process.cwd()}/${cutFullPath.slice(0, i + 1).join('/')}`;
					if (!fs.existsSync(path))
						fs.mkdirSync(path);
				}
				fs.writeFileSync(fullPath, Buffer.from(getFile));
				console.log(chalk.bold.green('[+]'), `${filePath}:`, chalk.hex('#858585')(description));
			}
		}

		for (const filePath in deleteFiles) {
			const description = deleteFiles[filePath];
			const fullPath = `${process.cwd()}/${filePath}`;
			if (fs.existsSync(fullPath)) {
				fs.unlinkSync(fullPath);
				console.log(chalk.bold.red('[-]'), `${filePath}:`, chalk.hex('#858585')(description));
			}
		}
	}

	const { data: packageJson } = await axios.get("https://github.com/ntkhang03/Goat-Bot-V2/raw/main/package.json");
	fs.writeFileSync(`${process.cwd()}/package.json`, JSON.stringify(packageJson, null, 2));
	log.info("UPDATE", getText("updater", "updateSuccess"));
})();
