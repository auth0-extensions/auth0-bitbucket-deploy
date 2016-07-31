import _ from 'lodash';
import path from 'path';
import Promise from 'bluebird';

import config from './config';
import bitbucketApi from './bitbucketApi';
import logger from '../lib/logger';
import * as constants from './constants';

const bitbucket = () =>
  new bitbucketApi({
    user_name: config('BITBUCKET_USER'),
    password: config('BITBUCKET_PASSWORD'),
    rest_base: 'https://api.bitbucket.org/',
    rest_version: '1.0'
  });
/*
 * Check if a file is part of the rules folder.
 */
const isRule = (fileName) =>
  fileName.indexOf(`${constants.RULES_DIRECTORY}/`) === 0;

/*
 * Check if a file is part of the database folder.
 */
const isDatabaseConnection = (fileName) =>
  fileName.indexOf(`${constants.DATABASE_CONNECTIONS_DIRECTORY}/`) === 0;

/*
 * Get the details of a database file script.
 */
const getDatabaseScriptDetails = (filename) => {
  const parts = filename.split('/');
  if (parts.length === 3 && /\.js$/i.test(parts[2])) {
    const scriptName = path.parse(parts[2]).name;
    if (constants.DATABASE_SCRIPTS.indexOf(scriptName) > -1) {
      return {
        database: parts[1],
        name: path.parse(scriptName).name
      };
    }
  }
  return null;
};

/*
 * Only Javascript and JSON files.
 */
const validFilesOnly = (fileName) => {
  if (isRule(fileName)) {
    return /\.(js|json)$/i.test(fileName);
  } else if (isDatabaseConnection(fileName)) {
    const script = getDatabaseScriptDetails(fileName);
    return !!script;
  }
  return false;
};

/*
 * Parse the repository.
 */
const parseRepo = (repository = '') => {
  const parts = repository.split('/');
  if (parts.length === 2) {
    const [ user, repo ] = parts;
    return {user, repo};
  } else if (parts.length === 5) {
    const [ , , , user, repo ] = parts;
    return {user, repo};
  }

  throw new Error(`Invalid repository: ${repository}`);
};

/*
 * Get rules tree.
 */
const getRulesTree = (params) =>
  new Promise((resolve, reject) => {
    try {
      bitbucket().get('repositories/{username}/{repo_slug}/src/{revision}/' + constants.RULES_DIRECTORY, params, (err, res, response) => {
        if (err && err.message == 'Status Code: 404') {
          return resolve([]);
        }
        else if (err) {
          return reject(err);
        } else if (!res) {
          return resolve([]);
        }
        const files = res.files
          .filter(f => validFilesOnly(f.path));
        files.forEach((elem, idx) => {
          files[idx].path = elem.path
        });
        return resolve(files);
      });
    } catch (e) {
      reject(e);
    }
  });

/*
 * Get connection files for one db connection
 */
const getConnectionTreeByPath = (params, path) =>
  new Promise((resolve, reject) => {
    try {
      bitbucket().get('repositories/{username}/{repo_slug}/src/{revision}/' + path, params, (err, res, response) => {
        if (err) {
          return reject(err);
        } else if (!res) {
          return resolve([]);
        }
        const files = res.files
          .filter(f => validFilesOnly(f.path));

        files.forEach((elem, idx) => {
          files[idx].path = elem.path
        });
        return resolve(files);
      });
    } catch (e) {
      reject(e);
    }
  });

/*
 * Get all files for all database-connections.
 */
const getConnectionsTree = (params) =>
  new Promise((resolve, reject) => {
    try {
      bitbucket().get('repositories/{username}/{repo_slug}/src/{revision}/' + constants.DATABASE_CONNECTIONS_DIRECTORY, params, (err, res, response) => {
        if (err && err.message == 'Status Code: 404') {
          return resolve([]);
        }
        else if (err) {
          return reject(err);
        } else if (!res) {
          return resolve([]);
        }
        const subdirs = res.directories;
        const promisses = [];
        let files = [];
        for (var i in subdirs) {
          promisses.push(getConnectionTreeByPath(params, constants.DATABASE_CONNECTIONS_DIRECTORY + '/' + subdirs[i]).then(data => {
            files = files.concat(data);
          }));
        }

        Promise.all(promisses)
          .then(() => resolve(files));
      });
    } catch (e) {
      reject(e);
    }
  });

/*
 * Get tree.
 */
const getTree = (repository, branch, sha) => {
  const {user, repo} = parseRepo(repository);
  let params = {
    'username': user,
    'repo_slug': repo,
    'revision': sha
  };
  const promises = {
    connections: getConnectionsTree(params),
    rules: getRulesTree(params)
  };
  return Promise.props(promises)
    .then((result) => (_.union(result.rules, result.connections)));
};

/*
 * Download a single file.
 */
const downloadFile = (repository, branch, file, shaToken) =>
  new Promise((resolve, reject) => {
    const {user, repo} = parseRepo(repository);
    let params = {
      'username': user,
      'repo_slug': repo,
      'filename': file.path,
      'revision': shaToken
    };
    const url = 'repositories/{username}/{repo_slug}/raw/{revision}/{filename}';
    bitbucket().get(url, params, (err, data, response) => {
      if (err !== null) {
        logger.error(`Error downloading '${file.path}'`);
        logger.error(err);
        reject(err);
      } else {
        resolve({
          fileName: file.path,
          contents: data
        });
      }
    });
  });


/*
 * Download a single rule with its metadata.
 */
const downloadRule = (repository, branch, ruleName, rule, shaToken) => {
  const currentRule = {
    ...rule,
    name: ruleName
  };

  const downloads = [];

  if (rule.script) {
    downloads.push(downloadFile(repository, branch, rule.scriptFile, shaToken)
      .then(file => {
        currentRule.script = file.contents;
      }));
  }

  if (rule.metadata) {
    downloads.push(downloadFile(repository, branch, rule.metadataFile, shaToken)
      .then(file => {
        currentRule.metadata = file.contents;
      }));
  }

  return Promise.all(downloads)
    .then(() => currentRule);
};

/*
 * Determine if we have the script, the metadata or both.
 */
const getRules = (repository, branch, files, shaToken) => {
  // Rules object.
  const rules = {};

  // Determine if we have the script, the metadata or both.
  _.filter(files, f => isRule(f.path)).forEach(file => {
    const ruleName = path.parse(file.path).name;
    rules[ruleName] = rules[ruleName] || {};

    if (/\.js$/i.test(file.path)) {
      rules[ruleName].script = true;
      rules[ruleName].scriptFile = file;
    } else if (/\.json$/i.test(file.path)) {
      rules[ruleName].metadata = true;
      rules[ruleName].metadataFile = file;
    }
  });

  // Download all rules.
  return Promise.map(Object.keys(rules), (ruleName) => downloadRule(repository, branch, ruleName, rules[ruleName], shaToken), {concurrency: 2});
};

/*
 * Download a single database script.
 */
const downloadDatabaseScript = (repository, branch, databaseName, scripts, shaToken) => {
  const database = {
    name: databaseName,
    scripts: []
  };

  const downloads = [];
  scripts.forEach(script => {
    downloads.push(downloadFile(repository, branch, script, shaToken)
      .then(file => {
        database.scripts.push({
          stage: script.name,
          contents: file.contents
        });
      })
    );
  });

  return Promise.all(downloads)
    .then(() => database);
};

/*
 * Get all database scripts.
 */
const getDatabaseScripts = (repository, branch, files, shaToken) => {
  const databases = {};

  // Determine if we have the script, the metadata or both.
  _.filter(files, f => isDatabaseConnection(f.path)).forEach(file => {
    const script = getDatabaseScriptDetails(file.path);
    if (script) {
      databases[script.database] = databases[script.database] || [];
      databases[script.database].push({
        ...script,
        sha: file.sha,
        path: file.path
      });
    }
  });

  return Promise.map(Object.keys(databases), (databaseName) => downloadDatabaseScript(repository, branch, databaseName, databases[databaseName], shaToken), {concurrency: 2});
};

/*
 * Get a list of all changes that need to be applied to rules and database scripts.
 */
export const getChanges = (repository, branch, sha) =>
  getTree(repository, branch, sha)
    .then(files => {
      logger.debug(`Files in tree: ${JSON.stringify(files.map(file => ({
        path: file.path,
        sha: file.path
      })), null, 2)}`);

      const promises = {
        rules: getRules(repository, branch, files, sha),
        databases: getDatabaseScripts(repository, branch, files, sha)
      };

      return Promise.props(promises)
        .then((result) => ({
          rules: result.rules,
          databases: result.databases
        }));
    });
