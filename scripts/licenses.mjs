import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
const rows=[];let failed=false;
for(const [key,value] of Object.entries(lock.packages)) {
 if(!key)continue;
 const name=key.split('node_modules/').at(-1);
 const folder=path.resolve(key), manifest=path.join(folder,'package.json');
 const pkg=fs.existsSync(manifest)?JSON.parse(fs.readFileSync(manifest,'utf8')):null;
 const license=pkg?.license??value.license??'UNKNOWN';
 const reviewedBuildOnlyMpl = /^lightningcss(?:-|$)/.test(name) && license==='MPL-2.0';
 if(!reviewedBuildOnlyMpl && !/^(MIT|Apache-2.0|BSD-2-Clause|BSD-3-Clause|ISC|0BSD|CC0-1.0|BlueOak-1.0.0|\(MIT OR CC0-1.0\)|\(MIT AND Zlib\)|Python-2.0|\(WTFPL OR MIT\))$/.test(license)){failed=true;console.error('Unreviewed development license:',name,license);}
 const notices=pkg?fs.readdirSync(folder).filter(n=>/^(license|copying|notice)/i.test(n)&&fs.statSync(path.join(folder,n)).isFile()).map(n=>({file:n,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(folder,n))).digest('hex')})):[];
 const repository=typeof pkg?.repository==='string'?pkg.repository:pkg?.repository?.url;
 rows.push({name,version:value.version,license,repository:repository??null,packageArtifact:value.resolved,integrity:value.integrity,installed:!!pkg,notices});
}
const output={scope:'Development packages; no production npm dependencies. Optional platform packages not installed use lockfile metadata; redistribution still requires their actual notices.',packages:rows};
fs.writeFileSync('docs/legal/development-dependencies.json',JSON.stringify(output,null,2)+'\n');
let md='# Development dependency inventory\n\nExact package versions and registry integrity hashes are in development-dependencies.json and package-lock.json. Installed license/NOTICE files were inventoried by SHA-256. No development package assets are selected for the UI. No names/logos are licensed by implication. These are package artifact pins, not a claim to have inspected a Git commit for every transitive package. Optional non-host binaries are lockfile-only and not approved for redistribution.\n\nAll listed permissive code licenses permit modification, browser/WASM and commercial redistribution subject to their notices. Apache-2.0 adds express patent/change/NOTICE conditions; MIT/BSD/ISC/0BSD do not supply an equivalent express patent grant. Full license obligations remain applicable. Exception: Lightning CSS is reviewed build-only MPL-2.0, a file-level copyleft license with patent provisions. No Lightning CSS code/binary is redistributed in the application. Redistribution of that tool requires its covered source/notices; see BUILD_TOOL_LICENSE_REVIEW.md.\n\n| Package / exact version | License | Source repository or exact package artifact | License/NOTICE evidence |\n| --- | --- | --- | --- |\n';
for(const r of rows)md+=`| ${r.name}@${r.version} | ${r.license} | ${r.repository??r.packageArtifact} | ${r.installed?r.notices.map(n=>n.file).join(', ')||'Package metadata only; verify before redistribution':'Optional artifact not installed'} |\n`;
fs.writeFileSync('docs/legal/DEVELOPMENT_DEPENDENCIES.md',md);
console.log(`${rows.length} locked development packages inventoried; ${rows.filter(r=>r.installed).length} installed. ${failed?'Review required.':'License allowlist passed.'}`);
if(failed)process.exitCode=1;
