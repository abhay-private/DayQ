import process from 'node:process';

const implementations = {
  dev: 'M0-T06 (local stack), M1-T01 (API), M6-T01 (worker), M8-T02 (web)',
  'test:int':
    'M0-T06 (local services), M1-T03 (database), M1-T09 (tenant test harness)',
  'test:e2e': 'M8-T02',
  'openapi:generate': 'M1-T06',
  migrate: 'M1-T03',
};

const [command] = process.argv.slice(2);

if (command === undefined || !Object.hasOwn(implementations, command)) {
  process.stderr.write(
    'Usage: roadmap-placeholder.mjs <dev|test:int|test:e2e|openapi:generate|migrate>\n',
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Placeholder: pnpm ${command} will be implemented by ${implementations[command]}.\n`,
  );
}
