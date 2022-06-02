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

const USE = `Use: zx <script>.mjs -p package -d directory
    (i.e. zx <script>.mjs -p @rotorsoft/eventually -d libs/eventually)
`;

(async () => {
  const pkg = argv.p;
  if (!pkg) {
    console.log(chalk.bold.red("Missing package"));
    console.log(chalk.gray(USE));
    process.exit(1);
  }
  const dir = argv.d;
  if (!dir) {
    console.log(chalk.bold.red("Missing directory"));
    console.log(chalk.gray(USE));
    process.exit(1);
  }

  const TAG_REGEX = new RegExp(`^${pkg}-v(\\d+).(\\d+).(\\d+)$`);
  const bump = (tag, type) => {
    if (!tag) return "0.1.0";
    const [, c1, c2, c3] = TAG_REGEX.exec(tag);
    if (type === "major") return `${-~c1}.0.0`;
    if (type === "minor") return `${c1}.${-~c2}.0`;
    if (type === "patch") return `${c1}.${c2}.${-~c3}`;
  };

  const tags = (await $`git tag -l --sort=-version:refname ${pkg + "-v*"}`)
    .toString()
    .split("\n")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const lastTag = tags.length ? tags[0] : undefined;

  const commitsRange = lastTag
    ? `${(await $`git rev-list -1 ${lastTag}`).toString().trim()}..HEAD`
    : "HEAD";
  const newCommits = (
    await $.noquote`git log --format=${HEADER}%H${SEPARATOR}%s ${commitsRange} -- ${dir}`
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
    const nextTag = (results.nextTag = `${pkg}-v${nextVersion}`);
    const remoteOriginUrl = (await $`git config --get remote.origin.url`)
      .toString()
      .trim();
    const [, , host, repo] = remoteOriginUrl
      .replace(":", "/")
      .replace(/\.git/, "")
      .match(/.+(@|\/\/)([^/]+)\/(.+)$/);

    results.releaseNotes =
      `## [${nextTag}](https://${host}/${repo}/compare/${lastTag}...${nextTag}) (${new Date()
        .toISOString()
        .slice(0, 10)})`.concat(
        Object.values(
          changes.reduce((acc, { type, message, sha }) => {
            const { commits } =
              acc[type] || (acc[type] = { type, commits: [] });
            const commitRef = `* [[${sha.substring(
              0,
              8
            )}](${gitUrl}/commit/${sha})] ${message}`;
            commits.push(commitRef);
            return acc;
          }, {})
        )
          .map(
            ({ type, commits }) => `\n\n### [${type}]\n${commits.join("\n")}`
          )
          .join("\n\n")
      );
  }

  console.log(JSON.stringify(results));
})();
