# Mermaid current code and document history

Accepted for the planned first release on 2026-10-22; implementation is pending. The Mermaid editor treats current code, including invalid drafts, as the authoritative source text, retains the imported original separately, and derives graph and preview state from validated versions. It uses one document history for code and canvas edits and permits canvas edits to normalize source formatting while preserving diagram meaning and all ordinary comments; this trades exact edited-text formatting for interaction-first authoring with a recoverable original, rather than maintaining independently editable source and graph histories.

The complete contract, user confirmations, and remaining validation questions live in [Mermaid editor: source, graph model, and undo-history synchronization rules](https://github.com/pzehrel/web-tools/issues/19). This record does not choose a parser, canvas engine, serialization format, or persistence policy.

[简体中文](0001-mermaid-source-and-history.zh-CN.md)
