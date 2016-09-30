import { deploy as sourceDeploy } from 'auth0-source-control-extension-tools';

import config from '../lib/config';
import { getChanges } from './bitbucket';

export default (storage, id, branch, repository, sha, user, client) => {
  const context = {
    init: () => getChanges(repository, branch, sha)
      .then(data => {
        context.pages = data.pages;
        context.rules = data.rules;
        context.databases = data.databases;
      })
  };

  const slackTemplate = {
    fallback: 'Bitbucket to Auth0 Deployment',
    text: 'Bitbucket to Auth0 Deployment'
  };

  return sourceDeploy({ id, branch, repository, sha, user }, context, client, storage, config, slackTemplate);
};
