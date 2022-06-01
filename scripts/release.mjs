const PRIORITY = ["major", "minor", "patch"];
const SEMANTIC_RULES = [
  {
    type: "patch",
    prefix: ["fix", "perf", "refactor"]
  },
  { type: "minor", prefix: ["feat"] },
  {
    type: "major",
    text: ["BREAKING CHANGE", "BREAKING CHANGES"]
  }
];

(async () => {
  const workspace = process.argv[process.argv.length - 1];
  if (!workspace || !workspace.startsWith("eventually"))
    throw Error("Invalid arguments. Expecting workspace name!");
  const TAG_REGEX = new RegExp(
    `^@rotorsoft/${workspace}-v(\\d+)\.(\\d+)\.(\\d+)$`
  );

  $.verbose = (process.env.VERBOSE || "true") === "true";
  $.noquote = async (...args) => {
    const q = $.quote;
    $.quote = (v) => v;
    const p = $(...args);
    await p;
    $.quote = q;
    return p;
  };

  const config = async () => {
    const { GIT_USERNAME, GIT_USEREMAIL, GITHUB_TOKEN } = process.env;
    const dryRun = !(GIT_USERNAME && GIT_USEREMAIL);
    if (!GITHUB_TOKEN) throw new Error("Missing GITHUB_TOKEN");

    const gitAuth = `${GIT_USERNAME}:${GITHUB_TOKEN}`;
    const gitOriginUrl = (await $`git config --get remote.origin.url`)
      .toString()
      .trim();
    const [, , host, gitRepoName] = gitOriginUrl
      .replace(":", "/")
      .replace(/\.git/, "")
      .match(/.+(@|\/\/)([^/]+)\/(.+)$/);

    const gitUrl = `https://${host}/${gitRepoName}`;
    const gitAuthUrl = `https://${gitAuth}@${host}/${gitRepoName}`;

    // update CI user config
    if (!dryRun) {
      await $`git config user.name ${GIT_USERNAME}`;
      await $`git config user.email ${GIT_USEREMAIL}`;
      await $`git remote set-url origin ${gitAuthUrl}`;
    }

    return { gitRepoName, GITHUB_TOKEN, gitUrl, dryRun };
  };

  const analyze = async () => {
    const HEADER = "+-+-+";
    const SEPARATOR = "-+-+-";
    const tags = (
      await $`git tag -l --sort=-version:refname '@rotorsoft/${workspace}-v*'`
    )
      .toString()
      .split("\n")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const lastTag = tags.length ? tags[0] : undefined;
    const commitsRange = lastTag
      ? `${(await $`git rev-list -1 ${lastTag}`).toString().trim()}..HEAD`
      : "HEAD";
    const newCommits = (
      await $.noquote`git log --format=${HEADER}%H${SEPARATOR}%s ${commitsRange} -- libs/${workspace}`
    )
      .toString()
      .split(HEADER)
      .filter(Boolean)
      .map((commit) => {
        const [sha, message] = commit.split(SEPARATOR).map((raw) => raw.trim());
        return { sha, message };
      });
    const changes = newCommits.reduce((acc, { sha, message }) => {
      SEMANTIC_RULES.forEach(({ type, prefix, text }) => {
        const prefixMatcher =
          prefix && new RegExp(`^(${prefix.join("|")})(\\(.*\\))?:\\s.+$`);
        const textMatcher = text && new RegExp(`(${text.join("|")}):\\s(.+)`);
        const change =
          message.match(prefixMatcher)?.[0] || message.match(textMatcher)?.[2];
        change && acc.push({ type, message, sha });
      });
      return acc;
    }, []);

    return { tags, newCommits, changes, lastTag };
  };

  const bump = (tag, type) => {
    if (!tag) return "0.1.0";
    const [, c1, c2, c3] = TAG_REGEX.exec(tag);
    if (type === "major") return `${-~c1}.0.0`;
    if (type === "minor") return `${c1}.${-~c2}.0`;
    if (type === "patch") return `${c1}.${c2}.${-~c3}`;
  };

  const prepare = async (gitUrl, changes, lastTag) => {
    const nextReleaseType = PRIORITY.find((priority) =>
      changes.find(({ type }) => type === priority)
    );
    if (!nextReleaseType) return {};

    const nextVersion = bump(lastTag, nextReleaseType);
    const nextTag = `@rotorsoft/${workspace}-v${nextVersion}`;
    const releaseDiffRef = `## [${nextTag}](${gitUrl}/compare/${lastTag}...${nextTag}) (${new Date()
      .toISOString()
      .slice(0, 10)})`;
    const releaseDetails = Object.values(
      changes.reduce((acc, { type, message, sha }) => {
        const { commits } = acc[type] || (acc[type] = { commits: [], type });
        const commitRef = `* ${message} ([${sha.substr(
          0,
          8
        )}](${gitUrl}/commit/${sha}))`;
        commits.push(commitRef);
        return acc;
      }, {})
    )
      .map(
        ({ type, commits }) => `
    ### ${type}
    ${commits.join("\n")}`
      )
      .join("\n");
    const releaseNotes = releaseDiffRef + "\n" + releaseDetails + "\n";

    return { nextVersion, nextTag, releaseNotes };
  };

  const gitCommitAndTag = async (nextVersion, nextTag, releaseNotes) => {
    await $`echo ${releaseNotes}"\n$(cat ./CHANGELOG.md)" > ./CHANGELOG.md`;
    await $`npm --no-git-tag-version version ${nextVersion}`;
    const releaseMessage = `chore(release): ${nextVersion} [skip ci]`;
    await $`git add -A .`;
    await $`git commit -am ${releaseMessage}`;
    await $`git tag -a ${nextTag} HEAD -m ${releaseMessage}`;
    await $`git push --follow-tags origin HEAD:refs/heads/master`;
  };

  const githubRelease = async (
    GIT_USERNAME,
    GITHUB_TOKEN,
    repoName,
    nextTag,
    releaseNotes
  ) => {
    const releaseData = JSON.stringify({
      name: nextTag,
      tag_name: nextTag,
      body: releaseNotes
    });
    await $`curl -u ${GIT_USERNAME}:${GITHUB_TOKEN} -H "Accept: application/vnd.github.v3+json" https://api.github.com/repos/${repoName}/releases -d ${releaseData}`;
  };

  const npmPublish = async () => {
    await $`npm config set registry https://registry.npmjs.org`;
    await $`yarn libs/${workspace} npm publish --no-git-tag-version --access public`;
    //await $`npm config set registry https://npm.pkg.github.com`
    //await $`yarn libs/${workspace} npm publish --no-git-tag-version`
  };

  console.log();
  console.log("Sem-Rel:", chalk.green(workspace));
  const { GIT_USERNAME, GITHUB_TOKEN, gitRepoName, gitUrl, dryRun } =
    await config();
  const { changes, lastTag } = await analyze();
  console.log("LastTag:", chalk.blue(lastTag));
  const { nextVersion, nextTag, releaseNotes } = await prepare(
    gitUrl,
    changes,
    lastTag
  );
  changes.length
    ? changes.map((c) =>
        console.log(
          chalk.red(c.type.toString().toUpperCase()),
          chalk.grey(c.message)
        )
      )
    : console.log(chalk.red("No semantic changes found!"));
  nextTag && console.log("NextTag:", chalk.bgBlue(nextTag), dryRun ? "🧪" : "");

  if (!dryRun && nextVersion) {
    await gitCommitAndTag(nextVersion, nextTag, releaseNotes);
    await githubRelease(
      GIT_USERNAME,
      GITHUB_TOKEN,
      gitRepoName,
      nextTag,
      releaseNotes
    );
    await npmPublish();
    console.log("🚀", chalk.blue("Released!!!"));
  }
})();
