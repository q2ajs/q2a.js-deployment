import fs from 'fs';
import replaceOnce from 'replace-once';
import {
  prompt,
  readDeploySettingFile,
  isAnswerYes,
  outputDirectory,
  configsDirectory,
  nginxDirectory,
  cloneProject,
  createFolderIfNotExist,
  copyFile,
  getFileNamesInDirectory,
  createEnvAndSavedConfigsFromInputAndDeploySettings,
  createEnvFromSettingsJson,
} from './utility.js';

const createEnvFilesFromInput = async (siteName, useSavedSample) => {
  console.info('Please enter requested info for api >>>');
  await createEnvAndSavedConfigsFromInputAndDeploySettings(
    useSavedSample
      ? `${outputDirectory}/${siteName}.api.deploy_settings.json`
      : `${outputDirectory}/api/deploy_settings.json`,
    `${configsDirectory}/${siteName}.api.deploy_settings.json`,
    `${outputDirectory}/api/.env`
  );
  console.info('Please enter requested info for frontend >>>');
  await createEnvAndSavedConfigsFromInputAndDeploySettings(
    useSavedSample
      ? `${outputDirectory}/${siteName}.frontend.deploy_settings.json`
      : `${outputDirectory}/frontend/deploy_settings.json`,
    `${configsDirectory}/${siteName}.frontend.deploy_settings.json`,
    `${outputDirectory}/frontend/.env`
  );
  console.info('Please enter requested info for your domain >>>');
  const apiSettings = readDeploySettingFile(`${configsDirectory}/${siteName}.api.deploy_settings.json`);
  await createEnvAndSavedConfigsFromInputAndDeploySettings(
    useSavedSample
      ? `${configsDirectory}/${siteName}.docker.deploy_settings.json`
      : `${outputDirectory}/../deploy_settings.json`,
    `${configsDirectory}/${siteName}.docker.deploy_settings.json`,
    `${outputDirectory}/docker.env`,
    {
      SITE_NAME: siteName,
      MYSQL_ROOT_PASSWORD: apiSettings.MYSQL_PASSWORD.defaultValue,
      MYSQL_DATABASE: apiSettings.MYSQL_DATABASE.defaultValue,
    }
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
  await cloneProject('q2a.js-frontend', 'frontend');

  console.log('Download succeeded');
  const siteNameRegex = RegExp('.{3,}');
  const siteName = await prompt('Enter site name (dev for development )/siteName:', '', siteNameRegex);
  console.log('outputDirectory', outputDirectory);
  if (!fs.existsSync(`${configsDirectory}/${siteName}.docker.deploy_settings.json`)) {
    await createEnvFilesFromInput(siteName, false);
  } else {
    const edit = await prompt('Do you want edit information?(Y/N)');
    if (isAnswerYes(edit)) {
      await createEnvFilesFromInput(siteName, true);
    } else {
      createEnvFromSettingsJson(
        `${configsDirectory}/${siteName}.frontend.deploy_settings.json`,
        `${outputDirectory}/frontend/.env`
      );
      createEnvFromSettingsJson(
        `${configsDirectory}/${siteName}.api.deploy_settings.json`,
        `${outputDirectory}/api/.env`
      );
    }
  }
  const nginxSampleConfig = await fs
    .readFileSync(`${outputDirectory}/../nginx/default.conf`)
    .toString('utf8');

  const dockerFileEnvArray = await getFileNamesInDirectory(
    `${configsDirectory}`,
    '.docker.deploy_settings.json'
  );
  let nginxConfig = ``;
  for (let i = 0; i < dockerFileEnvArray.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const dockerFile = readDeploySettingFile(dockerFileEnvArray[i]);
    nginxConfig += getNginxDomainConfig(
      nginxSampleConfig,
      siteName,
      dockerFile.FRONTEND_PORT.defaultValue,
      dockerFile.API_PORT.defaultValue,
      dockerFile.DOMAIN.defaultValue
    );
  }
  nginxConfig += getNginxEndConfig(nginxSampleConfig);
  fs.writeFileSync(`${nginxDirectory}/default.conf`, nginxConfig);

  process.exit(0);
})();
