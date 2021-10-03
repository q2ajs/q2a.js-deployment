import fs from 'fs';
import replaceOnce from 'replace-once';
import {
  promptWithSample,
  prompt,
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
} from './utility.js';

const readSampleEnvAndCreateEnv = async (sampleEnvPath, outputEnvPath, outputEnvPath2, extraEnv = null) => {
  const envContent = readEnvFile(sampleEnvPath);
  const newContent = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const [key, value] of Object.entries(envContent)) {
    // eslint-disable-next-line no-await-in-loop
    const item = trim(await promptWithSample(key, value));
    const result = {};
    if (item.length === 0) {
      result[key] = value;
    } else {
      result[key] = item;
    }
    newContent.push(result);
  }
  if (extraEnv != null) newContent.push(extraEnv);
  writeEnvFile(outputEnvPath, newContent);
  writeEnvFile(outputEnvPath2, newContent);
};

const readEnvFiles = async (siteName, useSavedSample) => {
  console.log('Please enter requested info for api >>>');
  await readSampleEnvAndCreateEnv(
    useSavedSample ? `${outputDirectory}/${siteName}.api.env` : `${outputDirectory}/api/.sample.env`,
    `${configsDirectory}/${siteName}.api.env`,
    `${outputDirectory}/api/.env`
  );
  console.log('Please enter requested info for frontend >>>');
  await readSampleEnvAndCreateEnv(
    useSavedSample
      ? `${outputDirectory}/${siteName}.frontend.env`
      : `${outputDirectory}/frontend/.sample.env`,
    `${configsDirectory}/${siteName}.frontend.env`,
    `${outputDirectory}/frontend/.env`
  );
  await readSampleEnvAndCreateEnv(
    useSavedSample ? `${configsDirectory}/${siteName}.DOCKER.env` : `${outputDirectory}/../.sample.env`,
    `${configsDirectory}/${siteName}.DOCKER.env`,
    `${outputDirectory}/DOCKER.env`,
    { SITE_NAME: siteName }
  );
};

const getNginxEndConfig = (sampleConfig) => {
  return sampleConfig.substring(sampleConfig.lastIndexOf('%end%') + '%end%'.length, sampleConfig.length);
};

const getNginxDomainConfig = (sampleConfig, SITE_NAME, FRONT_END_PORT, API_PORT, DOMAIN) => {
  const configToRepeat = sampleConfig.substring(
    sampleConfig.indexOf('%begin%') + '%begin%'.length,
    sampleConfig.lastIndexOf('%end%')
  );
  const find = ['%frontend%', '%frontend_port%', '%api%', '%api_port%', '%sitename%', '%domain%'];
  const replace = [
    `${SITE_NAME}_frontend`,
    `${FRONT_END_PORT}`,
    `${SITE_NAME}_api`,
    `${API_PORT}`,
    `${SITE_NAME}`,
    `${DOMAIN}`,
  ];
  const result = replaceOnce(configToRepeat, find, replace, 'gi');
  return result;
};

(async () => {
  createFolderIfNotExist(outputDirectory);
  createFolderIfNotExist(configsDirectory);

  // nginx folder
  createFolderIfNotExist(nginxDirectory);
  await copyFile(`${outputDirectory}/../nginx/default.conf`, `${nginxDirectory}/default.conf`);
  await copyFile(`${outputDirectory}/../nginx/Dockerfile`, `${nginxDirectory}/Dockerfile`);
  await copyFile(`${outputDirectory}/../docker-compose.yaml`, `${outputDirectory}/docker-compose.yaml`);

  console.log('Please wait for downloading q2a projects...');
  await cloneProject('q2a.js-frontend', 'frontend');
  await cloneProject('q2a.js-api', 'api');

  console.log('Download succeeded');
  const siteName = await prompt('Enter site name (dev for development )/siteName:');
  console.log('outputDirectory', outputDirectory);
  if (!fs.existsSync(`${configsDirectory}/${siteName}.env/`)) {
    await readEnvFiles(siteName, false);
  } else {
    const edit = await prompt('Do you want edit information?(Y/N)');
    if (isAnswerYes(edit)) {
      await readEnvFiles(siteName, true);
    } else {
      await copyFile(`${configsDirectory}/${siteName}.frontend.env`, `${outputDirectory}/frontend/.env`);
      await copyFile(`${configsDirectory}/${siteName}.api.env`, `${outputDirectory}/api/.env`);
    }
  }
  let nginxConfig = ``;
  const nginxSampleConfig = await fs
    .readFileSync(`${outputDirectory}/../nginx/default.conf`)
    .toString('utf8');

  const dockerFileEnvArray = await getFileNamesInDirectory(`${configsDirectory}`, '.DOCKER.env');

  for (let i = 0; i < dockerFileEnvArray.length; i += 1) {
    const dockerFile = await readEnvFile(dockerFileEnvArray[i]);
    nginxConfig += getNginxDomainConfig(
      nginxSampleConfig,
      dockerFile.SITE_NAME,
      dockerFile.FRONT_END_PORT,
      dockerFile.API_PORT,
      dockerFile.DOMAIN
    );
  }
  nginxConfig += getNginxEndConfig(nginxSampleConfig);
  fs.writeFileSync(`${nginxDirectory}/default.conf`, nginxConfig);

  process.exit(0);
})();
