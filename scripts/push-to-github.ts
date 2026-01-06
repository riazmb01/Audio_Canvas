import { Octokit } from '@octokit/rest';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

async function main() {
  const repoName = process.argv[2] || 'audio-visualizer';
  const isPrivate = process.argv[3] === 'private';
  
  console.log(`Creating ${isPrivate ? 'private' : 'public'} repository: ${repoName}`);
  
  const octokit = await getUncachableGitHubClient();
  
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`Authenticated as: ${user.login}`);
  
  let repoExists = false;
  try {
    await octokit.repos.get({ owner: user.login, repo: repoName });
    repoExists = true;
    console.log(`Repository ${repoName} already exists`);
  } catch (e: any) {
    if (e.status !== 404) throw e;
  }
  
  if (!repoExists) {
    await octokit.repos.createForAuthenticatedUser({
      name: repoName,
      private: isPrivate,
      description: 'Real-time audio visualizer with plugin-based architecture',
      auto_init: false,
    });
    console.log(`Created repository: ${repoName}`);
  }
  
  const remoteUrl = `https://github.com/${user.login}/${repoName}.git`;
  console.log(`\nRepository URL: ${remoteUrl}`);
  console.log(`\nTo push your code, run these commands:`);
  console.log(`  git remote add origin ${remoteUrl}`);
  console.log(`  git push -u origin main`);
  console.log(`\nOr if origin already exists:`);
  console.log(`  git remote set-url origin ${remoteUrl}`);
  console.log(`  git push -u origin main`);
}

main().catch(console.error);
