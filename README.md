# CodeImpact — Dependency & Blast Radius Impact Analyzer

> **"If I change this function, what else could break?"**

CodeImpact is an intelligent developer tooling platform that analyzes codebases, constructs a comprehensive Code Knowledge Graph (CKG), and calculates the blast radius of any code modification or function refactoring before deployment.

---

## Key Features

- 🔍 **Multi-Language AST Analysis**: Understands C# (`.cs`), TypeScript/JavaScript (`.ts`, `.tsx`, `.js`), and Python (`.py`).
- ⚡ **Blast Radius & Cascade Scorer**: Quantifies risk (0–100) across upstream callers, controllers, and downstream dependencies.
- 🌐 **API Route & Controller Taint Tracking**: Alerts when internal changes bubble up to external public API endpoints.
- 💾 **Database Mutation Side-Effects**: Tracks mutations to ORM, SQL statements, and state changes.
- 🧪 **Test Gap Detector**: Pinpoints affected high-risk execution paths that have zero unit tests.
- 🚨 **Breaking Signature Change Prediction**: Identifies parameter count mismatches and type discrepancies across call sites.
- 📊 **Interactive Ripple Graph**: High-performance interactive force-directed graph with animated pulse propagation.
- 🛠️ **"What-If" Simulation Sandbox**: Experiment with signature changes in a Monaco editor and diagnose breaking callers live.
- 📋 **GitHub PR Blast Radius Card**: Export automated markdown summaries for pull request discussions.

---

## Tech Stack

- **Backend**: FastAPI (Python 3.12), NetworkX graph engine, Tree-sitter AST parsers.
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, `@xyflow/react`, Monaco Editor, Lucide Icons.

---

## License

Private Repository — All Rights Reserved.
