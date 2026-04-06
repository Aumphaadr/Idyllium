// build-web.js

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, 'docs');
if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir);
}

const staticFiles = ['index.html', 'style.css', 'favicon.png'];
for (const file of staticFiles) {
    const src = path.join(__dirname, 'web', file);
    const dest = path.join(docsDir, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`📄 Copied ${file} → docs/`);
    }
}

const packageJson = require('./package.json');
const versionData = { version: packageJson.version };
fs.writeFileSync(
    path.join(docsDir, 'version.json'),
    JSON.stringify(versionData, null, 2)
);
console.log(`📦 Generated version.json with version ${packageJson.version}`);

esbuild.build({
    entryPoints: ['src/web/ide.ts'],
    bundle: true,
    outfile: 'docs/bundle.js',
    format: 'iife',
    globalName: 'IdylliumIDE',
    platform: 'browser',
    target: 'es2020',
    sourcemap: false,
    minify: true,
}).then(() => {
    console.log('✅ docs/bundle.js built successfully');
    console.log('\n📦 Ready for GitHub Pages!');
    console.log('   1. git add docs/');
    console.log('   2. git commit -m "Build for GitHub Pages"');
    console.log('   3. git push');
    console.log('   4. Settings → Pages → Source: "Deploy from branch" → Branch: main, Folder: /docs');
}).catch((err) => {
    console.error('❌ Build failed:', err);
    process.exit(1);
});