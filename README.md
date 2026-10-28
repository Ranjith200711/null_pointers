<div align="center">

# 🛡️ NULL_POINTERS
### Intelligent Node.js Dependency Risk Analyzer & Graph-Aware RAG Copilot

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933.svg?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-5-000000.svg?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-F59E0B.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

<br/>

**Transform opaque lockfiles into interactive dependency graphs, compute cascading blast radiuses, and query an embedded Graph-RAG AI Copilot for single-command remediation.**

[Key Features](#-key-features) • [RAG Copilot Deep Dive](#-graph-rag-ai-copilot-deep-dive) • [Architecture](#-system-architecture) • [Quickstart](#-quickstart) • [API Docs](#-api-reference) • [Test Suite](#-automated-testing--resilience)

---

</div>

## 📌 The Problem We Solve

In modern JavaScript and TypeScript development, **over 80% of an application's dependencies are transitive**—meaning they were pulled in indirectly by other libraries. 

Traditional tools like `npm audit` suffer from critical limitations:
- ❌ **Audit Fatigue**: Flattens nested dependencies into endless lists of disconnected CVEs.
- ❌ **No Impact Context**: Doesn't tell you *who* pulled the package in or how deep the exposure reaches.
- ❌ **Risky Automatic Fixes**: `npm audit fix` frequently introduces breaking semver changes without explaining which isolated upgrade removes the most cumulative risk.
- ❌ **Supply Chain Blindspots**: Fails to flag automated lifecycle install scripts (`preinstall`, `postinstall`), unmaintained/abandoned packages, or restrictive licenses.

---

## 💡 The Solution

**Null Pointers** delivers full-spectrum visibility into your dependency tree:
1. **Deterministic Parser**: Ingests `package-lock.json` (v2/v3) and `package.json` manifests across local files, project directories, and public GitHub repositories.
2. **Directed Graph Visualizer**: Renders an interactive 2D Force Graph with risk-based node scaling, color coding, and blast-path highlights.
3. **Blast Radius Impact Engine**: Calculates the cascading ripple effect of every package using Breadth-First Search (BFS) over the reverse dependency graph.
4. **Exclusivity-Based Upgrade Solver**: Identifies the single direct package whose upgrade removes the highest cumulative risk score across its exclusive subtree.
5. **Graph-Aware RAG Copilot**: An integrated AI security copilot that queries the in-memory graph to answer complex dependency questions with zero hallucinations.

---

## 🤖 Graph-RAG AI Copilot (Deep Dive)

Standard Retrieval-Augmented Generation (RAG) splits flat text documents (PDFs, Markdown) into vector chunks. **This completely fails for software supply chains** because chunked text loses topological relationships, ancestor-descendant chains, and reachability paths.

Null Pointers implements a specialized **Graph-RAG** architecture:

```
                      User Prompt: "What is the blast radius of statuses?"
                                            │
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │ 1. ENTITY EXTRACTION & INTENT CLASSIFIER      │
                    │ - Detects package: "statuses"                 │
                    │ - Detects intent: blast_radius_query          │
                    └───────────────────────┬───────────────────────┘
                                            │
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │ 2. GRAPH-AWARE TOPOLOGICAL RETRIEVAL (R)      │
                    │ - Node Metadata: statuses@1.5.0 (Score: 10)   │
                    │ - Reverse BFS: Relied on by 7 upstream modules│
                    │ - Upstream Trail: express -> finalhandler     │
                    │ - Exclusivity: Isolated to express subtree    │
                    └───────────────────────┬───────────────────────┘
                                            │
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │ 3. STRUCTURED KNOWLEDGE AUGMENTATION (A)      │
                    │ - Injects exact graph facts, scores & paths   │
                    │ - Eliminates LLM hallucinations               │
                    └───────────────────────┬───────────────────────┘
                                            │
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │ 4. GUARDRAILED GENERATION (G)                 │
                    │ - Dual-Engine: Local synthesis / Gemini API   │
                    │ - Strict Domain Filter: Rejects off-topic Qs  │
                    │ - Recommends dynamic dataset-grounded prompts │
                    └───────────────────────┬───────────────────────┘
                                            │
                                            ▼
                  Interactive Chat UI with clickable graph highlights
```

### 🛡️ Guardrails & Anti-Hallucination Features

- **Strict Dataset Scoping**: If a user asks questions unrelated to their uploaded dependency dataset (e.g., *"What is the capital of France?"* or *"How to bake a cake"*), the copilot politely declines:
  > *"Sorry, I can't provide an answer to that question. I am exclusively specialized in analyzing your uploaded project's dependency dataset, vulnerability posture, and graph security risks."*
- **Dynamic Dataset Recommendations**: After declining an off-topic query, it automatically generates 5 tailored questions populated with **actual packages and scores from the user's active lockfile**:
  1. *"Why is my project score at **43** (Grade **C**)?"*
  2. *"Explain the recommended fix: `npm install express@latest` and why it removes 721 risk points?"*
  3. *"What is the blast radius of `statuses` and who pulls it in?"*
- **Click-to-Highlight Graph Integration**: When the AI mentions a package name (e.g., `` `statuses` ``), clicking that token in the chat drawer automatically centers, zooms, and highlights that node on the 2D Force Graph!

---

## 🎨 Interactive Graph & Risk Legend

Each circle in the dependency canvas represents an npm package, sized proportional to its calculated risk score:

| Color | Severity | Score Range | Description |
| :---: | :---: | :---: | :--- |
| 🔴 | **Critical** | $\ge 60$ | Active high-severity CVEs, malicious lifecycle scripts, or abandoned core modules. |
| 🟠 | **High** | $40 - 59$ | Significant security vulnerabilities or deprecated packages with unmaintained dependencies. |
| 🟡 | **Medium** | $20 - 39$ | Stale publish date (>5 years), non-permissive copyleft license, or minor CVE flags. |
| 🟢 | **Low / Safe** | $< 20$ | Clean packages with healthy maintenance, permissive licenses, and no known vulnerabilities. |

> **Glowing Blue/Red Ring**: Highlights the active **Blast Radius Path**, tracing the exact upstream parent chain that pulls a risky package into your project root.

---

## 🏗️ System Architecture

```
                       ┌───────────────────────────────────────────┐
                       │           Input Ingestion Layer           │
                       │  • File Upload (multipart/form-data)      │
                       │  • Local System Directory Path            │
                       │  • GitHub Public Repository URL           │
                       └─────────────────────┬─────────────────────┘
                                             │
                                             ▼
                       ┌───────────────────────────────────────────┐
                       │     Deterministic Parser (parser.js)      │
                       │  • Flat npm v2/v3 "packages" map parsing  │
                       │  • Root "" entry direct dependency filter │
                       │  • Scoped (@scope/pkg) & nested resolver  │
                       └─────────────────────┬─────────────────────┘
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
       ┌───────────────────────────────┐           ┌───────────────────────────────┐
       │   Graph Engine (builder.js)   │           │    Enrichment & Scoring       │
       │ • Directed Forward Graph      │           │ • OSV.dev CVE Database Sync   │
       │ • Directed Reverse Graph      │           │ • Lifecycle Script Detection  │
       │ • Reverse BFS Blast Radius    │           │ • Deprecation & License Audit │
       │ • 2D Nodes & Edge Topology    │           │ • Project Health Formula      │
       └───────────────┬───────────────┘           └───────────────┬───────────────┘
                       │                                           │
                       └─────────────────────┬─────────────────────┘
                                             │
                                             ▼
                       ┌───────────────────────────────────────────┐
                       │   Best Upgrade Engine (fix.js)            │
                       │ • Direct-dependency reachability matrix   │
                       │ • Exclusive-subtree risk summation        │
                       │ • Generates single "npm install" command  │
                       └─────────────────────┬─────────────────────┘
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
       ┌───────────────────────────────┐           ┌───────────────────────────────┐
       │    Frontend (React 18 + Vite) │           │    RAG Engine (server/rag/)   │
       │ • Health Grade (A through F)  │           │ • Graph-Aware Retriever       │
       │ • Interactive Results Table   │           │ • In-Memory Context Assembler │
       │ • 2D Force Graph Visualizer   │           │ • Gemini 1.5 Flash / Fallback │
       │ • Floating RAG Chat Widget    │           │ • Guardrailed Domain Filter   │
       └───────────────────────────────┘           └───────────────────────────────┘
```

---

## ✨ Key Features

- **⚡ Modern Lockfile Support**: Works natively with npm v7+ (`lockfileVersion: 2` and `lockfileVersion: 3`) as well as standalone `package.json` manifests.
- **💥 Blast Radius Engine**: Quantifies how many modules directly or indirectly rely on a vulnerable dependency.
- **🛠️ Single-Command Remediation**: Suggests the single most effective direct package upgrade that eliminates the highest unique risk subtree without breaking shared dependencies.
- **📦 Multi-Source Ingestion**:
  - Drag-and-drop `.json` file picker.
  - Direct local system folder path (e.g. `D:/projects/my-app`).
  - Direct GitHub repository link (e.g. `https://github.com/expressjs/express`).
- **🤖 Embedded RAG Copilot**:
  - Contextual question answering grounded in the active graph.
  - Quick-prompt suggestions for fast one-click security audits.
  - Dynamic off-topic rejection with tailored dataset recommendations.

---

## 📂 Project Directory Structure

```text
null_pointers/
├── client/                                 # Frontend Application (React 18 + Vite)
│   ├── src/
│   │   ├── dashboard/                      # Dashboard Components
│   │   │   ├── ChatPopup.jsx               # Floating RAG AI Security Copilot
│   │   │   ├── FixCard.jsx                 # Best Single Upgrade Card
│   │   │   ├── ResultsTable.jsx            # Filterable & sortable dependency table
│   │   │   ├── SummaryHeader.jsx           # Grade letter, projectScore, breakdown
│   │   │   └── UploadPage.jsx              # Multi-source ingestion selector
│   │   ├── details/
│   │   │   ├── DependencyGraph.jsx         # 2D Canvas Force Graph with blast paths
│   │   │   └── Details.jsx                 # Deep-dive package sidebar
│   │   ├── App.jsx                         # Main dashboard controller
│   │   └── index.css                       # Complete application design system
│   └── vite.config.js
│
├── server/                                 # Backend API & Analysis Engine (Express 5)
│   ├── api/
│   │   └── routes.js                       # Endpoints (/analyze, /sample, /chat)
│   ├── graph/
│   │   ├── parser.js                       # Lockfile parser & scoped path resolver
│   │   ├── builder.js                      # Adjacency graph & Blast Radius engine
│   │   └── fix.js                          # Best Single Upgrade exclusivity algorithm
│   ├── enrich/
│   │   ├── enrich.js                       # Vulnerability & metadata lookup
│   │   └── flags.js                        # License & lifecycle script audits
│   ├── scoring/
│   │   └── score.js                        # Risk formulas & project grade calculations
│   ├── rag/
│   │   ├── retriever.js                    # Graph context extractor & entity matcher
│   │   └── engine.js                       # Grounded synthesis & domain guardrail
│   ├── index.js                            # Server entrypoint
│   └── test.js                             # Complete automated test suite
│
└── samples/
    └── package-lock.json                   # Real-world benchmark lockfile
```

---

## 🚀 Quickstart

### Prerequisites
- **Node.js** >= `v18.0.0`
- **npm** >= `v9.0.0`

### 1. Clone the Repository
```bash
git clone https://github.com/Ranjith200711/null_pointers.git
cd null_pointers
```

### 2. Run the Backend API Server
```bash
cd server
npm install
npm run dev
```
> Server running at: **`http://localhost:3000`**

### 3. Run the Frontend Dashboard
In a new terminal window:
```bash
cd client
npm install
npm run dev
```
> Client running at: **`http://localhost:5173`**

---

## 📡 API Reference

### 1. Analyze Dependency Lockfile
`POST /analyze`

Accepts a multipart file upload **OR** a JSON body.

#### Example Request (JSON Body):
```bash
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{"filePath": "D:/projects/my-app/package-lock.json"}'
```

#### Example Response (200 OK):
```json
{
  "projectScore": 43,
  "grade": "C",
  "fix": {
    "package": "express",
    "risk": 2035,
    "command": "npm install express@latest"
  },
  "packages": [
    {
      "id": "statuses@1.5.0",
      "direct": false,
      "vulns": [],
      "deprecated": false,
      "lastPublish": "2018-03-27T00:00:00.000Z",
      "license": "MIT",
      "installScripts": false,
      "score": 10,
      "blastRadius": 7
    }
  ],
  "graph": {
    "nodes": [{ "id": "statuses@1.5.0", "name": "statuses", "version": "1.5.0" }],
    "edges": [{ "from": "finalhandler@1.3.1", "to": "statuses@1.5.0" }]
  }
}
```

---

### 2. Graph-RAG Copilot Chat
`POST /chat`

Query the AI Copilot about the active dependency graph.

#### Request:
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the blast radius of statuses?"}'
```

#### Grounded Response:
```json
{
  "reply": "### Package Analysis: `statuses@1.5.0`\n\n- **Type**: Transitive dependency\n- **Risk Score**: **10** (🟢 Low)\n- **Blast Radius**: **7** (relied on by 7 modules in your tree)\n- **Vulnerabilities**: No known vulnerabilities\n- **Install Scripts**: None\n- **License**: `MIT`\n\n💡 *Tip: Because this is a transitive dependency, you can check which direct dependency pulls it in from the dependency graph or apply our recommended upgrade fix.*",
  "relatedPackages": ["statuses@1.5.0"],
  "suggestedAction": "npm install express@latest"
}
```

---

### 3. Sample Benchmark Lockfile
`GET /sample`
Instantly executes the entire pipeline on `samples/package-lock.json` for live demos and evaluation.

---

## 🧪 Automated Testing & Resilience

We maintain comprehensive automated test coverage covering graph topology, edge cases, and HTTP endpoints:

```bash
cd server
npm test
```

### Benchmark Suite Output:
```text
==============================================
       NULL_POINTERS SERVER TEST SUITE        
==============================================

[1] Loaded sample lockfile: samples/package-lock.json
    - Parsed packages count: 53
    - Graph nodes count:    53
    - Graph edges count:    84
    - Max blast radius:     7 (statuses@1.5.0)
    - Best upgrade candidate: express (risk: 2035)
    - Project Score:         43
    - Project Grade:         C

[2] Testing Edge Cases:
    [Edge Case 1] Empty file / empty string
      ✓ Correctly throws on empty input (400 Bad Request)
    [Edge Case 2] Invalid JSON syntax
      ✓ Correctly throws on invalid JSON (400 Bad Request)
    [Edge Case 3] Lockfile with 0 dependencies
      ✓ Handled cleanly (0 packages, 0 nodes, 0 edges, null upgrade)
    [Edge Case 4] Circular dependencies (A <-> B)
      ✓ Traversal terminates safely without stack overflow (Upgrade: pkg-a)

[3] Testing HTTP Endpoints:
    ✓ GET /health -> 200 OK
    ✓ GET /sample -> 200 OK (53 packages parsed)
    ✓ POST /analyze (filePath) -> 200 OK
    ✓ POST /analyze (multipart upload) -> 200 OK
    ✓ POST /analyze (empty input) -> 400 Bad Request
    ✓ POST /analyze (invalid JSON) -> 400 Bad Request

==============================================
         ALL TESTS PASSED SUCCESSFULLY!       
==============================================
```

---

## 💬 Judge Q&A Guide

<details>
<summary><b>Q1: Why did you use Graph-RAG instead of standard document chunking?</b></summary>
<br/>
<i>"Standard RAG flattens documents into chunks and embeddings, which completely strips away topological hierarchy. In dependency security, context isn't just words—it's the graph edges. A package's risk depends on who pulls it in and its blast radius. Our Graph-RAG queries the in-memory graph to retrieve exact node ancestry and reachability paths before augmenting the prompt, ensuring zero hallucinations."</i>
</details>

<details>
<summary><b>Q2: How does the "Best Single Upgrade" algorithm prevent broken dependencies?</b></summary>
<br/>
<i>"If Package A and Package B both depend on vulnerable Package C, upgrading Package A will not remove Package C from your tree because Package B still requires it. Our algorithm performs BFS from all direct dependencies to build an exclusivity matrix. It only sums risk scores for nodes reachable exclusively through a single direct branch, guaranteeing that the suggested upgrade actually removes the reported risk points."</i>
</details>

<details>
<summary><b>Q3: How does the system handle circular dependencies?</b></summary>
<br/>
<i>"Our graph traversal algorithms in <code>builder.js</code> and <code>fix.js</code> maintain a <code>visited</code> set per BFS traversal. When a circular reference like <code>A -> B -> A</code> is encountered, already-visited nodes are skipped, preventing infinite loops while preserving accurate reachability and blast radius counts."</i>
</details>

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.
