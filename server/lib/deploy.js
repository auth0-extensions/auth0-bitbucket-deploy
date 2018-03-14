import { deploy as sourceDeploy } from 'auth0-source-control-extension-tools';

import config from '../lib/config';
import getChanges from './bitbucket';

export default (storage, id, branch, repository, sha, user, client) => {
  const context = {
    init: (progress) => getChanges(repository, branch, sha, progress)
      .then(data => {
        console.log(data);
        context.pages = data.pages;
        context.rules = data.rules;
        context.databases = data.databases;
        context.clients = data.clients;
        context.ruleConfigs = data.ruleConfigs;
        context.resourceServers = data.resourceServers;
      })
  };

  const slackTemplate = {
    fallback: 'Bitbucket to Auth0 Deployment',
    text: 'Bitbucket to Auth0 Deployment'
  };

  return sourceDeploy({ id, branch, repository, sha, user }, context, client, storage, config, slackTemplate);
};
