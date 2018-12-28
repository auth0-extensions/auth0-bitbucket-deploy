import _ from 'lodash';
import path from 'path';
import Promise from 'bluebird';
import { constants } from 'auth0-source-control-extension-tools';
import { ArgumentError } from 'auth0-extension-tools';

import BitbucketApi from './bitbucketApi';
import config from './config';
import logger from './logger';


const bitbucket = () =>
  new BitbucketApi({
    user_name: config('BITBUCKET_USER'),
    password: config('BITBUCKET_PASSWORD'),
    rest_base: 'https://api.bitbucket.org/',
    rest_version: '2.0'
  });

const getBaseDir = () => {
  let baseDir = config('BASE_DIR') || '';
  if (baseDir.startsWith('/')) baseDir = baseDir.slice(1);
  if (baseDir !== '' && !baseDir.endsWith('/')) baseDir += '/';

  return baseDir;
};

/*
 * Check if a file is part of the rules folder.
 */
const isRule = (fileName) =>
  fileName.indexOf(`${getBaseDir()}${constants.RULES_DIRECTORY}/`) === 0;

/*
 * Check if a file is part of the database folder.
 */
const isDatabaseConnection = (fileName) =>
  fileName.indexOf(`${getBaseDir()}${constants.DATABASE_CONNECTIONS_DIRECTORY}/`) === 0;

/*
 * Check if a file is part of the templates folder - emails or pages.
 */
const isTemplates = (fileName, dir, allowedNames) =>
  fileName.indexOf(`${getBaseDir()}${dir}/`) === 0 && allowedNames.indexOf(fileName.split('/').pop()) >= 0;

/*
 * Check if a file is email provider.
 */
const isEmailProvider = (fileName) =>
  fileName === `${getBaseDir()}${constants.EMAIL_TEMPLATES_DIRECTORY}/provider.json`;

/*
 * Check if a file is part of configurable folder.
 */
const isConfigurable = (file, directory) =>
  file.indexOf(`${getBaseDir()}${directory}/`) === 0;

/*
 * Get the details of a database file script.
 */
const getDatabaseScriptDetails = (filename) => {
  const parts = filename.split('/');
  const length = parts.length;
  if (length >= 3 && /\.js$/i.test(parts[length - 1])) {
    const scriptName = path.parse(parts[length - 1]).name;
    if (constants.DATABASE_SCRIPTS.indexOf(scriptName) > -1) {
      return {
        database: parts[length - 2],
        name: path.parse(scriptName).name
      };
    }
  }
  return null;
};

const getDatabaseSettingsDetails = (filename) => {
  const parts = filename.split('/');
  const length = parts.length;
  if (length >= 3 && parts[length - 1] === 'settings.json') {
    return {
      database: parts[length - 2],
      name: 'settings'
    };
  }
  return null;
};

/*
 * Only Javascript and JSON files.
 */
const validFilesOnly = (fileName) => {
  if (isTemplates(fileName, constants.PAGES_DIRECTORY, constants.PAGE_NAMES)) {
    return true;
  } else if (isTemplates(fileName, constants.EMAIL_TEMPLATES_DIRECTORY, constants.EMAIL_TEMPLATES_NAMES)) {
    return true;
  } else if (isEmailProvider(fileName)) {
    return true;
  } else if (isRule(fileName)) {
    return /\.(js|json)$/i.test(fileName);
  } else if (isConfigurable(fileName, constants.CLIENTS_DIRECTORY)) {
    return /\.(js|json)$/i.test(fileName);
  } else if (isConfigurable(fileName, constants.CLIENTS_GRANTS_DIRECTORY)) {
    return /\.(js|json)$/i.test(fileName);
  } else if (isConfigurable(fileName, constants.CONNECTIONS_DIRECTORY)) {
    return /\.(js|json)$/i.test(fileName);
  } else if (isConfigurable(fileName, constants.RESOURCE_SERVERS_DIRECTORY)) {
    return /\.(js|json)$/i.test(fileName);
  } else if (isConfigurable(fileName, constants.RULES_CONFIGS_DIRECTORY)) {
    return /\.(js|json)$/i.test(fileName);
  } else if (isDatabaseConnection(fileName)) {
    const script = !!getDatabaseScriptDetails(fileName);
    const settings = !!getDatabaseSettingsDetails(fileName);
    return script || settings;
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
    return { user, repo };
  } else if (parts.length === 5) {
    const [ , , , user, repo ] = parts;
    return { user, repo };
  }

  throw new ArgumentError(`Invalid repository: ${repository}`);
};

const checkRepo = (repository) =>
  new Promise((resolve, reject) => {
    try {
      const { user, repo } = parseRepo(repository);

      bitbucket().get('repositories/{username}/{repo_slug}', { username: user, repo_slug: repo }, (err) => {
        if (err) {
          return reject(err);
        }

        return resolve({ user, repo });
      });
    } catch (e) {
      reject(e);
    }
  });

const unifyItem = (item, type) => {
  switch (type) {
    default:
    case 'rules': {
      const meta = item.metadataFile || {};
      const { order = 0, enabled, stage = 'login_success' } = meta;
      return ({ script: item.scriptFile, name: item.name, order, stage, enabled });
    }
    case 'pages': {
      const meta = item.metadataFile || {};
      const { enabled } = meta;
      return ({ html: item.htmlFile, name: item.name, enabled });
    }
    case 'emailTemplates': {
      if (item.name === 'provider') return null;
      const meta = item.metadataFile || {};
      return ({ ...meta, body: item.htmlFile });
    }
    case 'clientGrants':
    case 'emailProvider': {
      const data = item.configFile || {};
      return ({ ...data });
    }
    case 'databases': {
      const settings = item.settings || {};
      const customScripts = {};
      const options = settings.options || {};

      _.forEach(item.scripts, (script) => { customScripts[script.name] = script.scriptFile; });

      if (item.scripts || item.scripts.length) {
        options.customScripts = customScripts;
        options.enabledDatabaseCustomization = true;
      }

      return ({ ...settings, options, strategy: 'auth0', name: item.name });
    }
    case 'resourceServers':
    case 'connections':
    case 'clients': {
      const meta = item.metadataFile || {};
      const data = item.configFile || {};
      return ({ name: item.name, ...meta, ...data });
    }
    case 'rulesConfigs': {
      const data = item.configFile || {};
      return ({ key: item.name, value: data.value });
    }
  }
};

const unifyData = (assets) => {
  const result = {};
  _.forEach(assets, (data, type) => {
    result[type] = [];
    if (Array.isArray(data)) {
      _.forEach(data, (item) => {
        const unified = unifyItem(item, type);
        if (unified) result[type].push(unified);
      });
    } else {
      result[type] = unifyItem(data, type);
    }
  });

  return result;
};

/*
 * Get pages tree.
 */
const getTreeByDir = (params, dir) =>
  new Promise((resolve, reject) => {
    try {
      bitbucket().getTree(`repositories/{username}/{repo_slug}/src/{revision}/${getBaseDir()}${dir}`, params, (err, res) => {
        if (err && err.statusCode === 404) {
          return resolve([]);
        } else if (err) {
          return reject(err);
        } else if (!res) {
          return resolve([]);
        }

        const files = res.filter(f => validFilesOnly(f.path));

        files.forEach((elem, idx) => {
          files[idx].path = elem.path;
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
const getDBConnectionTreeByPath = (params, filePath) =>
  new Promise((resolve, reject) => {
    try {
      bitbucket().getTree(`repositories/{username}/{repo_slug}/src/{revision}/${filePath}`, params, (err, res) => {
        if (err) {
          return reject(err);
        } else if (!res) {
          return resolve([]);
        }

        const files = res.filter(f => validFilesOnly(f.path));

        files.forEach((elem, idx) => {
          files[idx].path = elem.path;
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
const getDBConnectionsTree = (params) =>
  new Promise((resolve, reject) => {
    try {
      const path = `repositories/{username}/{repo_slug}/src/{revision}/${getBaseDir()}${constants.DATABASE_CONNECTIONS_DIRECTORY}`;
      bitbucket().getTree(path, params, (err, res) => {
        if (err && err.statusCode === 404) {
          return resolve([]);
        } else if (err) {
          return reject(err);
        } else if (!res) {
          return resolve([]);
        }

        const subdirs = res.filter(item => item.type === 'commit_directory');
        const promisses = [];
        let files = [];

        _.forEach(subdirs, (dir) => {
          promisses.push(getDBConnectionTreeByPath(params, dir.path).then(data => {
            files = files.concat(data);
          }));
        });

        return Promise.all(promisses)
          .then(() => resolve(files));
      });
    } catch (e) {
      reject(e);
    }
  });

/*
 * Get tree.
 */
const getTree = (parsedRepo, branch, sha) => {
  const { user, repo } = parsedRepo;

  const params = {
    username: user,
    repo_slug: repo,
    revision: sha
  };
  const promises = {
    databases: getDBConnectionsTree(params),
    rules: getTreeByDir(params, constants.RULES_DIRECTORY),
    pages: getTreeByDir(params, constants.PAGES_DIRECTORY),
    emails: getTreeByDir(params, constants.EMAIL_TEMPLATES_DIRECTORY),
    clientGrants: getTreeByDir(params, constants.CLIENTS_GRANTS_DIRECTORY),
    connections: getTreeByDir(params, constants.CONNECTIONS_DIRECTORY),
    clients: getTreeByDir(params, constants.CLIENTS_DIRECTORY),
    rulesConfigs: getTreeByDir(params, constants.RULES_CONFIGS_DIRECTORY),
    resourceServers: getTreeByDir(params, constants.RESOURCE_SERVERS_DIRECTORY)
  };
  return Promise.props(promises)
    .then((result) => (_.union(
      result.rules,
      result.databases,
      result.emails,
      result.pages,
      result.clients,
      result.clientGrants,
      result.connections,
      result.rulesConfigs,
      result.resourceServers
    )));
};

/*
 * Download a single file.
 */
const downloadFile = (parsedRepo, branch, file, shaToken) =>
  new Promise((resolve, reject) => {
    const { user, repo } = parsedRepo;
    const params = {
      username: user,
      repo_slug: repo,
      filename: file.path,
      revision: shaToken
    };

    const url = 'repositories/{username}/{repo_slug}/src/{revision}/{filename}';
    bitbucket().get(url, params, (err, data) => {
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
const downloadRule = (parsedRepo, branch, ruleName, rule, shaToken) => {
  const currentRule = {
    script: false,
    metadata: false,
    name: ruleName
  };

  const downloads = [];

  if (rule.script) {
    downloads.push(downloadFile(parsedRepo, branch, rule.scriptFile, shaToken)
      .then(file => {
        currentRule.script = true;
        currentRule.scriptFile = file.contents;
      }));
  }

  if (rule.metadata) {
    downloads.push(downloadFile(parsedRepo, branch, rule.metadataFile, shaToken)
      .then(file => {
        currentRule.metadata = true;
        currentRule.metadataFile = file.contents;
      }));
  }

  return Promise.all(downloads)
    .then(() => currentRule);
};

/*
 * Download a single configurable file.
 */
const downloadConfigurable = (parsedRepo, branch, name, item, shaToken) => {
  const downloads = [];
  const currentItem = {
    metadata: false,
    name
  };

  if (item.configFile) {
    downloads.push(downloadFile(parsedRepo, branch, item.configFile, shaToken)
      .then(file => {
        currentItem.configFile = file.contents;
      }));
  }

  if (item.metadataFile) {
    downloads.push(downloadFile(parsedRepo, branch, item.metadataFile, shaToken)
      .then(file => {
        currentItem.metadata = true;
        currentItem.metadataFile = file.contents;
      }));
  }

  return Promise.all(downloads).then(() => currentItem);
};

/*
 * Determine if we have the script, the metadata or both.
 */
const getRules = (parsedRepo, branch, files, shaToken) => {
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
  return Promise.map(Object.keys(rules), (ruleName) =>
    downloadRule(parsedRepo, branch, ruleName, rules[ruleName], shaToken), { concurrency: 2 });
};

/*
 * Get email provider.
 */
const getEmailProvider = (parsedRepo, branch, files, shaToken) => {
  const providerFile = { configFile: _.find(files, f => isEmailProvider(f.path)) };
  return downloadConfigurable(parsedRepo, branch, 'emailProvider', providerFile, shaToken);
};

/*
 * Determine if we have the script, the metadata or both.
 */
const getConfigurables = (parsedRepo, branch, files, shaToken, directory) => {
  const configurables = {};
  _.filter(files, f => isConfigurable(f.path, directory)).forEach(file => {
    let meta = false;
    let name = path.parse(file.path).name;
    const ext = path.parse(file.path).ext;

    if (ext === '.json') {
      if (name.endsWith('.meta')) {
        name = path.parse(name).name;
        meta = true;
      }

      /* Initialize object if needed */
      configurables[name] = configurables[name] || {};

      if (meta) {
        configurables[name].metadataFile = file;
      } else {
        configurables[name].configFile = file;
      }
    }
  });

  // Download all rules.
  return Promise.map(Object.keys(configurables), (key) =>
    downloadConfigurable(parsedRepo, branch, key, configurables[key], shaToken), { concurrency: 2 });
};

/*
 * Download a single database script.
 */
const downloadDatabaseScript = (parsedRepo, branch, databaseName, scripts, shaToken) => {
  const database = {
    name: databaseName,
    scripts: []
  };

  const downloads = [];
  scripts.forEach(script => {
    downloads.push(downloadFile(parsedRepo, branch, script, shaToken)
      .then(file => {
        if (script.name === 'settings') {
          database.settings = file.contents;
        } else {
          database.scripts.push({
            name: script.name,
            scriptFile: file.contents
          });
        }
      })
    );
  });

  return Promise.all(downloads)
    .then(() => database);
};

/*
 * Get all database scripts.
 */
const getDatabaseData = (parsedRepo, branch, files, shaToken) => {
  const databases = {};

  // Determine if we have the script, the metadata or both.
  _.filter(files, f => isDatabaseConnection(f.path)).forEach(file => {
    const script = getDatabaseScriptDetails(file.path);
    const settings = getDatabaseSettingsDetails(file.path);

    if (script) {
      databases[script.database] = databases[script.database] || [];
      databases[script.database].push({
        ...script,
        sha: file.sha,
        path: file.path
      });
    }

    if (settings) {
      databases[settings.database] = databases[settings.database] || [];
      databases[settings.database].push({
        ...settings,
        id: file.id,
        path: file.path
      });
    }
  });

  return Promise.map(Object.keys(databases), (databaseName) =>
    downloadDatabaseScript(parsedRepo, branch, databaseName, databases[databaseName], shaToken), { concurrency: 2 });
};

/*
 * Download a single page script.
 */
const downloadTemplate = (parsedRepo, branch, tplName, template, shaToken) => {
  const downloads = [];
  const currentTpl = {
    metadata: false,
    name: tplName
  };

  if (template.file) {
    downloads.push(downloadFile(parsedRepo, branch, template.file, shaToken)
      .then(file => {
        currentTpl.htmlFile = file.contents;
      }));
  }

  if (template.meta_file) {
    downloads.push(downloadFile(parsedRepo, branch, template.meta_file, shaToken)
      .then(file => {
        currentTpl.metadata = true;
        currentTpl.metadataFile = file.contents;
      }));
  }

  return Promise.all(downloads)
    .then(() => currentTpl);
};

/*
 * Get all html templates - emails/pages.
 */
const getHtmlTemplates = (parsedRepo, branch, files, shaToken, dir, allowedNames) => {
  const templates = {};
  // Determine if we have the script, the metadata or both.
  _.filter(files, f => isTemplates(f.path, dir, allowedNames)).forEach(file => {
    const tplName = path.parse(file.path).name;
    const ext = path.parse(file.path).ext;
    templates[tplName] = templates[tplName] || {};

    if (ext !== '.json') {
      templates[tplName].file = file;
      templates[tplName].sha = file.sha;
      templates[tplName].path = file.path;
    } else {
      templates[tplName].meta_file = file;
      templates[tplName].meta_sha = file.sha;
      templates[tplName].meta_path = file.path;
    }
  });

  return Promise.map(Object.keys(templates), (name) =>
    downloadTemplate(parsedRepo, branch, name, templates[name], shaToken), { concurrency: 2 });
};

/*
 * Get a list of all changes that need to be applied to rules and database scripts.
 */
export default (repository, branch, sha) =>
  checkRepo(repository)
    .then((parsedRepo) => getTree(parsedRepo, branch, sha)
      .then(files => {
        logger.debug(`Files in tree: ${JSON.stringify(files.map(file => ({
          path: file.path,
          sha: file.path
        })), null, 2)}`);

        const promises = {
          rules: getRules(parsedRepo, branch, files, sha),
          databases: getDatabaseData(parsedRepo, branch, files, sha),
          emailProvider: getEmailProvider(parsedRepo, branch, files, sha),
          emailTemplates: getHtmlTemplates(parsedRepo, branch, files, sha, constants.EMAIL_TEMPLATES_DIRECTORY, constants.EMAIL_TEMPLATES_NAMES),
          pages: getHtmlTemplates(parsedRepo, branch, files, sha, constants.PAGES_DIRECTORY, constants.PAGE_NAMES),
          clients: getConfigurables(parsedRepo, branch, files, sha, constants.CLIENTS_DIRECTORY),
          clientGrants: getConfigurables(parsedRepo, branch, files, sha, constants.CLIENTS_GRANTS_DIRECTORY),
          connections: getConfigurables(parsedRepo, branch, files, sha, constants.CONNECTIONS_DIRECTORY),
          rulesConfigs: getConfigurables(parsedRepo, branch, files, sha, constants.RULES_CONFIGS_DIRECTORY),
          resourceServers: getConfigurables(parsedRepo, branch, files, sha, constants.RESOURCE_SERVERS_DIRECTORY)
        };

        return Promise.props(promises)
          .then((result) => Promise.resolve(unifyData(result)));
      }));
