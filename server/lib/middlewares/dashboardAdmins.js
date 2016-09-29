import url from 'url';
import auth0 from 'auth0-oauth2-express';

import config from '../config';

export default () => {
  const options = {
    credentialsRequired: false,
    clientName: 'Bitbucket Deployments',
    audience: () => `https://${config('AUTH0_DOMAIN')}/api/v2/`
  };

  return (req, res, next) => {
    const protocol = 'https';
    const pathname = url.parse(req.originalUrl).pathname.replace(req.path, '');
    const baseUrl = url.format({
      protocol,
      host: req.get('host'),
      pathname
    });

    return auth0({
      credentialsRequired: false,
      clientName: 'Bitbucket Deployments',
      audience:   () => `https://${config('AUTH0_DOMAIN')}/api/v2/`,
      clientId:   baseUrl,
      rootTenantAuthority: req.webtaskContext.data.AUTH0_RTA
    })(req, res, next);
  };
};