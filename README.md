# Auth0 Bitbucket Deployments

This extension makes it possible to deploy Rules and Database Connection scripts from Bitbucket to Auth0.

## Running

### Local Development

First create a `Client` in your account with `read:connections` and `read/create/update/delete:rules` access to the Auth0 Management API. Then create a `config.json` file under `./server/` containing the following settings:

```json
{
  "EXTENSION_SECRET": "any-random-value-will-do",
  "SLACK_INCOMING_WEBHOOK_URL": "https://hooks.slack.com/services/...",
  "BITBUCKET_BRANCH": "YOUR_BRANCH",
  "BITBUCKET_REPOSITORY": "YOUR_REPO",
  "BITBUCKET_USER": "",
  "BITBUCKET_PASSWORD": "",
  "AUTH0_DOMAIN": "YOUR_DOMAIN",
  "AUTH0_CLIENT_ID": "YOUR_CLIENT_ID",
  "AUTH0_CLIENT_SECRET": "YOUR_CLIENT_SECRET"
}
```

To run the extension locally:

```bash
npm install
npm run serve:dev
```

After that you need to use something like `ngrok` to expose the extension (Auth0 needs to reach out to the extension for authentication):

```bash
./ngrok http 3000
```

Finally you can login to the extension using your Auth0 dashboard account:

```
https://YOU.ngrok.io/login
```

### Deployment

```
npm run build
```
