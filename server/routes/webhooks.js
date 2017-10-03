import express from 'express';
import { middlewares } from 'auth0-extension-express-tools';

import config from '../lib/config';
import deploy from '../lib/deploy';
import bitbucketWebhook from '../lib/middlewares/bitbucketWebhook';

export default (storage) => {
  const activeBranch = config('BITBUCKET_BRANCH');

  const webhooks = express.Router(); // eslint-disable-line new-cap
  webhooks.use(middlewares.managementApiClient({
    domain: config('AUTH0_DOMAIN'),
    clientId: config('AUTH0_CLIENT_ID'),
    clientSecret: config('AUTH0_CLIENT_SECRET')
  }));

  webhooks.post('/deploy/:secret?', bitbucketWebhook(), (req, res) => {
    const { id, branch, repository, user, sha } = req.webhook;

    // Only accept push requests.
    if (req.webhook.event !== 'repo:push') {
      return res.status(202).json({ message: `Request ignored, the '${req.webhook.event}' event is not supported.` });
    }

    // Only for the active branch.
    if (branch !== activeBranch) {
      return res.status(202).json({ message: `Request ignored, '${branch}' is not the active branch.` });
    }

    // Send response ASAP to prevent extra requests.
    res.status(202).json({ message: 'Request accepted, deployment started.' });

    // Deploy the changes.
    return deploy(storage, id, branch, repository, sha, user, req.auth0);
  });

  return webhooks;
};
