# Web Application

Terminology agreed for the planned Mermaid editor. These definitions do not indicate that the editor has shipped; decisions are recorded in [Mermaid editor: first-release diagram and visual-editing support matrix](https://github.com/pzehrel/web-tools/issues/18) and [Mermaid editor: source, graph model, and undo-history synchronization rules](https://github.com/pzehrel/web-tools/issues/19).

## Mermaid Editor

**Architecture diagram**:
In this editor's first-release scope, a system architecture view expressed using Mermaid `flowchart` nodes, groups, and connections. Mermaid's separate `architecture-beta` language is named explicitly when referring to that diagram type.
_Avoid_: Using “architecture diagram” as a synonym for `architecture-beta`.

**Visual editing mode**:
The editor mode in which the whole document belongs to the supported visual-editing subset and can be modified through the canvas.
_Avoid_: Calling a partially editable document fully visually editable.

**Code-and-preview mode**:
The editor mode in which source code remains editable and a diagram preview is available, while canvas modifications are disabled.
_Avoid_: Read-only mode, because source editing remains available.

**Imported original**:
The source text retained from the document's import, distinct from its subsequent edits. A newly created diagram has no imported original.
_Avoid_: Using “original” for the current edited code.

**Current code**:
The source text currently being edited in the document, including incomplete or invalid input.
_Avoid_: Valid code, because validity is a separate property.

**Last valid preview**:
The diagram preview associated with a source version that rendered successfully, which can remain visible when newer input cannot render.
_Avoid_: Calling it the current preview when it belongs to an older source version.

**Editing canvas**:
The interactive diagram view whose positions reflect the document's retained manual layout.
_Avoid_: Using it as a synonym for the Mermaid-rendered preview.

**Mermaid preview**:
The diagram view produced by Mermaid from the current code when rendering succeeds; its geometry can differ from the editing canvas.
_Avoid_: Assuming it reproduces the manual canvas layout.

**Canvas layout**:
The editor's geometry for diagram objects, separate from graph structure, styling, and viewing position or zoom.
_Avoid_: Treating manual coordinates as standard Mermaid source semantics.

[简体中文](GLOSSARY.zh-CN.md)
