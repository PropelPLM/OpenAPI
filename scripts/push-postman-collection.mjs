#!/usr/bin/env node
// Push one folder's requests from the committed collection up to your Postman fork, leaving the
// rest of the fork untouched.
//
//   POSTMAN_API_KEY=<key> node scripts/push-postman-collection.mjs <target> <folderName>
//
// <target> is a key of TARGETS in pull-postman-collection.mjs. <folderName> is matched by exact
// name anywhere in the collection tree (e.g. "MBOM", nested under REST) — not just top-level.
//
//   API key: https://go.postman.co/settings/me/api-keys
//
// Requires Node 18+ for global fetch. No dependencies, no package.json.

import { readFileSync } from 'node:fs';
import { argv, env, exit } from 'node:process';
import { TARGETS } from './pull-postman-collection.mjs';

const [, , targetArg, folderName] = argv;

if (!targetArg || !folderName) {
  console.error('usage: POSTMAN_API_KEY=<key> node scripts/push-postman-collection.mjs <target> <folderName>');
  console.error(`targets: ${Object.keys(TARGETS).join(', ')}`);
  exit(1);
}

const apiKey = env.POSTMAN_API_KEY;
if (!apiKey) {
  console.error('POSTMAN_API_KEY is not set. Create one at https://go.postman.co/settings/me/api-keys');
  exit(1);
}

const target = TARGETS[targetArg];
if (!target) {
  console.error(`Unknown target "${targetArg}". targets: ${Object.keys(TARGETS).join(', ')}`);
  exit(1);
}

const { uid, dest } = target;
if (!uid) {
  console.error(`TARGETS.${targetArg}.uid is empty. Fill it in first (see pull-postman-collection.mjs).`);
  exit(1);
}

// Finds every folder (an item with a nested `item` array) matching `name`, anywhere in the tree.
// Returns {parent, index, path} so a match can be read or replaced in place, and so duplicate
// names can be reported with enough context to tell them apart.
function findFolders(items, name, path = '') {
  const matches = [];
  (items ?? []).forEach((item, index) => {
    const itemPath = `${path}/${item.name}`;
    if (!item.item) return; // not a folder
    if (item.name === name) matches.push({ parent: items, index, path: itemPath });
    matches.push(...findFolders(item.item, name, itemPath));
  });
  return matches;
}

const local = JSON.parse(readFileSync(dest, 'utf8'));

const localMatches = findFolders(local.item, folderName);
if (localMatches.length === 0) {
  console.error(`No folder named "${folderName}" found anywhere in ${dest}`);
  exit(1);
}
if (localMatches.length > 1) {
  console.error(`"${folderName}" is ambiguous in ${dest} — found at:`);
  localMatches.forEach((m) => console.error(`  ${m.path}`));
  exit(1);
}
const localFolder = localMatches[0].parent[localMatches[0].index];

const getResponse = await fetch(`https://api.getpostman.com/collections/${encodeURIComponent(uid)}`, {
  headers: { 'X-Api-Key': apiKey },
});

if (!getResponse.ok) {
  console.error(`Postman API returned ${getResponse.status} ${getResponse.statusText}`);
  console.error(await getResponse.text());
  exit(1);
}

const { collection: remote } = await getResponse.json();

if (!remote?.info?.name) {
  console.error('Unexpected response: no collection.info.name. Nothing pushed.');
  exit(1);
}

const remoteMatches = findFolders(remote.item, folderName);
if (remoteMatches.length > 1) {
  console.error(`"${folderName}" is ambiguous in the fork — found at:`);
  remoteMatches.forEach((m) => console.error(`  ${m.path}`));
  console.error('Rename one of them in Postman first, then retry.');
  exit(1);
}

if (remoteMatches.length === 1) {
  const { parent, index, path } = remoteMatches[0];
  parent[index] = localFolder;
  console.log(`replacing ${path} in the fork`);
} else {
  remote.item = remote.item ?? [];
  remote.item.push(localFolder);
  console.log(`"${folderName}" not found in the fork — adding it as a new top-level folder`);
}

const putResponse = await fetch(`https://api.getpostman.com/collections/${encodeURIComponent(uid)}`, {
  method: 'PUT',
  headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ collection: remote }),
});

if (!putResponse.ok) {
  console.error(`Postman API returned ${putResponse.status} ${putResponse.statusText}`);
  console.error(await putResponse.text());
  exit(1);
}

const countRequests = (items = []) =>
  items.reduce((total, item) => total + (item.item ? countRequests(item.item) : 1), 0);

console.log(`pushed "${folderName}" (${countRequests(localFolder.item)} requests) to ${remote.info.name}`);
