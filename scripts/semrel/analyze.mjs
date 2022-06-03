const HEADER = "+-+-+";
const SEPARATOR = "-+-+-";
const RULES = [
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

$.noquote = async (...args) => {
  const q = $.quote;
  $.quote = (v) => v;
  const p = $(...args);
  await p;
  $.quote = q;
  return p;
};

(async () => {
  const { PACKAGE, DIRECTORY, GIT_HOST, GIT_REPO } = process.env;
  if (!PACKAGE) {
    console.log(chalk.bold.red("Missing PACKAGE"));
    process.exit(1);
  }
  if (!DIRECTORY) {
    console.log(chalk.bold.red("Missing DIRECTORY"));
    process.exit(1);
  }
  if (!GIT_HOST) {
    console.log(chalk.bold.red("Missing GIT_HOST"));
    process.exit(1);
  }
  if (!GIT_REPO) {
    console.log(chalk.bold.red("Missing GIT_REPO"));
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

  const changes = Object.values(
    newCommits.reduce((acc, { sha, message }) => {
      RULES.forEach(({ type, prefix, text }, priority) => {
        const prefixMatcher =
          prefix && new RegExp(`^(${prefix.join("|")})(\\(.*\\))?:\\s.+$`);
        const textMatcher =
          text && new RegExp(`^.*(\\(.*\\))?:.*(${text.join("|")}).*$`);
        (message.match(prefixMatcher)?.[0] ||
          message.match(textMatcher)?.[2]) &&
          !(acc[sha] && acc[sha].priority > priority) &&
          (acc[sha] = { type, priority, message, sha });
      });
      return acc;
    }, {})
  ).reduce(
    (p, { type, sha, message, priority }) => {
      p[type].push({ sha, message });
      p.max = Math.max(p.max || 0, priority);
      return p;
    },
    { major: [], minor: [], patch: [], max: undefined }
  );

  const nextReleaseType = changes.max && RULES[changes.max].type;
  const giturl = `https://${GIT_HOST}/${GIT_REPO}`;
  const nextVersion =
    (nextReleaseType && bump(lastTag, nextReleaseType)) || "-";
  const nextTag = (nextReleaseType && `${PACKAGE}-v${nextVersion}`) || "-";
  const releaseNotes =
    (nextReleaseType &&
      `## [${nextTag}](${giturl}/compare/${lastTag}...${nextTag}) (${new Date()
        .toISOString()
        .slice(0, 10)})\n`.concat(
        Object.keys(changes)
          .filter((key) => key !== "max")
          .map((key) =>
            `### ${key.toUpperCase()}\n`.concat(
              changes[key]
                .map(
                  ({ sha, message }) =>
                    `* [${sha.slice(0, 8)}](${giturl}/commit/${sha}) ${message}`
                )
                .join("\n")
            )
          )
          .join("\n")
      )) ||
    "No semantic changes found!";

  console.log(JSON.stringify({ lastTag, nextTag, nextVersion, releaseNotes }));
})();
