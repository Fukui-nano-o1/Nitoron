# Design references

Checked 2026-09-11: Cadasio official feature page, https://www.cadasio.com/features and company background, https://www.cadasio.com/about .

The public feature description explains importing an assembly's hierarchy and metadata, creating interactive steps, and reflecting model changes without recreating presentation work. Nitoron adopts that separation: assembly identity, geometry revisions and presentation data are different records. The implementation is independently written against the existing MIT-licensed Three.js prototype. It neither copies Cadasio code/assets nor claims parity with its CAD import/update pipeline.

This first change implements replaceable per-part geometry and persistent-in-session viewing state. Better source geometry, CAD import, product recognition and real-world dimensional evidence remain separate future work. No commercial tool was purchased or called.
