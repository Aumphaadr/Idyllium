#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const extensionDir = path.join(rootDir, 'packages', 'vscode-idyllium');
const manifestPath = path.join(extensionDir, 'package.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const artifactName = `${manifest.name}-${manifest.version}.vsix`;
const artifactPath = path.join(extensionDir, artifactName);
const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idyllium-vsix-'));
const stagedExtensionDir = path.join(stagingDir, 'extension');

try {
  stageExtension();
  writePackageFiles();
  fs.rmSync(artifactPath, { force: true });
  childProcess.execFileSync('zip', ['-qr', artifactPath, '[Content_Types].xml', 'extension.vsixmanifest', 'extension'], {
    cwd: stagingDir,
    stdio: 'inherit',
  });
  console.log(`VSIX created at ${artifactPath}`);
} finally {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}

function stageExtension() {
  fs.mkdirSync(stagedExtensionDir, { recursive: true });
  for (const item of [
    'package.json',
    'README.md',
    'extension.js',
    'language-configuration.json',
    'gui-renderer',
    'media',
    'syntaxes',
    'themes',
    'server',
  ]) {
    const source = path.join(extensionDir, item);
    if (!fs.existsSync(source)) {
      console.error(`Required extension file was not found: ${source}`);
      process.exit(1);
    }
    fs.cpSync(source, path.join(stagedExtensionDir, item), { recursive: true });
  }
}

function writePackageFiles() {
  fs.writeFileSync(path.join(stagingDir, '[Content_Types].xml'), contentTypesXml());
  fs.writeFileSync(path.join(stagingDir, 'extension.vsixmanifest'), vsixManifestXml());
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="css" ContentType="text/css"/>
  <Default Extension="json" ContentType="application/json"/>
  <Default Extension="js" ContentType="application/javascript"/>
  <Default Extension="map" ContentType="application/json"/>
  <Default Extension="md" ContentType="text/markdown"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="svg" ContentType="image/svg+xml"/>
  <Default Extension="ts" ContentType="text/plain"/>
  <Default Extension="txt" ContentType="text/plain"/>
  <Default Extension="wasm" ContentType="application/wasm"/>
  <Default Extension="xml" ContentType="text/xml"/>
  <Default Extension="vsixmanifest" ContentType="text/xml"/>
</Types>
`;
}

function vsixManifestXml() {
  const categories = Array.isArray(manifest.categories) ? manifest.categories.join(',') : '';
  const engines = manifest.engines && manifest.engines.vscode ? manifest.engines.vscode : '*';
  return `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Language="en-US" Id="${xml(manifest.name)}" Version="${xml(manifest.version)}" Publisher="${xml(manifest.publisher)}"/>
    <DisplayName>${xml(manifest.displayName || manifest.name)}</DisplayName>
    <Description xml:space="preserve">${xml(manifest.description || '')}</Description>
    <Icon>extension/${xml(manifest.icon || '')}</Icon>
    <Tags>${xml(manifest.keywords ? manifest.keywords.join(',') : 'idyllium')}</Tags>
    <Categories>${xml(categories)}</Categories>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="${xml(engines)}"/>
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true"/>
  </Assets>
</PackageManifest>
`;
}

function xml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
