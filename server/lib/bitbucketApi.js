'use strict';
var request = require('request');
var extend = require('deep-extend');

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
        'Content-Type': 'application/json',
      }
    }
  }, options);

  this.request = request;
}

Bitbucket.prototype.__buildEndpoint = function(path, params) {
  if (path.charAt(0) === '/') {
    '' + path;
  }

  var url = this.options.rest_base + this.options.rest_path + this.options.rest_version + '/' + path;

  for (var key in params) {
    if (params.hasOwnProperty(key)) {
      url = url.replace('{' + key + '}', params[key]);
    }
  }

  return {
    url: url,
    params: params
  }
};

Bitbucket.prototype.__request = function(method, path, params, callback) {
  if (typeof params === 'function'){
     callback = params;
     params = {};
  }

  var endpoint = this.__buildEndpoint(path, params);

  var options = {
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

  this.request(options, function(error, response, data) {
    if (error) {
      callback(error, data, response);
    } else {
      try {
        data = JSON.parse(data);
        if (typeof data.errors !== 'undefined') {
          callback(data.errors, data, response);
        } else if (response.statusCode !== 200) {
          callback(new Error('Status Code: ' + response.statusCode), data, response);
        } else {
          callback(null, data, response);
        }
      } catch (parseError) {
        if(response.statusCode == 200) {
          callback(null, data, response);
        }else{
          callback(new Error('Status Code: ' + response.statusCode), data, response);
        }
      }
    }
  }).auth(this.options.user_name, this.options.password, true);
};

Bitbucket.prototype.get = function(url, params, callback) {
  return this.__request('get', url, params, callback);
};

Bitbucket.prototype.post = function(url, params, callback) {
  return this.__request('post', url, params, callback);
};

Bitbucket.prototype.put = function(url, params, callback) {
  return this.__request('put', url, params, callback);
};

Bitbucket.prototype.delete = function(url, params, callback) {
  return this.__request('delete', url, params, callback);
};

module.exports = Bitbucket;
