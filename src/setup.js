import fs from 'fs';
import replaceOnce from 'replace-once';
import {
  promptWithSample,
  prompt,
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
} from './utility.js';

// eslint-disable-next-line complexity
const readDeploySettingsAndCreateEnvironment = async (
  deploySettingsPath,
  outputSettingPath,
  outputEnvPath,
  extraEnv = null
) => {
  const envContent = readDeploySettingFile(deploySettingsPath);
  const newContent = [];
  console.log(envContent);
  const settings = JSON.parse(envContent);
  // eslint-disable-next-line no-restricted-syntax
  for (const [key, value] of Object.entries(settings)) {
    // eslint-disable-next-line no-await-in-loop
    const validationRegex = new RegExp(value.validationRegex);
    let userInput = '';
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      userInput = trim(await promptWithSample(value.question, value.defaultValue));
      if (validationRegex.test(userInput)) break;
      console.warn(`Wrong input for ${value.type} type`);
    }
    const result = {};
    if (userInput.length === 0) {
      result[key] = value.defaultValue;
    } else {
      result[key] = userInput;
    }
    newContent.push(result);
  }
  if (extraEnv != null) newContent.push(extraEnv);
  writeEnvFile(outputSettingPath, envContent);
  writeEnvFile(outputEnvPath, newContent);
};

const createEnvFiles = async (siteName, useSavedSample) => {
  console.log('Please enter requested info for api >>>');
  await readDeploySettingsAndCreateEnvironment(
    useSavedSample
      ? `${outputDirectory}/${siteName}.api.deploy_settings.json`
      : `${outputDirectory}/api/deploy_settings.json`,
    `${configsDirectory}/${siteName}.api.deploy_settings.json`,
    `${outputDirectory}/api/.env`
  );
  console.log('Please enter requested info for frontend >>>');
  await readDeploySettingsAndCreateEnvironment(
    useSavedSample
      ? `${outputDirectory}/${siteName}.frontend.deploy_settings.json`
      : `${outputDirectory}/frontend/deploy_settings.json`,
    `${configsDirectory}/${siteName}.frontend.deploy_settings.json`,
    `${outputDirectory}/frontend/.env`
  );
  await readDeploySettingsAndCreateEnvironment(
    useSavedSample
      ? `${configsDirectory}/${siteName}.docker.deploy_settings.json`
      : `${outputDirectory}/../deploy_settings.json`,
    `${configsDirectory}/${siteName}.docker.deploy_settings.json`,
    `${outputDirectory}/docker.env`,
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
  // await cloneProject('q2a.js-frontend', 'frontend');
  await cloneProject('q2a.js-api', 'api');

  console.log('Download succeeded');
  const siteName = await prompt('Enter site name (dev for development )/siteName:');
  console.log('outputDirectory', outputDirectory);
  if (!fs.existsSync(`${configsDirectory}/${siteName}.env/`)) {
    await createEnvFiles(siteName, false);
  } else {
    const edit = await prompt('Do you want edit information?(Y/N)');
    if (isAnswerYes(edit)) {
      await createEnvFiles(siteName, true);
    } else {
      await copyFile(`${configsDirectory}/${siteName}.frontend.env`, `${outputDirectory}/frontend/.env`);
      await copyFile(`${configsDirectory}/${siteName}.api.env`, `${outputDirectory}/api/.env`);
    }
  }
  let nginxConfig = ``;
  const nginxSampleConfig = await fs
    .readFileSync(`${outputDirectory}/../nginx/default.conf`)
    .toString('utf8');

  const dockerFileEnvArray = await getFileNamesInDirectory(`${configsDirectory}`, '.docker.env');
  console.log('?????????????', dockerFileEnvArray.length);
  let FRONT_END_PORT = 3000;
  let API_PORT = 4000;
  for (let i = 0; i < dockerFileEnvArray.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const dockerFile = await readDeploySettingFile(dockerFileEnvArray[i]);
    console.log('dockerFile::::', dockerFile);
    nginxConfig += getNginxDomainConfig(
      nginxSampleConfig,
      dockerFile.SITE_NAME,
      (FRONT_END_PORT += i),
      (API_PORT += i),
      dockerFile.DOMAIN
    );
  }
  nginxConfig += getNginxEndConfig(nginxSampleConfig);
  fs.writeFileSync(`${nginxDirectory}/default.conf`, nginxConfig);

  process.exit(0);
})();
