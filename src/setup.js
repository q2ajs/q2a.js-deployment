import fs from 'fs';
import replaceOnce from 'replace-once';
import {
  prompt,
  readDeploySettingFile,
  isAnswerYes,
  outputDirectory,
  configsDirectory,
  nginxDirectory,
  sqlDirectory,
  cloneProject,
  createFolderIfNotExist,
  copyFile,
  getFileNamesInDirectory,
  createEnvAndSavedConfigsFromInputAndDeploySettings,
  createEnvFromSettingsJson,
  writeEnvFile,
  sqlInitDirectory,
} from './utility.js';

const createEnvFilesFromInput = async (siteName, useSavedSample) => {
  console.info('Please enter requested info for your domain >>>');
  await createEnvAndSavedConfigsFromInputAndDeploySettings(
    useSavedSample
      ? `${configsDirectory}/${siteName}.main.deploy_settings.json`
      : `${outputDirectory}/../deploy_settings.json`,
    `${configsDirectory}/${siteName}.main.deploy_settings.json`,
    null,
    [{ SITE_NAME: siteName }]
  );
  const dockerSettings = readDeploySettingFile(`${configsDirectory}/${siteName}.main.deploy_settings.json`);

  console.log(`Please wait for downloading projects for ${siteName}...`);
  await cloneProject(dockerSettings.API_BRANCH_TO_CLONE.defaultValue, 'q2a.js-api', `${siteName}/api`);
  await cloneProject(
    dockerSettings.FRONTEND_BRANCH_TO_CLONE.defaultValue,
    'q2a.js-frontend',
    `${siteName}/frontend`
  );
  console.log('Download succeeded');

  console.info('Please enter requested info for api >>>');
  await createEnvAndSavedConfigsFromInputAndDeploySettings(
    useSavedSample
      ? `${configsDirectory}/${siteName}.api.deploy_settings.json`
      : `${outputDirectory}/${siteName}/api/deploy_settings.json`,
    `${configsDirectory}/${siteName}.api.deploy_settings.json`,
    `${outputDirectory}/${siteName}/api/.env`,
    [
      { MYSQL_HOST: 'mysql' },
      { MYSQL_PASSWORD: dockerSettings.MYSQL_PASSWORD.defaultValue },
      { MYSQL_USER: dockerSettings.MYSQL_USER.defaultValue },
      { MYSQL_PORT: dockerSettings.MYSQL_PORT.defaultValue },
    ]
  );
  console.info('Please enter requested info for frontend >>>');
  await createEnvAndSavedConfigsFromInputAndDeploySettings(
    useSavedSample
      ? `${configsDirectory}/${siteName}.frontend.deploy_settings.json`
      : `${outputDirectory}/${siteName}/frontend/deploy_settings.json`,
    `${configsDirectory}/${siteName}.frontend.deploy_settings.json`,
    `${outputDirectory}/${siteName}/frontend/.env`,
    [{ NEXT_PUBLIC_GRAPHQL_URL: `https://${siteName}/graphql` }]
  );
};

const getNginxEndConfig = (sampleConfig) => {
  return sampleConfig.substring(sampleConfig.lastIndexOf('%end%') + '%end%'.length, sampleConfig.length);
};

const getNginxDomainConfig = (sampleConfig, SITE_NAME, DOMAIN) => {
  const configToRepeat = sampleConfig.substring(
    sampleConfig.indexOf('%begin%') + '%begin%'.length,
    sampleConfig.lastIndexOf('%end%')
  );
  const find = ['%frontend%', '%api%', '%sitename%', '%domain%'];
  const replace = [`${SITE_NAME}_frontend`, `${SITE_NAME}_api`, `${SITE_NAME}`, `${DOMAIN}`];
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
      dockerSettingFileNames[i].lastIndexOf(`/`) + 1,
      dockerSettingFileNames[i].lastIndexOf('.main.deploy_settings.json')
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
  createFolderIfNotExist(sqlDirectory);
  createFolderIfNotExist(sqlInitDirectory);
  await copyFile(`${outputDirectory}/../mysql/01.sql`, `${sqlInitDirectory}/01.sql`);

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
  await copyFile(`${outputDirectory}/../mysql/01.sql`, `${sqlInitDirectory}/01.sql`);

  const siteNameRegex = RegExp('[a-z]{3,}');
  // const siteNameRegex =/[a-z]/.test(siteNameRegex);
  const siteName = await prompt('Enter site name (dev for development )/siteName:', '', siteNameRegex);

  if (!fs.existsSync(`${configsDirectory}/${siteName}.main.deploy_settings.json`)) {
    await createEnvFilesFromInput(siteName, false);
  } else {
    const edit = await prompt('Do you want edit information?(Y/N)');
    if (isAnswerYes(edit)) {
      await createEnvFilesFromInput(siteName, true);
    } else {
      console.log(`Please wait for downloading projects for ${siteName}...`);
      await cloneProject('q2a.js-api', `${siteName}/api`);
      await cloneProject('q2a.js-frontend', `${siteName}/frontend`);
      console.log('Download succeeded');

      const dockerSettings = readDeploySettingFile(
        `${configsDirectory}/${siteName}.main.deploy_settings.json`
      );

      createEnvFromSettingsJson(
        `${configsDirectory}/${siteName}.api.deploy_settings.json`,
        `${outputDirectory}/${siteName}/api/.env`,
        [
          { MYSQL_HOST: 'mysql' },
          { MYSQL_PASSWORD: dockerSettings.MYSQL_PASSWORD.defaultValue },
          { MYSQL_USER: dockerSettings.MYSQL_USER.defaultValue },
          { MYSQL_PORT: dockerSettings.MYSQL_PORT.defaultValue },
        ]
      );

      createEnvFromSettingsJson(
        `${configsDirectory}/${siteName}.frontend.deploy_settings.json`,
        `${outputDirectory}/${siteName}/frontend/.env`,
        [{ NEXT_PUBLIC_GRAPHQL_URL: `https://${siteName}/graphql` }]
      );
    }
  }
  const nginxSampleConfig = await fs
    .readFileSync(`${outputDirectory}/../nginx/default.conf`)
    .toString('utf8');

  // Nginx configs
  const dockerSettingFiles = await getFileNamesInDirectory(
    `${configsDirectory}`,
    '.main.deploy_settings.json'
  );

  let nginxConfig = ``;
  const dockerEnv = [];
  for (let i = 0; i < dockerSettingFiles.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const currentSiteName = dockerSettingFiles[i].substring(
      dockerSettingFiles[i].lastIndexOf('/') + 1,
      dockerSettingFiles[i].lastIndexOf('.main.deploy_settings.json')
    );
    const dockerFile = readDeploySettingFile(
      `${outputDirectory}/config/${currentSiteName}.main.deploy_settings.json`
    );
    nginxConfig += getNginxDomainConfig(nginxSampleConfig, currentSiteName, dockerFile.DOMAIN.defaultValue);
    for (let [key, value] of Object.entries(dockerFile)) {
      const result = {};
      if (value.relatedToSite) key = `${currentSiteName}_${key}`;
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
