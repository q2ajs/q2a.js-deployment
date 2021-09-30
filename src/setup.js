import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const outputDirectory = `${path.resolve()}/cloned_projects`;
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const prompt = (query, defaultValue = null) =>
  new Promise((resolve) => {
    let queryAndDefault = query;
    if (defaultValue) queryAndDefault += ` ( e.g ${defaultValue} ) : `;
    else queryAndDefault += ' : ';
    return rl.question(queryAndDefault, resolve);
  });

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

const readEnvFile = (filePath) => {
  const lines = trim(replaceAll(fs.readFileSync(filePath).toString('utf8'), '\r', '')).split('\n');
  const keyValues = [];
  lines.forEach((line) => {
    const parts = line.split('=');
    const keyValue = {};
    keyValue[parts[0]] = parts[1];
    keyValues.push(keyValue);
  });
  return keyValues;
};

const writeEnvFile = (filePath, newContent) => {
  console.log(filePath);

  let dataString = '';
  // eslint-disable-next-line no-restricted-syntax
  for (const content of newContent) {
    const keyValue = Object.entries(content)[0];
    dataString += `${keyValue[0]}=${keyValue[1]}`;
    dataString += '\n';
  }
  fs.writeFileSync(filePath, dataString);
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

const readSampleEnvAndCreateEnv = async (sampleEnvPath, outputEnvPath) => {
  const envContent = readEnvFile(sampleEnvPath);
  const newContent = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const content of envContent) {
    const keyValue = Object.entries(content)[0];
    // eslint-disable-next-line no-await-in-loop
    const item = await prompt(keyValue[0], keyValue[1]);
    const result = {};
    result[keyValue[0]] = item;
    newContent.push(result);
  }
  console.log(newContent);

  writeEnvFile(outputEnvPath, newContent);
};

(async () => {
  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory);
  }
  console.log('Please wait for downloading q2a projects...');
  await cloneProject('q2a.js-frontend', 'frontend');
  await cloneProject('q2a.js-api', 'api');

  console.log('Download succeeded');
  console.log('Please enter requested info for api >>>');
  await readSampleEnvAndCreateEnv(`${outputDirectory}/api/.sample.env`, `${outputDirectory}/api/.env`);

  console.log('Please enter requested info for frontend >>>');
  await readSampleEnvAndCreateEnv(
    `${outputDirectory}/frontend/.sample.env`,
    `${outputDirectory}/frontend/.env`
  );
  process.exit(0);
})();
