import express from 'express';

import config from '../lib/config';
import deploy from '../lib/deploy';

import { bitbucketWebhook } from '../lib/middlewares';

export default (storageContext) => {
  const activeBranch = config('BITBUCKET_BRANCH');

  const webhooks = express.Router();
  webhooks.post('/deploy/:secret?', bitbucketWebhook(), (req, res, next) => {
    const { id, branch, repository, user, sha, diff } = req.webhook;

    // Only accept push requests.
    if (req.webhook.event !== 'repo:push') {
      return res.status(202).json({ message: `Request ignored, the '${req.webhook.event}' event is not supported.` });
    }
    // Only for the active branch.
    if (branch !== activeBranch) {
      return res.status(202).json({ message: `Request ignored, '${branch}' is not the active branch.` });
    }

    // Send response ASAP to prevent extra requests.
    res.status(202).json();

    // Deploy the changes.
    return deploy(storageContext, id, branch, repository, sha, user, diff);
  });

  return webhooks;
};
