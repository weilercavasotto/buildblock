// Zips the production build (dist/) into release/BuildBlock-<version>-html.zip, ready to upload to any static host.
// Run through `npm run package:html` (it builds first).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, existsSync, writeFileSync, mkdtempSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));

if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/index.html not found: run `npm run build` first.');
  process.exit(1);
}

const readme = `BuildBlock ${version} (HTML build)

Upload the files of this folder to any static web host (the index.html must be at the root of the site),
or try it locally by serving the folder over HTTP, for example:

  python3 -m http.server 8080

and open http://localhost:8080

Opening index.html straight from the disk (file://) does not work: browsers block ES modules there.
`;

const releaseDir = join(root, 'release');
mkdirSync(releaseDir, { recursive: true });
const zipPath = join(releaseDir, `BuildBlock-${version}-html.zip`);
rmSync(zipPath, { force: true });

// Stage a copy so the README travels in the zip without touching dist/.
const stage = mkdtempSync(join(tmpdir(), 'buildblock-html-'));
try {
  cpSync(dist, stage, { recursive: true });
  writeFileSync(join(stage, 'README.txt'), readme);
  execFileSync('zip', ['-r', '-X', '-q', zipPath, '.'], { cwd: stage, stdio: 'inherit' });
} finally {
  rmSync(stage, { recursive: true, force: true });
}

console.log(`Wrote ${zipPath}`);
