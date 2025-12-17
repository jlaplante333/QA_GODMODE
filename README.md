# QA Agent Godmode 🚀

> **An orchestrated AI-powered QA Agent that curates evidence, diagnoses bugs, generates fixes, and reproduces errors in sandboxed environments.**
<img width="2186" height="2046" alt="image" src="https://github.com/user-attachments/assets/134ec196-f615-4762-8738-60bff107d4b4" />

Made for Dec 17th 2025, AI Hacks hackathon in Tokyo, QA Agent Godmode is a hackathon-grade MVP that demonstrates a complete bug analysis workflow: from raw stack traces (simulating Sentry data) to AI-powered diagnosis, fix generation, sandboxed execution, and verification. It's **NOT a chatbot**—it's a deterministic, state-machine orchestrated agent system with clear separation of concerns.

## 🎯 What It Does

1. **Ingests** raw stack traces (simulating Sentry error data)
2. **Curates** only relevant evidence into a minimal "Context Pack" (deterministic, no AI)
3. **Diagnoses** the bug using LLM reasoning over the curated context
4. **Generates** minimal repro steps and a proposed fix
5. **Executes** the repro in a sandboxed environment (mock Daytona)
6. **Verifies** whether the fix worked using LLM analysis

## 🏗️ Architecture

The system follows a strict **separation of concerns** with a state-machine orchestration pattern:

```
INGEST → CURATE_CONTEXT → DIAGNOSE → GENERATE_REPRO → EXECUTE → VERIFY
```

### Key Design Principles

- **LLM never sees raw stack traces** - Only curated ContextPack data
- **Evidence curation is deterministic** - No AI in the Evidence Builder
- **Execution is required** - Fixes must be "proven" through sandboxed runs
- **Clear state transitions** - Each step is explicit and debuggable
- **No heavy frameworks** - Plain LLM calls + deterministic orchestration

## 📁 Project Structure

```
ai_qa_godmode/
├── app/
│   ├── api/
│   │   ├── analyze/          # Main QA Agent orchestration endpoint
│   │   ├── daytona-execute/  # Daytona sandbox creation & execution
│   │   └── daytona-status/   # Daytona connection status check
│   ├── page.tsx              # Main UI component
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Styling
├── lib/
│   ├── orchestrator.ts       # State-machine agent orchestrator
│   ├── evidenceBuilder.ts    # Deterministic context curation (NO AI)
│   ├── aiAgent.ts            # LLM reasoning (diagnosis, fix, verification)
│   ├── execution.ts          # Mock sandboxed execution
│   ├── daytonaClient.ts      # Daytona API client
│   ├── llmClient.ts         # Minimal OpenAI-compatible client
│   ├── types.ts              # Shared TypeScript types
│   └── daytona.ts            # Daytona env var logging
├── package.json
├── tsconfig.json
└── next.config.mjs
```

## 🔧 Components

### 1. Evidence Builder (`lib/evidenceBuilder.ts`)
**Deterministic, no AI**

- Extracts error message from stack trace
- Extracts top 5 stack frames (excluding vendor/library frames)
- Identifies suspected file
- Enforces strict size budget
- **Output**: `ContextPack` (the only data the LLM ever sees)

### 2. AI Agent (`lib/aiAgent.ts`)
**LLM reasoning only**

- Diagnoses root cause from ContextPack
- Generates minimal repro steps
- Proposes code fix (snippet or diff)
- Verifies fix effectiveness from execution output

### 3. Execution Layer (`lib/execution.ts`)
**Mock Daytona-style sandbox**

- Simulates running repro steps in isolated environment
- Returns structured output (stdout, success/failure)
- No real infrastructure touched (safe for demos)

### 4. Daytona Integration (`lib/daytonaClient.ts`)
**Real sandboxed execution**

- Creates Daytona sandboxes on-demand
- Executes repro steps in real sandboxed environments
- Returns execution results for verification

### 5. Orchestrator (`lib/orchestrator.ts`)
**State-machine flow control**

- Manages the complete workflow
- Ensures each step completes before next
- Returns structured `AgentRunResult`

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key
- (Optional) Daytona API key and server URL for sandboxed execution

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/jlaplante333/QA_GODMODE.git
   cd QA_GODMODE
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   OPENAI_API_KEY=sk-your-openai-api-key-here
   
   # Optional: For Daytona sandboxed execution
   DAYTONA_API_KEY=your-daytona-api-key
   DAYTONA_SERVER_URL=https://app.daytona.io/api
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📖 Usage

### Basic Workflow

1. **Paste a stack trace** in the "Raw Stack Trace" textarea
   - You can use the "Use Sample Trace" button for a quick test
   - Or paste a real stack trace from Sentry, Node.js, or browser console

2. **Click "Analyze Bug"**
   - The system will process through all stages:
     - **Ingest**: Accepts the raw stack trace
     - **Curate Context**: Evidence Builder extracts relevant info
     - **Diagnose**: LLM analyzes the curated context
     - **Generate Repro**: LLM creates repro steps and fix
     - **Execute**: Mock sandbox runs the repro
     - **Verify**: LLM verifies if fix worked

3. **Review the results**
   - **Context Pack**: See what the LLM actually saw (curated data)
   - **Diagnosis**: Root cause analysis
   - **Repro Steps + Fix**: Proposed solution
   - **Execution Output**: Sandboxed run results
   - **Verification**: Whether the fix is effective

### Daytona Sandboxed Execution

If you have Daytona configured:

1. After running "Analyze Bug", you'll see a **"🚀 Create Daytona Sandbox & Reproduce"** button
2. Click it to:
   - Create a new Daytona sandbox
   - Execute the repro steps in a real sandboxed environment
   - Get actual execution results

The Daytona connection status is shown in the top-right chip (green = connected, red = not connected).

## 🎨 UI Overview

The interface is organized into panels showing each stage of the workflow:

- **Raw Stack Trace**: Input area (LLM never sees this directly)
- **Context Pack**: Curated evidence (what LLM sees)
- **Diagnosis**: AI-powered root cause analysis
- **Repro Steps + Fix Proposal**: Generated solution
- **Sandboxed Execution Output**: Mock execution results
- **Verification**: LLM verification of fix effectiveness

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | ✅ Yes | Your OpenAI API key for LLM calls |
| `DAYTONA_API_KEY` | ❌ Optional | Daytona API key for sandboxed execution |
| `DAYTONA_SERVER_URL` | ❌ Optional | Daytona server URL (default: `https://app.daytona.io/api`) |

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI**: React 18
- **LLM**: OpenAI API (GPT-4 compatible)
- **Execution**: Mock sandbox + Daytona integration
- **Styling**: CSS Modules

## 🏛️ Architecture Details

### State Machine Flow

```typescript
INGEST
  ↓
CURATE_CONTEXT (Evidence Builder - deterministic)
  ↓
DIAGNOSE (AI Agent - LLM reasoning)
  ↓
GENERATE_REPRO (AI Agent - LLM reasoning)
  ↓
EXECUTE (Execution Layer - mock or Daytona)
  ↓
VERIFY (AI Agent - LLM verification)
  ↓
DONE
```

### Data Flow

1. **Raw Stack Trace** → Evidence Builder
2. **ContextPack** → AI Agent (diagnosis + fix generation)
3. **Repro Steps** → Execution Layer
4. **Execution Output** → AI Agent (verification)
5. **Final Result** → UI display

### Key Guarantees

- ✅ LLM **never** sees raw stack traces
- ✅ Evidence curation is **deterministic** (no AI)
- ✅ Execution is **required** (fixes must be proven)
- ✅ Each step is **explicit** and **debuggable**

## 📝 API Endpoints

### `POST /api/analyze`

Main QA Agent orchestration endpoint.

**Request:**
```json
{
  "stackTrace": "TypeError: Cannot read properties of undefined..."
}
```

**Response:**
```json
{
  "contextPack": { "error": "...", "topFrames": [...], "suspectedFile": "..." },
  "diagnosis": { "rootCause": "...", "impactSummary": "..." },
  "reproAndFix": { "reproSteps": "...", "fixSnippet": "...", "notes": "..." },
  "execution": { "success": true, "stdout": "..." },
  "verification": { "fixWorked": true, "explanation": "..." }
}
```

### `GET /api/daytona-status`

Check Daytona connection status.

**Response:**
```json
{
  "connected": true,
  "hasKey": true,
  "serverUrl": "https://app.daytona.io/api"
}
```

### `POST /api/daytona-execute`

Create Daytona sandbox and execute repro steps.

**Request:**
```json
{
  "reproSteps": "- Run npm test\n- Observe error...",
  "workspaceName": "qa-repro-1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "stdout": "...",
  "stderr": "",
  "exitCode": 0,
  "command": "npm test",
  "sandboxId": "sandbox-id",
  "sandboxName": "qa-repro-1234567890"
}
```

## 🧪 Example Stack Trace

```javascript
TypeError: Cannot read properties of undefined (reading 'user')
    at getUserFromSession (/app/src/server/auth.ts:42:15)
    at getProfile (/app/src/server/profile.ts:18:10)
    at ProfilePage (/app/src/pages/profile.tsx:27:20)
    at renderWithHooks (node:internal/react-dom/server:123:22)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
```

## 🎯 Use Cases

- **Sentry Error Analysis**: Pull errors from Sentry and analyze them automatically
- **Bug Triage**: Quickly diagnose and propose fixes for production errors
- **QA Automation**: Generate repro steps and verify fixes automatically
- **Developer Onboarding**: Help new developers understand error patterns

## 🔮 Future Enhancements

- [ ] Direct Sentry API integration
- [ ] Support for multiple LLM providers
- [ ] Real Daytona sandbox management
- [ ] Fix auto-application (with approval)
- [ ] Historical error tracking
- [ ] Team collaboration features
- [ ] Custom evidence builder rules
- [ ] Multi-language support

## 📄 License

This project is open source and available for hackathon/demo purposes.

## 🤝 Contributing

This is a hackathon MVP. Contributions, issues, and feature requests are welcome!

## 🙏 Acknowledgments

Built as a demonstration of:
- Clean architecture with separation of concerns
- Deterministic evidence curation
- AI-powered reasoning with execution verification
- Modern Next.js + TypeScript patterns

---

**Built with ❤️ for hackathon excellence**

