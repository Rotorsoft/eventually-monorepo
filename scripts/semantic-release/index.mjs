(async () => {
  console.log();
  console.log("SemRel:", chalk.bold.green(argv.p), chalk.grey(argv.d));

  const { dryRun } = JSON.parse(
    (await quiet($`npx zx ${__dirname}/git-config.mjs | tail -n -1`)).toString()
  );

  const { lastTag, changes, nextTag, nextVersion, releaseNotes } = JSON.parse(
    (
      await quiet(
        $`npx zx ${__dirname}/analyze.mjs -p ${argv.p} -d ${argv.d} | tail -n -1`
      )
    ).toString()
  );

  console.log("Tagged:", lastTag);
  if (nextTag) {
    changes.map((change) =>
      console.log(
        chalk.red(change.type.toString().toUpperCase()),
        chalk.grey(change.message)
      )
    );
    console.log("NextTag:", chalk.blue(nextTag), dryRun ? "🧪" : "");
    console.log("NextVer:", chalk.blue(nextVersion), dryRun ? "🧪" : "");
    console.log(chalk.italic.grey(releaseNotes));
  } else {
    console.log(chalk.bold.red("No semantic changes found!"));
  }
})();
