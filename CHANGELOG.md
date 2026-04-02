# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]

## [0.2.3] - 2026-04-02

### Added

- Added manual performance tooling under `perf/` for throughput, memory retention, and soak testing.
- Added a live in-place ASCII progress bar for the soak test and made the default soak duration 5 minutes.

### Changed

- Added dedicated `pnpm perf`, `pnpm perf:memory`, and `pnpm perf:soak` scripts with automatic pre-build steps so benchmarks always run against the latest `dist/` output.

### Fixed

- Cleared request timeout timers on both success and failure paths to avoid leaving timers pending during rejected or timed out requests.

## [0.2.2] - 2026-04-02

### Changed

- Split the internal `Result` implementation into focused modules while preserving the public API.
- Split the HTTP client internals into smaller request, JSON, and response helpers to keep entrypoints thin and easier to maintain.

## [0.2.1] - 2026-04-02

### Added

- Added `CHANGELOG.md`.
- Added the MIT `LICENSE` file.

## [0.2.0] - 2026-04-02

### Changed

- Redesigned `Result` from a raw tuple type into an object-based API with `.ok`, `.value`, `.error`, and result methods.
- Preserved simple `[data, err]` destructuring for the HTTP client through tuple-compatible result objects.
- Simplified the public transformation API around `Result.map(...)` and `chainResult(...)`.

### Added

- Added async-aware `chainResult(...)` with `toTuple()`, `toValue()`, `toValueOr(...)`, and `toValueOrThrow()` helpers.
- Restructured the README to lead with the simple HTTP client flow and schema validation.