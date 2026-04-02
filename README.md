# SafeShift 🛡️

**Strategic Engineering Intelligence & Risk Management Platform**

SafeShift is a comprehensive repository analysis platform designed to bridge the gap between technical debt and business impact. By combining static analysis, dependency mapping, and AI-driven insights, SafeShift empowers developers, team leads, and executives to make data-driven decisions about code quality, risk exposure, and resource allocation.

---

## 🚀 Live Demo
Experience SafeShift in action: [https://safe-shift.vercel.app/](https://safe-shift.vercel.app/)

---

## ⚠️ Problem Statement
Modern software development often suffers from a "visibility gap." Engineering teams struggle to quantify the **business risk** of technical debt, while executives lack clear metrics on how code-level issues affect the bottom line. 

**Key Challenges:**
- **Hidden Risk:** Critical files with high complexity and low test coverage often go unnoticed until they cause production failures.
- **Blast Radius Uncertainty:** Changing a core utility can have unforeseen ripple effects across the entire system.
- **AI Cost Inefficiency:** Indiscriminately using premium AI models for simple coding tasks leads to unnecessary cloud spend.
- **Disconnected Metrics:** Technical metrics (cyclomatic complexity) are rarely translated into business impact (downtime cost, revenue at risk).

---

## ✨ Key Features

### 1. Developer Sandbox
*   **Interactive File Explorer:** Deep-dive into your repository with real-time risk metrics for every file.
*   **Blast Radius Simulation:** Visualize the impact of changes before you commit. See exactly which modules are affected by a modification.
*   **AI-Powered Assistant:** Integrated chat for code refactoring and analysis, featuring **Smart AI Routing** to optimize cost and performance.

### 2. Team Heatmap (Technical Debt)
*   **Risk Hotspots:** Automatically identify "Critical" and "High Risk" files based on a weighted formula of complexity, coupling, and coverage.
*   **Debt Visualization:** Compare test coverage against cyclomatic complexity to find the most dangerous areas of your codebase.
*   **Aggregated Metrics:** Track average complexity and risk scores across the entire repository.

### 3. Executive Command (Business ROI)
*   **Business Domain Mapping:** Heuristic-based tagging that maps code folders to business domains (e.g., Revenue-Critical, Auth, Data Layer).
*   **Financial Impact Analysis:** Real-time estimation of downtime costs per minute and total revenue at risk.
*   **AI ROI Tracking:** Monitor savings achieved through our local AI router, which diverts simple tasks to cost-effective models.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS & shadcn/ui
- **State & Data:** TanStack Query (React Query)
- **Visualizations:** Recharts & React Force Graph

### Backend
- **Runtime:** Node.js (Express)
- **Language:** TypeScript
- **Analysis Engine:** 
  - `typhonjs-escomplex` (Cyclomatic Complexity)
  - `babel/parser` (AST & Dependency Mapping)
  - `simple-git` (Repository Ingestion)
- **AI Layer:** 
  - **Local Router:** Transformers.js (`all-MiniLM-L6-v2`) for zero-cost prompt classification.
  - **LLM Integration:** AWS Bedrock (Claude 3.5 Sonnet, Claude 3 Haiku, Amazon Nova).

---

## ⚙️ Installation & Setup

### Prerequisites
- Node.js (v18+)
- pnpm or npm

### 1. Clone the Repository
```bash
git clone https://github.com/code-silver01/safe-shift.git
cd safe-shift
```

### 2. Backend Setup
```bash
cd backend
npm install
# Create a .env file based on the environment variables needed (AWS credentials for Bedrock)
npm run dev
```

### 3. Frontend Setup
```bash
# From the root directory
npm install
npm run dev
```

The application will be available at `http://localhost:8080` (Frontend) and `http://localhost:3001` (Backend).

---

## 👥 Team SafeShift
| Name | Role |
| :--- | :--- |
| **Aditya Goel** | Core Developer |
| **Ashutosh Dwivedi** | Core Developer |
| **Sudhansu Kumar** | Core Developer |

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
*Built with ❤️ by Team SafeShift*
