Bitbucket Server REST Api client
===================================

Supports all Bitbucket Server [REST api calls](https://developer.atlassian.com/static/rest/bitbucket-server/4.3.1/bitbucket-rest.html).

Installation
-----------------
**Not currently published**
```bash
npm install bitbucket-server-rest
```


Authentication and initialization
------------------------------------

```javascript
var Bitbucket = require('bitbucket-server-rest');

var bitbucket = new Bitbucket({
  user_name: '<your user name>',
  password: '<your password>',
  rest_base: 'http://<your bitbucket base server url>'
});

//Make a call to get a list of projects
bitbucket.get('projects', function(err, data, response){
  if (err){
    console.log(err)
  }

  console.log(data)
});

```

Requests
--------------
Params is optional.

```javascript
bitbucket.get(path, params, callback);
bitbucket.post(path, params, callback);
bitbucket.put(path, params, callback);
bitbucket.delete(path, params, callback);
```

The callback parameters are as followed

`error` Is the error object, the http status code or undefined.  
`data` Is the data value from the server.  
`response` is the full http response from the server.  

REST Api
-----------------
We implement the full [Bitbucket server REST API](https://developer.atlassian.com/static/rest/bitbucket-server/4.3.1/bitbucket-rest.html) as followed.
Just pass the rest call as the path with appropriate options.

```javascript
var params = {
  projectKey: 'YourProjectKey',
  repositorySlug: 'TheSlug',
  pullRequestId: '123'
};

bitbucket.get('projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}', params, function(err, data, response){
  if (err){
    console.log(err)
  }

  console.log(data)
});

```



License
---------------

The MIT License (MIT)

Copyright (c) 2016 Terry Moore

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
