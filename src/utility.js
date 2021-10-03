import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import replaceOnce from 'replace-once';

const outputDirectory = `${path.resolve()}/cloned_projects`;
const configsDirectory = `${outputDirectory}/config`;
const nginxDirectory = `${outputDirectory}/nginx`;

const promptWithSample = async (query, defaultValue = null) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    let queryAndDefault = query;
    if (defaultValue) queryAndDefault += ` ( e.g ${defaultValue} ) : `;
    else queryAndDefault += ' : ';
    rl.question(queryAndDefault, (data) => {
      resolve(data);
      rl.close();
    });
  });
};

const prompt = async (query) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(query, (data) => {
      resolve(data);
      rl.close();
    });
  });
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
const replaceAll = (string, search, replace) => {
  return string.split(search).join(replace);
};

const trim = (string) => {
  return string.replace(/^\s+|\s+$/g, '');
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

const readEnvFile = (filePath) => {
  const lines = trim(replaceAll(fs.readFileSync(filePath).toString('utf8'), '\r', '')).split('\n');
  const keyValues = {};
  lines.forEach((line) => {
    const parts = line.split('=');
    keyValues[parts[0]] = parts[1];
  });
  return keyValues;
};
const isAnswerYes = (word) => {
  const result = word.toLowerCase();
  return result === 'y' || result === 'yes';
};

const cloneProject = async (projectName, outPutFolderName) => {
  const clonedProjectPath = `${outputDirectory}/${outPutFolderName}`;
  let gitCommand = '';
  let cdPath = '';
  if (fs.existsSync(clonedProjectPath)) {
    gitCommand = 'git pull';
    cdPath = `${clonedProjectPath}`;
  } else {
    gitCommand = `git clone https://github.com/q2ajs/${projectName}.git ${outPutFolderName}`;
    cdPath = `${outputDirectory}`;
  }
  await execShellCommand(`cd ${cdPath} && ${gitCommand}`);
  await execShellCommand(`cd ${clonedProjectPath} && yarn`);
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
      results.push(filename);
    }
  }
  return results;
};

export {
  promptWithSample,
  prompt,
  execShellCommand,
  replaceAll,
  trim,
  readEnvFile,
  writeEnvFile,
  isAnswerYes,
  outputDirectory,
  configsDirectory,
  nginxDirectory,
  cloneProject,
  createFolderIfNotExist,
  copyFile,
  getFileNamesInDirectory,
};
