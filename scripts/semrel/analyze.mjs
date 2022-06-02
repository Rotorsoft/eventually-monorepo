const HEADER = "+-+-+";
const SEPARATOR = "-+-+-";
const PRIORITY = ["major", "minor", "patch"];
const SEMANTIC_RULES = [
  {
    type: "patch",
    prefix: ["fix", "perf", "refactor"]
  },
  { type: "minor", prefix: ["feat"] },
  {
    type: "major",
    prefix: ["fix!", "feat!"],
    text: ["BREAKING CHANGE", "BREAKING CHANGES"]
  }
];

$.noquote = async (...args) => {
  const q = $.quote;
  $.quote = (v) => v;
  const p = $(...args);
  await p;
  $.quote = q;
  return p;
};

(async () => {
  const { PACKAGE, DIRECTORY } = process.env;
  if (!PACKAGE) {
    console.log(chalk.bold.red("Missing PACKAGE"));
    process.exit(1);
  }
  if (!DIRECTORY) {
    console.log(chalk.bold.red("Missing DIRECTORY"));
    process.exit(1);
  }

  const TAG_REGEX = new RegExp(`^${PACKAGE}-v(\\d+).(\\d+).(\\d+)$`);
  const bump = (tag, type) => {
    if (!tag) return "0.1.0";
    const [, c1, c2, c3] = TAG_REGEX.exec(tag);
    if (type === "major") return `${-~c1}.0.0`;
    if (type === "minor") return `${c1}.${-~c2}.0`;
    if (type === "patch") return `${c1}.${c2}.${-~c3}`;
  };

  const tags = (await $`git tag -l --sort=-version:refname ${PACKAGE + "-v*"}`)
    .toString()
    .split("\n")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const lastTag = tags.length ? tags[0] : undefined;

  const commitsRange = lastTag
    ? `${(await $`git rev-list -1 ${lastTag}`).toString().trim()}..HEAD`
    : "HEAD";
  const newCommits = (
    await $.noquote`git log --format=${HEADER}%H${SEPARATOR}%s ${commitsRange} -- ${DIRECTORY}`
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

  const nextReleaseType = PRIORITY.find((priority) =>
    changes.find(({ type }) => type === priority)
  );

  const results = { lastTag, changes };

  if (nextReleaseType) {
    const nextVersion = (results.nextVersion = bump(lastTag, nextReleaseType));
    const nextTag = (results.nextTag = `${PACKAGE}-v${nextVersion}`);
    const remoteOriginUrl = (await $`git config --get remote.origin.url`)
      .toString()
      .trim();
    const [, , host, repo] = remoteOriginUrl
      .replace(":", "/")
      .replace(/\.git/, "")
      .match(/.+(@|\/\/)([^/]+)\/(.+)$/);
    const url = `https://${host}/${repo}`;
    results.releaseNotes =
      `## [${nextTag}](${url}/compare/${lastTag}...${nextTag}) (${new Date()
        .toISOString()
        .slice(0, 10)})\n`.concat(
        Object.values(
          changes.reduce((acc, { type, message, sha }) => {
            const { commits } =
              acc[type] || (acc[type] = { type, commits: [] });
            const commitRef = `* [[${sha.substring(
              0,
              8
            )}](${url}/commit/${sha})] ${message}`;
            commits.push(commitRef);
            return acc;
          }, {})
        )
          .map(({ type, commits }) => `### [${type}]\n${commits.join("\n")}`)
          .join("\n")
      );
  }

  console.log("LastTag:", lastTag);
  console.log("NextTag:", results.nextTag || "");
  console.log("NextVer:", results.nextVersion || "");
  console.log(results.releaseNotes || "No semantic changes found!");
})();
