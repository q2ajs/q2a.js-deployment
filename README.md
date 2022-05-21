### Preparation

Install nodejs 14.17.x (you can use [nvm](https://github.com/coreybutler/nvm-windows/releases))

Install packages:

```
yarn install_prod_modules
```

### Setup 
Fill necessary info for your site 
```
yarn setup
```
( If you want to add a new site run this again)

This will clone api and frontend projects into cloned_project and create nginx and docker configs

## Run :

Use this to deploy docker images and use your site 

```
yarn deploy_docker
```
