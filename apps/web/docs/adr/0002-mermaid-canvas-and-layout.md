# Mermaid canvas and layout boundary

Accepted for the planned first release on 2026-10-22; implementation and prototype validation are pending. The chosen route uses React Flow for the editing canvas, ELK for automatic layout, and Mermaid for the code preview, with manual geometry retained separately from source semantics. This permits interaction-first positioning without claiming that standard Mermaid code or its preview reproduces editor coordinates; automatic layout runs on initial import of supported code and thereafter through an explicit user action, with ordinary edits retaining existing positions where possible.

The complete contract and validation requirements live in [Mermaid editor: canvas technology and layout preservation strategy](https://github.com/pzehrel/web-tools/issues/20). Exact dependency versions, complex group routing, Safari behavior, and performance remain subject to prototype evidence; a failed validation requires reconsidering the route rather than silently reducing the accepted feature scope. The earlier [source and history decision](0001-mermaid-source-and-history.md) remains in force, and the project-file format and export inventory remain separate decisions.

[简体中文](0002-mermaid-canvas-and-layout.zh-CN.md)
