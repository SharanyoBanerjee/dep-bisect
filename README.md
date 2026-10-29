# dep-bisect

Find which dependency update broke your build. Bisects lockfile changes, even when two updates only fail together.

## Install

```bash
npm install -g dep-bisect
# or
npx dep-bisect --help
```

## Quick Start

```bash
# Bisect between two lockfiles
dep-bisect bisect --good package-lock.good.json --bad package-lock.json --test "npm test"

# Bisect between git refs (uses lockfile at that ref)
dep-bisect bisect --good HEAD~5 --bad HEAD --test "npm test"

# Output JSON for CI integration
dep-bisect bisect --good package-lock.good.json --bad package-lock.json --test "npm test" --json
```

## Example Output

```
42 packages changed, grouped into 9 units

baseline  good passes 3/3   bad fails 3/3

trial  units        result      time
  1    1-5          pass        38s
  2    6-9          FAIL        41s
  3    6-7          pass        (cache)
  4    8-9          FAIL        40s
  5    8            FAIL        39s

Culprit
  postcss  8.4.31 -> 8.5.2        via autoprefixer 10.4.16 -> 10.4.21
  first bad version   8.5.0       (7 candidates, 3 trials, assumes breakage is monotonic)
  failing test        test/css.test.js  "minifies custom properties"
  flags               published 2 days ago, new maintainer on 8.5.0
  confirmed by install: yes

5 trials, 4m12s, 1 cache hit
```

## Commands

### `bisect` - Find the breaking change

```bash
dep-bisect bisect --good <lockfile|git-ref> --bad <lockfile|git-ref> --test <command>
```

Options:
- `--good <path>` - Good lockfile or git ref (required)
- `--bad <path>` - Bad lockfile or git ref (required)
- `--test <command>` - Test command to run (required)
- `--runs <number>` - Baseline runs per side (default: 3)
- `--json` - Output JSON report

### `diff` - Show grouped differences

```bash
dep-bisect diff <good-lockfile> <bad-lockfile>
```

Shows what changed between two lockfiles, grouped by the direct dependency that pulled them in.

## How It Works

1. **Load** two dependency states from lockfiles or git refs
2. **Diff** the dependency graphs into a list of changes
3. **Group** changes by the direct dependency that dragged them in (400 packages → ~12 units)
4. **Verify baseline** - good passes N times, bad fails N times
5. **Search** with delta debugging (ddmin) over units
6. **Refine** - drill from culprit unit to package to first bad version
7. **Confirm** with a real install
8. **Report** in terminal, JSON, or Markdown

## Key Features

- **Interaction detection** - Finds cases where A and B only fail together
- **Trial caching** - Repeated runs skip known results
- **Honest inconclusive** - Reports uncertainty instead of guessing
- **Works offline** - Once tarballs are cached, no network needed
- **Safe by default** - `--ignore-scripts`, temp directories, timeouts

## CI Integration

```yaml
# GitHub Actions example
- name: Bisect failing dependency PR
  if: failure()
  run: |
    npx dep-bisect bisect \
      --good ${{ github.event.before }} \
      --bad ${{ github.sha }} \
      --test "npm test" \
      --json > report.json
```

## Requirements

- Node.js 20+
- npm (lockfile v3)

## License

MIT