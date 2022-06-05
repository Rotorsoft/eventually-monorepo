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

const REQUIRED_ENV = ["PACKAGE", "DIRECTORY", "GITURL"];

(async () => {
  REQUIRED_ENV.forEach((env) => {
    if (!process.env[env]) {
      console.log(chalk.bold.red(`Missing ${env}`));
      process.exit(1);
    }
  });
  const { PACKAGE, DIRECTORY, GITURL } = process.env;

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
  const lastTag = tags.length && tags[0];

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
    newCommits.reduce((changes, { sha, message }) => {
      RULES.forEach(({ type, prefix, text }, priority) => {
        const byPrefix =
          prefix && new RegExp(`^(${prefix.join("|")})(\\(.*\\))?:\\s.+$`);
        const byText =
          text && new RegExp(`^.*(\\(.*\\))?:.*(${text.join("|")}).*$`);
        (message.match(byPrefix)?.[0] || message.match(byText)?.[2]) &&
          !(changes[sha] && changes[sha].priority > priority) &&
          (changes[sha] = { type, priority, message, sha });
      });
      return changes;
    }, {})
  ).reduce(
    (changes, { type, sha, message, priority }) => {
      changes[type].push({ sha, message });
      changes.max = Math.max(changes.max || 0, priority);
      return changes;
    },
    { major: [], minor: [], patch: [], max: undefined }
  );

  const nextReleaseType = changes.max !== undefined && RULES[changes.max].type;
  const nextVersion =
    (nextReleaseType && bump(lastTag, nextReleaseType)) || "-";
  const nextTag = (nextReleaseType && `${PACKAGE}-v${nextVersion}`) || "-";
  const releaseNotes =
    (nextReleaseType &&
      `## [${new Date()
        .toISOString()
        .slice(0, 10)}](${GITURL}/compare/${lastTag}...${nextTag})\n`.concat(
        Object.keys(changes)
          .filter((key) => changes[key].length)
          .map((key) =>
            `### ${key.toUpperCase()}\n`.concat(
              changes[key]
                .map(
                  ({ sha, message }) =>
                    `* [${sha.slice(0, 8)}](${GITURL}/commit/${sha}) ${message}`
                )
                .join("\n")
            )
          )
          .join("\n")
      )) ||
    "No semantic changes found!";

  console.log(lastTag);
  console.log(nextTag);
  console.log(nextVersion);
  console.log(JSON.stringify(releaseNotes).slice(1, -1));
})();
