# null_pointers

## Problem
Node.js projects depend on hundreds of packages, mostly indirect. One vulnerable or abandoned package can compromise everything, and developers rarely check.

## Solution
We parse the lockfile into a dependency graph, enrich each package from OSV.dev and the npm registry, score it with a transparent formula, and show a ranked report.

## Features
- Direct and transitive dependency parsing
- Vulnerabilities, deprecation, last publish, license, install-script and abandoned-package flags
- Risk score per package and project, with a "why this score" breakdown
- Sortable, filterable results table
- Interactive dependency graph with risky nodes highlighted
- Blast radius: who pulls a risky package in
- Best single upgrade, with install command and before/after score%

