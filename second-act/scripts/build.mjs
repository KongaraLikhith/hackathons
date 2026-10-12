import {readFile,writeFile,mkdir,rm,cp} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
await mkdir('work',{recursive:true});
// The downloadable source omits the hosted Site identity, generated assets,
// credentials and dependencies. It contains the complete rebuildable app.
execFileSync('python',['scripts/package-source.py']);
const zip=await readFile('work/second-act-source.zip');
await writeFile('work/source-base64.txt',zip.toString('base64'));
await rm('dist',{recursive:true,force:true});
await mkdir('dist/server',{recursive:true});
await mkdir('dist/.openai',{recursive:true});
await build({entryPoints:['src/worker.mjs'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',loader:{'.html':'text','.css':'text','.txt':'text','.md':'text'},plugins:[{name:'raw-javascript',setup(b){b.onResolve({filter:/\?raw$/},args=>({path:fileURLToPath(new URL(args.path.replace(/\?raw$/,''),'file://'+args.resolveDir+'/')),namespace:'raw'}));b.onLoad({filter:/.*/,namespace:'raw'},async args=>({contents:await readFile(args.path,'utf8'),loader:'text'}));}}]});
await cp('.openai/hosting.json','dist/.openai/hosting.json');
const artifact=await readFile('dist/server/index.js','utf8');
if(!artifact.includes('export') || !artifact.includes('Second Act'))throw new Error('Worker artifact validation failed.');
console.log('Built and validated dist/server/index.js');
