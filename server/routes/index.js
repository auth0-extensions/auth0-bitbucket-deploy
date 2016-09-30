import _ from 'lodash';
import { Router as router } from 'express';
import { middlewares } from 'auth0-extension-express-tools';
import { dashboardAdmins, requireUser } from 'auth0-source-control-extension-tools';

import html from './html';
import meta from './meta';
import rules from './rules';
import hooks from './hooks';
import webhooks from './webhooks';

import config from '../lib/config';
import deploy from '../lib/deploy';


const getRepository = () => {
  const repo = config('BITBUCKET_REPOSITORY');

  const parts = repo.split('/');
  if (parts.length === 5) {
    const [ , , , account, repository ] = parts;
    return `${account}/${repository}`;
  }

  return repo;
};

export default (storage) => {
  const routes = router();

  routes.use(middlewares.managementApiClient({
    domain: config('AUTH0_DOMAIN'),
    clientId: config('AUTH0_CLIENT_ID'),
    clientSecret: config('AUTH0_CLIENT_SECRET')
  }));
  routes.use('/.extensions', hooks());
  routes.use('/', dashboardAdmins(config('AUTH0_DOMAIN'), 'Github Deployments', config('AUTH0_RTA')));
  routes.get('/', html());
  routes.use('/meta', meta());
  routes.use('/webhooks', webhooks(storage));
  routes.use('/api/rules', requireUser, rules(storage));

  routes.get('/api/config', requireUser, (req, res) => {
    res.json({
      branch: config('BITBUCKET_BRANCH'),
      secret: config('EXTENSION_SECRET'),
      repository: getRepository()
    });
  });
  routes.get('/api/deployments', requireUser, (req, res, next) =>
    storage.read()
      .then(data => res.json(_.orderBy(data.deployments || [], [ 'date' ], [ 'desc' ])))
      .catch(next)
  );
  routes.post('/api/deployments', requireUser, (req, res, next) => {
    deploy(storage, 'manual', config('BITBUCKET_BRANCH'), getRepository(), (req.body && req.body.sha) || config('BITBUCKET_BRANCH'), req.user.sub, req.auth0)
      .then(stats => res.json(stats))
      .catch(next);
  });
  return routes;
};
