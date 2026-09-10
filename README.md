# Propel OpenAPI 3.0 Specification

This repository contains the [OpenAPI Specifications][openapi] for Propel APIs as well as the Postman Collection containing the APIs.

[openapi]: https://www.openapis.org/

## Layout

| Path | Contents |
|---|---|
| `openapi/collections/` | The main **Propel APIs** Postman collection — every feature is a folder inside it, including **MBOM** |
| `openapi/pim/` | PIM Postman collection |
| `openapi/mbom/` | MBOM (Manufacturing BOM) spec — OpenAPI 3.1, whole-document. Spec only; its requests live in the main collection |
| `openapi/schemas/` | Per-endpoint schema fragments, each committed as both `.yml`/`.yaml` and `.json` |

Specs are committed in **both YAML and JSON**. The YAML is the file to edit; regenerate its twin
with `npx --yes js-yaml <file>.yaml > <file>.json`. Prose-heavy `description` blocks collapse to
single escaped lines in JSON, so review changes against the YAML.

## Syncing a Postman collection

Two scripts move a collection between Postman and this repo. Both read the same `TARGETS` map
in [`scripts/pull-postman-collection.mjs`](scripts/pull-postman-collection.mjs) — fill in a
target's `uid` once (the uid of your **fork**, not the upstream collection) and both scripts can
use it.

### Pulling: bring Postman edits down into the repo

Use this after editing requests in Postman, to bring those edits into the repo for review.

```bash
POSTMAN_API_KEY=<key> node scripts/pull-postman-collection.mjs <target>
```

It fetches the whole collection and overwrites the target's destination file. Review the diff
and commit it — that diff *is* the change, there's no other record of what moved.

Expect the first pull of an existing collection to produce a large diff, as the API's
serialisation replaces whatever the original hand export produced. Subsequent pulls are stable.

### Pushing: send local edits up to your Postman fork

Use this after editing a feature's requests directly in this repo's collection file (for
example, when a request changes alongside an OpenAPI spec update), so you can try the request
live in Postman without re-typing it.

```bash
POSTMAN_API_KEY=<key> node scripts/push-postman-collection.mjs <target> <folderName>
# e.g.:
POSTMAN_API_KEY=<key> node scripts/push-postman-collection.mjs propel MBOM
```

It only touches the named folder: it fetches your live fork, replaces just that one folder with
the local version, and sends the merged collection back. Other folders in your fork — including
any edits you haven't pulled down yet — are left alone.

Pulling and pushing are both one-way. Neither script merges automatically — whichever side you
run last for a given folder wins, so pull before you push if you're not sure which side is
ahead.
