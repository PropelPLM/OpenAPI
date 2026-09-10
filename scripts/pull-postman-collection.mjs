#!/usr/bin/env node
// Pull a Postman collection from the Postman API and overwrite the committed copy.
//
//   POSTMAN_API_KEY=<key> node scripts/pull-postman-collection.mjs <target|uid> [dest]
//
// <target> is a key of TARGETS below, or a raw collection uid to fetch ad hoc.
//
//   API key:        https://go.postman.co/settings/me/api-keys
//   Collection uid: GET https://api.getpostman.com/collections  (with the same X-Api-Key header)
//
// Requires Node 18+ for global fetch. No dependencies, no package.json.

import { writeFileSync } from 'node:fs';
import { argv, env, exit } from 'node:process';

// indent is per-target on purpose: each committed collection was first exported by a different
// hand, and re-serialising with the wrong one rewrites all ~4k lines as a single noise diff.
// Tab is what Postman's own UI export emits.
export const TARGETS = {
  // Use the uid of the FORK of Propel APIs, not the upstream collection's. Feature folders (MBOM,
  // and anything after it) are added in the fork, so pulling the parent would erase them here.
  propel: {
    uid: '46943044-f2d0b231-0ce9-4794-9296-3b01b4694111',
    dest: 'openapi/collections/Propel APIs.postman_collection.json',
    indent: '\t',
  },
  pim: {
    uid: '',
    dest: 'openapi/pim/PIM APIs.postman_collection.json',
    indent: '  ',
  },
};

const [, , targetArg, destArg] = argv;

if (!targetArg) {
  console.error('usage: POSTMAN_API_KEY=<key> node scripts/pull-postman-collection.mjs <target|uid> [dest]');
  console.error(`targets: ${Object.keys(TARGETS).join(', ')}`);
  exit(1);
}

const apiKey = env.POSTMAN_API_KEY;
if (!apiKey) {
  console.error('POSTMAN_API_KEY is not set. Create one at https://go.postman.co/settings/me/api-keys');
  exit(1);
}

const target = TARGETS[targetArg];
const uid = target ? target.uid : targetArg;
const dest = destArg ?? target?.dest;
const indent = target?.indent ?? '\t';

if (!uid) {
  console.error(`TARGETS.${targetArg}.uid is empty. Fill it in, or pass the uid directly.`);
  exit(1);
}
if (!dest) {
  console.error('No destination path. Pass one as the second argument.');
  exit(1);
}

const response = await fetch(`https://api.getpostman.com/collections/${encodeURIComponent(uid)}`, {
  headers: { 'X-Api-Key': apiKey },
});

if (!response.ok) {
  console.error(`Postman API returned ${response.status} ${response.statusText}`);
  console.error(await response.text());
  exit(1);
}

const { collection } = await response.json();

// Bail rather than truncate the committed file if the response is not the shape we expect.
if (!collection?.info?.name) {
  console.error('Unexpected response: no collection.info.name. Nothing written.');
  exit(1);
}

const countRequests = (items = []) =>
  items.reduce((total, item) => total + (item.item ? countRequests(item.item) : 1), 0);

writeFileSync(dest, `${JSON.stringify(collection, null, indent)}\n`);

console.log(`${collection.info.name} — ${countRequests(collection.item)} requests`);
console.log(`wrote ${dest}`);
console.log('Review the diff before committing: git diff -- "%s"'.replace('%s', dest));
