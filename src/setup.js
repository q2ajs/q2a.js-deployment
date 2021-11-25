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
  writeEnvFile,
} from './utility.js';

const createEnvFilesFromInput = async (siteName, useSavedSample, dataString) => {
  console.log(`Please wait for downloading projects for ${siteName}...`);
  await cloneProject('q2a.js-api', `${siteName}/api`);
  await cloneProject('q2a.js-frontend', `${siteName}/frontend`);
  console.log('Download succeeded');
  console.info('Please enter requested info for api >>>');
  await createEnvAndSavedConfigsFromInputAndDeploySettings(
    useSavedSample
      ? `${configsDirectory}/${siteName}.api.deploy_settings.json`
      : `${outputDirectory}/${siteName}/api/deploy_settings.json`,
    `${configsDirectory}/${siteName}.api.deploy_settings.json`,
    `${outputDirectory}/${siteName}/api/.env`,
    [{ MYSQL_HOST: 'mysql' }]
  );
  console.info('Please enter requested info for frontend >>>');
  await createEnvAndSavedConfigsFromInputAndDeploySettings(
    useSavedSample
      ? `${configsDirectory}/${siteName}.frontend.deploy_settings.json`
      : `${outputDirectory}/${siteName}/frontend/deploy_settings.json`,
    `${configsDirectory}/${siteName}.frontend.deploy_settings.json`,
    `${outputDirectory}/${siteName}/frontend/frontend/.env`,
    [{ NEXT_PUBLIC_GRAPHQL_URL: 'http://api:4000/graphql' }]
  );
  console.info('Please enter requested info for your domain >>>');
  const apiSettings = readDeploySettingFile(`${configsDirectory}/${siteName}.api.deploy_settings.json`);
  await createEnvAndSavedConfigsFromInputAndDeploySettings(
    useSavedSample
      ? `${configsDirectory}/${siteName}.docker.deploy_settings.json`
      : `${outputDirectory}/../deploy_settings.json`,
    `${configsDirectory}/${siteName}.docker.deploy_settings.json`,
    `${outputDirectory}/docker.env`,
    [
      { SITE_NAME: siteName },
      { MYSQL_ROOT_PASSWORD: apiSettings.MYSQL_PASSWORD.defaultValue },
      { MYSQL_DATABASE: apiSettings.MYSQL_DATABASE.defaultValue },
    ],
    dataString
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
  return replaceOnce(configToRepeat, find, replace, 'gi');
};

const createDockerComposerFromConfigs = (sampleConfig, dockerSettingFileNames) => {
  const dataArray = [];
  let dockerComposeConfig = '';
  // First part of file
  dockerComposeConfig += sampleConfig.substring(0, sampleConfig.indexOf('%'));
  let nginxDepend = '';

  for (let i = 0; i < dockerSettingFileNames.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const siteName = dockerSettingFileNames[i].substring(
      dockerSettingFileNames[i].indexOf(`\\`) + 1,
      dockerSettingFileNames[i].lastIndexOf('.docker.deploy_settings.json')
    );
    const find = ['%SITE_NAME%'];
    const replace = [`${siteName}`];
    nginxDepend += `${sampleConfig.substring(
      sampleConfig.indexOf('%Nginx_Begin%') + '%Nginx_Begin%'.length,
      sampleConfig.lastIndexOf('%Nginx_End%')
    )}\n`;
    const configToRepeatAPI = sampleConfig.substring(
      sampleConfig.indexOf('%API_Begin%') + '%API_Begin%'.length,
      sampleConfig.lastIndexOf('%API_End%')
    );
    const configToRepeatFrontend = sampleConfig.substring(
      sampleConfig.indexOf('%Frontend_Begin%') + '%Frontend_Begin%'.length,
      sampleConfig.lastIndexOf('%Frontend_End%')
    );
    nginxDepend = replaceOnce(nginxDepend, find, replace, 'gi');
    const APISection = replaceOnce(configToRepeatAPI, find, replace, 'gi');
    const frontendSection = replaceOnce(configToRepeatFrontend, find, replace, 'gi');
    // eslint-disable-next-line no-param-reassign
    dataArray.push(APISection);
    dataArray.push(frontendSection);
  }
  dataArray.unshift(nginxDepend);
  for (const section in dataArray) {
    dockerComposeConfig += dataArray[section];
  }
  dockerComposeConfig += sampleConfig.substring(sampleConfig.lastIndexOf('%') + 1, sampleConfig.length);
  dockerComposeConfig = dockerComposeConfig.replace(/(^[ \t]*\r*\n)/gm, ''); // remove empty lines
  return dockerComposeConfig;
};

(async () => {
  createFolderIfNotExist(outputDirectory);
  createFolderIfNotExist(configsDirectory);
  // nginx folder
  createFolderIfNotExist(nginxDirectory);
  await copyFile(`${outputDirectory}/../nginx/default.conf`, `${nginxDirectory}/default.conf`);
  await copyFile(`${outputDirectory}/../nginx/Dockerfile`, `${nginxDirectory}/Dockerfile`);
  await copyFile(
    `${outputDirectory}/../docker/docker-compose.yaml`,
    `${outputDirectory}/docker-compose.yaml`
  );
  await copyFile(
    `${outputDirectory}/../docker/docker-compose.yaml`,
    `${outputDirectory}/docker-compose.yaml`
  );

  const siteNameRegex = RegExp('.{3,}');
  const siteName = await prompt('Enter site name (dev for development )/siteName:', '', siteNameRegex);
  if (!fs.existsSync(`${configsDirectory}/${siteName}.docker.deploy_settings.json`)) {
    await createEnvFilesFromInput(siteName, false);
  } else {
    const edit = await prompt('Do you want edit information?(Y/N)');
    if (isAnswerYes(edit)) {
      await createEnvFilesFromInput(siteName, true);
    } else {
      createEnvFromSettingsJson(
        `${configsDirectory}/${siteName}.frontend.deploy_settings.json`,
        `${outputDirectory}/${siteName}/frontend/.env`,
        [{ NEXT_PUBLIC_GRAPHQL_URL: 'http://api:4000/graphql' }]
      );
      createEnvFromSettingsJson(
        `${configsDirectory}/${siteName}.api.deploy_settings.json`,
        `${outputDirectory}/${siteName}/api/.env`,
        [{ MYSQL_HOST: 'mysql' }]
      );
      const apiSettings = readDeploySettingFile(`${configsDirectory}/${siteName}.api.deploy_settings.json`);
      createEnvFromSettingsJson(
        `${configsDirectory}/${siteName}.docker.deploy_settings.json`,
        `${outputDirectory}/docker.env`,
        [
          { SITE_NAME: siteName },
          { MYSQL_ROOT_PASSWORD: apiSettings.MYSQL_PASSWORD.defaultValue },
          { MYSQL_DATABASE: apiSettings.MYSQL_DATABASE.defaultValue },
        ]
      );
    }
  }
  const nginxSampleConfig = await fs
    .readFileSync(`${outputDirectory}/../nginx/default.conf`)
    .toString('utf8');

  // Nginx configs
  const dockerSettingFiles = await getFileNamesInDirectory(
    `${configsDirectory}`,
    '.docker.deploy_settings.json'
  );

  let nginxConfig = ``;
  const dockerEnv = [];
  for (let i = 0; i < dockerSettingFiles.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const currentSiteName = dockerSettingFiles[i].substring(
      dockerSettingFiles[i].indexOf('.docker.deploy_settings.json') + 1,
      dockerSettingFiles[i].lastIndexOf('.docker.deploy_settings.json')
    );
    const dockerFile = readDeploySettingFile(`${outputDirectory}/config/${dockerSettingFiles[i]}`);
    nginxConfig += getNginxDomainConfig(
      nginxSampleConfig,
      currentSiteName,
      dockerFile.FRONTEND_PORT.defaultValue,
      dockerFile.API_PORT.defaultValue,
      dockerFile.DOMAIN.defaultValue
    );
    for (let [key, value] of Object.entries(dockerFile)) {
      const result = {};
      key = `${currentSiteName}_${key}`;
      result[key] = `${value.defaultValue}`;
      dockerEnv.push(result);
    }
  }
  await writeEnvFile(`${outputDirectory}/docker.env`, dockerEnv);
  nginxConfig += getNginxEndConfig(nginxSampleConfig);
  fs.writeFileSync(`${nginxDirectory}/default.conf`, nginxConfig);

  // Docker compose config
  const dockerComposeSampleFile = fs
    .readFileSync(`${outputDirectory}/../docker/docker-compose.yaml`)
    .toString('utf8');
  const dockerComposeConfig = createDockerComposerFromConfigs(dockerComposeSampleFile, dockerSettingFiles);
  fs.writeFileSync(`${outputDirectory}/docker-compose.yaml`, dockerComposeConfig);
  process.exit(0);
})();
