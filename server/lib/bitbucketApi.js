import _ from 'lodash';
import request from 'request';
import extend from 'deep-extend';

function Bitbucket(options) {
  if (!(this instanceof Bitbucket)) return new Bitbucket(options);

  this.options = extend({
    user_name: null,
    password: null,
    rest_base: '',
    rest_version: '',
    rest_path: '',
    request_options: {
      headers: {
        'Content-Type': 'application/json'
      }
    }
  }, options);

  this.request = request;
}

Bitbucket.prototype.buildEndpoint = (path, params) => {
  let url = `${this.options.rest_base}${this.options.rest_path}${this.options.rest_version}/${path}`;

  _.forEach(params, (param, key) => {
    url = url.replace(`{${key}}`, param);
  });

  return {
    url,
    params
  };
};

Bitbucket.prototype.request = (method, path, params, callback) => {
  if (typeof params === 'function') {
    callback = params; // eslint-disable-line no-param-reassign
    params = {}; // eslint-disable-line no-param-reassign
  }

  const endpoint = this.buildEndpoint(path, params);

  const options = {
    method: method.toLowerCase(), // Request method - get || post
    url: endpoint.url
  };

  // Pass url parameters if get
  if (method === 'get') {
    options.qs = endpoint.params;
  }

  // Pass form data if post
  if (method === 'post' || method === 'put') {
    options.body = JSON.stringify(params);
  }

  options.headers = this.options.request_options.headers;

  this.request(options, (error, response, data) => {
    if (error) {
      callback(error, data, response);
    } else {
      try {
        data = JSON.parse(data); // eslint-disable-line no-param-reassign
        if (typeof data.errors !== 'undefined') {
          callback(data.errors, data, response);
        } else if (response.statusCode !== 200) {
          callback(new Error(`Status Code: ${response.statusCode}`), data, response);
        } else {
          callback(null, data, response);
        }
      } catch (parseError) {
        if (response.statusCode === 200) {
          callback(null, data, response);
        } else {
          callback(new Error(`Status Code: ${response.statusCode}`), data, response);
        }
      }
    }
  }).auth(this.options.user_name, this.options.password, true);
};

Bitbucket.prototype.get = (url, params, callback) => this.request('get', url, params, callback);

Bitbucket.prototype.post = (url, params, callback) => this.request('post', url, params, callback);

Bitbucket.prototype.put = (url, params, callback) => this.request('put', url, params, callback);

Bitbucket.prototype.delete = (url, params, callback) => this.request('delete', url, params, callback);

module.exports = Bitbucket;
