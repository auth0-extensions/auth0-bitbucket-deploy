import ipaddr from 'ipaddr.js';
import {ArgumentError, UnauthorizedError} from '../errors';

const parse = (headers, {push = {}, repository = {}, actor = {}}) => {
  if (push.changes && push.changes.length > 0 && push.changes[0].new) {
    const details = push.changes[0].new;
    let diff = null;
    if (push.changes[0].links && push.changes[0].links.diff)
      diff = push.changes[0].links.diff.href.split('/').pop();
    return {
      id: headers['x-hook-uuid'],
      event: headers['x-event-key'],
      branch: (details.type === 'branch' || details.type === 'named_branch') ? details.name : '',
      commits: push.changes[0].commits,
      repository: repository.full_name,
      user: actor.display_name,
      diff: diff,
      sha: details.target.hash
    };
  } else {
    return {
      id: headers['x-hook-uuid'],
      event: headers['x-event-key'],
      branch: '',
      commits: [],
      repository: repository.full_name,
      user: actor.display_name,
      sha: '',
      diff: ''
    }
  }
};
const getIpInRange = (currIp)=> {
  let address;

  if (ipaddr.IPv4.isValid(currIp)) {
    address = ipaddr.IPv4.parse(currIp)
  }
  else if (ipaddr.IPv6.isValid(currIp)) {
    address = ipaddr.IPv6.parse(currIp).toIPv4Address();
  }
  else {
    return false;
  }

  return address.match(ipaddr.parseCIDR('131.103.20.160/27'))
    || address.match(ipaddr.parseCIDR('165.254.145.0/26'))
    || address.match(ipaddr.parseCIDR('104.192.143.0/24'));
};
module.exports = () => (req, res, next) => {
  console.log(req.headers);
  console.log(req.connection.remoteAddress);
  console.log(req.ip);
  console.log(req.ips);

  if (!req.headers['x-hook-uuid']) {
    return next(new ArgumentError('The Bitbucket delivery identifier is missing.'));
  }
  if (!req.headers['x-event-key']) {
    return next(new ArgumentError('The Bitbucket event name is missing.'));
  }
  if (!getIpInRange(req.headers['x-forwarded-for'])) {
    return next(new ArgumentError(`The Bitbucket delivery ip (${req.headers['x-forwarded-for']}) is not correct.`));
  }

  req.webhook = parse(req.headers, req.body);
  return next();
};
