import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const outputDirectory = `${path.resolve()}/cloned_projects`;
const configsDirectory = `${outputDirectory}/config`;
const nginxDirectory = `${outputDirectory}/nginx`;

const trim = (string) => {
  return string.replace(/^\s+|\s+$/g, '');
};

const prompt = async (query, defaultValue = '', regex = null) => {
  while (true) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    // eslint-disable-next-line no-await-in-loop
    const response = await new Promise((resolve) => {
      let queryAndDefault = query;
      if (defaultValue) queryAndDefault += ` ( default :  ${defaultValue} ) : `;
      else queryAndDefault += ' : ';
      rl.question(queryAndDefault, (data) => {
        resolve(data === null || data.length === 0 ? defaultValue : data);
        rl.close();
      });
    });

    if (regex === null || regex.test(response)) {
      return response;
    }
    console.warn(`Wrong input for ${regex}`);
  }
};

const execShellCommand = (cmd) => {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.warn(error);
      }
      resolve(stdout || stderr);
    });
  });
};

const writeJsonFile = (filePath, newContent) => {
  fs.writeFileSync(filePath, JSON.stringify(newContent));
};

const writeEnvFile = (filePath, newContent) => {
  let dataString = '';
  // eslint-disable-next-line no-restricted-syntax
  for (const content of newContent) {
    const keyValue = Object.entries(content)[0];
    dataString += `${keyValue[0]}=${keyValue[1]}`;
    dataString += '\n';
  }
  fs.writeFileSync(filePath, dataString);
};

const readDeploySettingFile = (filePath) => {
  return JSON.parse(fs.readFileSync(filePath).toString('utf8'));
};

const isAnswerYes = (input) => {
  const lowerCaseInput = input.toLowerCase();
  return lowerCaseInput === 'y' || lowerCaseInput === 'yes';
};

const cloneProject = async (projectName, outPutFolderName) => {
  const clonedProjectPath = `${outputDirectory}/${outPutFolderName}`;
  let gitCommand = '';
  let cdPath = '';
  if (fs.existsSync(clonedProjectPath)) {
    gitCommand = 'git pull';
    cdPath = `${clonedProjectPath}`;
  } else {
    gitCommand = `git clone https://github.com/q2ajs/${projectName}.git -b fix/deployment --single-branch ${outPutFolderName}`;
    //  gitCommand = `git clone https://github.com/q2ajs/${projectName}.git ${outPutFolderName}`;
    cdPath = `${outputDirectory}`;
  }
  await execShellCommand(`cd ${cdPath} && ${gitCommand}`);
  // await execShellCommand(`cd ${clonedProjectPath} && yarn install --production --frozen-lockfile`);
};

const createFolderIfNotExist = (directory) => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory);
  }
};

const copyFile = async (inputFile, outputFile) => {
  const fileContent = fs.readFileSync(inputFile).toString('utf8');
  fs.writeFileSync(outputFile, fileContent);
};

const getFileNamesInDirectory = async (startPath, filter) => {
  if (!fs.existsSync(startPath)) {
    console.warn('No dir ', startPath);
    return [];
  }

  const files = await fs.readdirSync(startPath);
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const filename = path.join(startPath, files[i]);
    const stat = await fs.lstatSync(filename);
    if (stat.isDirectory()) {
      const recursiveResults = getFileNamesInDirectory(filename, filter); // recurse
      for (const result of recursiveResults) results.push(result);
    } else if (filename.indexOf(filter) >= 0) {
      results.push(filename.substring(filename.lastIndexOf('\\') + 1, filename.length));
    }
  }
  return results;
};

// eslint-disable-next-line complexity
const createEnvAndSavedConfigsFromInputAndDeploySettings = async (
  deploySettingsPath,
  outputSettingPath,
  outputEnvPath,
  saveEnv = false,
  extraEnv = null
) => {
  const settings = readDeploySettingFile(deploySettingsPath);
  const outPutSettings = readDeploySettingFile(deploySettingsPath);
  const newContent = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const [key, value] of Object.entries(settings)) {
    // eslint-disable-next-line no-await-in-loop
    const validationRegex = value.validationRegex.length > 0 ? new RegExp(value.validationRegex) : null;
    if (value.getFromInput) {
      // eslint-disable-next-line no-await-in-loop
      const userInput = trim(await prompt(value.question, value.defaultValue, validationRegex));
      const result = {};
      if (userInput.length === 0) {
        result[key] = value.defaultValue;
      } else {
        result[key] = userInput;
      }
      outPutSettings[key].defaultValue = result[key];
      newContent.push(result);
    }
  }
  if (extraEnv != null) {
    for (let i = 0; i < extraEnv.length; i += 1) {
      newContent.push(extraEnv[i]);
    }
  }
  writeJsonFile(outputSettingPath, outPutSettings);
  if (saveEnv) writeEnvFile(outputEnvPath, newContent);
};

const createEnvFromSettingsJson = (deploySettingsPath, outputEnvPath, extraEnv) => {
  const settings = readDeploySettingFile(deploySettingsPath);
  const newContent = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const [key, value] of Object.entries(settings)) {
    // eslint-disable-next-line no-await-in-loop
    const result = {};
    result[key] = value.defaultValue;
    newContent.push(result);
  }
  if (extraEnv != null) {
    for (let i = 0; i < extraEnv.length; i += 1) {
      newContent.push(extraEnv[i]);
    }
  }
  writeEnvFile(outputEnvPath, newContent);
};

export {
  prompt,
  execShellCommand,
  trim,
  readDeploySettingFile,
  writeEnvFile,
  isAnswerYes,
  outputDirectory,
  configsDirectory,
  nginxDirectory,
  cloneProject,
  createFolderIfNotExist,
  copyFile,
  getFileNamesInDirectory,
  writeJsonFile,
  createEnvFromSettingsJson,
  createEnvAndSavedConfigsFromInputAndDeploySettings,
};
