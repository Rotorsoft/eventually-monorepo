(async () => {
  const { GIT_USERNAME, GIT_USEREMAIL, GITHUB_TOKEN } = process.env;
  const dryRun = !(GIT_USERNAME && GIT_USEREMAIL);
  if (!GITHUB_TOKEN) throw new Error("Missing GITHUB_TOKEN");

  const remoteOriginUrl = (await $`git config --get remote.origin.url`)
    .toString()
    .trim();
  const [, , host, repo] = remoteOriginUrl
    .replace(":", "/")
    .replace(/\.git/, "")
    .match(/.+(@|\/\/)([^/]+)\/(.+)$/);

  // update user config
  if (!dryRun) {
    await $`git config user.name ${GIT_USERNAME}`;
    await $`git config user.email ${GIT_USEREMAIL}`;
    await $`git remote set-url origin https://${GIT_USERNAME}:${GITHUB_TOKEN}@${host}/${repo}`;
  }

  console.log(JSON.stringify({ repo, dryRun }));
})();
