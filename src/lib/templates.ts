// Built-in prompt templates organized by category
export interface PromptTemplate {
    id: string
    title: string
    description: string
    content: string
    category: string
    aiModel: string | null
    variables: string[]
}

export const TEMPLATE_CATEGORIES = [
    { value: 'coding', label: 'Coding', icon: 'Code' },
    { value: 'writing', label: 'Writing', icon: 'PenTool' },
    { value: 'analysis', label: 'Analysis', icon: 'BarChart3' },
    { value: 'creative', label: 'Creative', icon: 'Sparkles' },
    { value: 'business', label: 'Business', icon: 'Briefcase' },
    { value: 'learning', label: 'Learning', icon: 'GraduationCap' },
    { value: 'repo-analysis', label: 'Repo Analysis', icon: 'GitBranch' },
    { value: 'academic', label: 'Academic Research', icon: 'BookOpen' },
    { value: 'bmad-method', label: 'BMAD Method', icon: 'Workflow' },
    { value: 'spec-driven', label: 'Spec-Driven', icon: 'FileCheck' },
]

export const PROMPT_TEMPLATES: PromptTemplate[] = [
    // Coding Templates
    {
        id: 'code-review',
        title: 'Code Review',
        description: 'Get a thorough code review with best practices suggestions',
        category: 'coding',
        aiModel: 'gpt-4',
        content: `Please review the following code and provide feedback on:
1. Code quality and readability
2. Potential bugs or issues
3. Performance considerations
4. Best practices and improvements

Language: {{language}}

Code:
\`\`\`
{{code}}
\`\`\``,
        variables: ['language', 'code'],
    },
    {
        id: 'debug-helper',
        title: 'Debug Assistant',
        description: 'Help identify and fix bugs in your code',
        category: 'coding',
        aiModel: 'gpt-4',
        content: `I'm encountering an issue with my code. Please help me debug it.

Language: {{language}}
Error message: {{error}}

Code:
\`\`\`
{{code}}
\`\`\`

What I expected: {{expected}}
What actually happened: {{actual}}`,
        variables: ['language', 'error', 'code', 'expected', 'actual'],
    },
    {
        id: 'code-documentation',
        title: 'Generate Documentation',
        description: 'Create comprehensive documentation for your code',
        category: 'coding',
        aiModel: 'gpt-4',
        content: `Generate comprehensive documentation for the following code. Include:
- Function/class description
- Parameters and return values
- Usage examples
- Edge cases

Code:
\`\`\`{{language}}
{{code}}
\`\`\``,
        variables: ['language', 'code'],
    },

    // Writing Templates
    {
        id: 'blog-post',
        title: 'Blog Post Writer',
        description: 'Generate engaging blog post content',
        category: 'writing',
        aiModel: 'gpt-4',
        content: `Write a blog post about {{topic}}.

Target audience: {{audience}}
Tone: {{tone}}
Word count: approximately {{wordCount}}

Include:
- Engaging introduction
- Clear structure with headers
- Practical examples
- Strong conclusion with call-to-action`,
        variables: ['topic', 'audience', 'tone', 'wordCount'],
    },
    {
        id: 'email-professional',
        title: 'Professional Email',
        description: 'Craft professional emails for any situation',
        category: 'writing',
        aiModel: 'gpt-3.5-turbo',
        content: `Write a professional email for the following situation:

Purpose: {{purpose}}
Recipient: {{recipient}}
Key points to include: {{keyPoints}}
Tone: {{tone}}

Make it concise, clear, and professional.`,
        variables: ['purpose', 'recipient', 'keyPoints', 'tone'],
    },
    {
        id: 'summary-writer',
        title: 'Content Summarizer',
        description: 'Summarize long content into key points',
        category: 'writing',
        aiModel: 'gpt-3.5-turbo',
        content: `Summarize the following content into clear, concise bullet points.

Content to summarize:
{{content}}

Format: {{format}}
Length: {{length}}`,
        variables: ['content', 'format', 'length'],
    },

    // Analysis Templates
    {
        id: 'data-analysis',
        title: 'Data Analysis',
        description: 'Analyze data and provide insights',
        category: 'analysis',
        aiModel: 'gpt-4',
        content: `Analyze the following data and provide insights:

Data:
{{data}}

Please provide:
1. Key observations and patterns
2. Statistical summary
3. Anomalies or outliers
4. Actionable recommendations`,
        variables: ['data'],
    },
    {
        id: 'comparison',
        title: 'Comparison Analysis',
        description: 'Compare two or more options objectively',
        category: 'analysis',
        aiModel: 'gpt-4',
        content: `Provide an objective comparison between:

Option A: {{optionA}}
Option B: {{optionB}}

Criteria to evaluate: {{criteria}}

Include pros/cons, use cases, and a recommendation.`,
        variables: ['optionA', 'optionB', 'criteria'],
    },

    // Creative Templates
    {
        id: 'brainstorm',
        title: 'Brainstorm Ideas',
        description: 'Generate creative ideas for any topic',
        category: 'creative',
        aiModel: 'gpt-4',
        content: `Brainstorm {{number}} creative ideas for: {{topic}}

Context: {{context}}
Constraints: {{constraints}}

Be innovative and think outside the box.`,
        variables: ['number', 'topic', 'context', 'constraints'],
    },
    {
        id: 'naming',
        title: 'Name Generator',
        description: 'Generate creative names for products, projects, etc.',
        category: 'creative',
        aiModel: 'gpt-3.5-turbo',
        content: `Generate {{count}} creative name suggestions for:

Type: {{type}}
Description: {{description}}
Style: {{style}}
Keywords to incorporate: {{keywords}}`,
        variables: ['count', 'type', 'description', 'style', 'keywords'],
    },

    // Business Templates
    {
        id: 'meeting-notes',
        title: 'Meeting Notes',
        description: 'Structure and organize meeting notes',
        category: 'business',
        aiModel: 'gpt-3.5-turbo',
        content: `Organize these meeting notes into a clear format:

Raw notes:
{{notes}}

Include:
- Meeting summary
- Key decisions made
- Action items with owners
- Next steps`,
        variables: ['notes'],
    },
    {
        id: 'proposal',
        title: 'Business Proposal',
        description: 'Create a professional business proposal',
        category: 'business',
        aiModel: 'gpt-4',
        content: `Create a business proposal for:

Project: {{project}}
Client: {{client}}
Budget: {{budget}}
Timeline: {{timeline}}

Include executive summary, scope, deliverables, and pricing.`,
        variables: ['project', 'client', 'budget', 'timeline'],
    },

    // Learning Templates
    {
        id: 'explain-concept',
        title: 'Explain Like I\'m 5',
        description: 'Get simple explanations of complex topics',
        category: 'learning',
        aiModel: 'gpt-4',
        content: `Explain {{topic}} in simple terms that a {{level}} could understand.

Use analogies and examples from everyday life.
Avoid jargon and technical terms.`,
        variables: ['topic', 'level'],
    },
    {
        id: 'tutorial',
        title: 'Step-by-Step Tutorial',
        description: 'Create detailed tutorials for any skill',
        category: 'learning',
        aiModel: 'gpt-4',
        content: `Create a step-by-step tutorial for: {{topic}}

Skill level: {{skillLevel}}
Tools/prerequisites: {{tools}}

Include:
- Clear numbered steps
- Tips and common mistakes
- Practice exercises`,
        variables: ['topic', 'skillLevel', 'tools'],
    },

    // Repo Analysis Templates - Codebase Understanding & Onboarding
    {
        id: 'full-architecture-map',
        title: 'Full Architecture Map',
        description: 'Generate a complete architecture document from repository analysis',
        category: 'repo-analysis',
        aiModel: 'gpt-4',
        content: `Analyze the attached repository and produce a complete architecture document including: system overview diagram (describe in text/mermaid), service boundaries, data flow between components, external dependencies, entry points (APIs/CLI/UI), database schemas inferred from models/migrations, and a glossary of domain terms found in the code—output in Markdown with clear headings.

Reference specific files and line numbers from the repo, list your assumptions explicitly, and flag anything you're uncertain about that would change your recommendations.`,
        variables: [],
    },
    {
        id: 'developer-onboarding-guide',
        title: 'Developer Onboarding Guide',
        description: 'Generate a new developer onboarding guide from codebase analysis',
        category: 'repo-analysis',
        aiModel: 'gpt-4',
        content: `Review the attached codebase and generate a new developer onboarding guide covering: local setup steps (inferred from config files, dockerfiles, package managers), key directories and their purposes, critical code paths for the main user flows, debugging tips based on logging/error handling patterns, and a 'first week' task list to get familiar with the codebase.

Reference specific files and line numbers from the repo, list your assumptions explicitly, and flag anything you're uncertain about that would change your recommendations.`,
        variables: [],
    },
    {
        id: 'dependency-integration-map',
        title: 'Dependency & Integration Map',
        description: 'Create a comprehensive dependency and integration map',
        category: 'repo-analysis',
        aiModel: 'gpt-4',
        content: `Parse the attached repo and create a comprehensive dependency map showing: all third-party libraries with their versions and purposes, internal module dependencies, external service integrations (APIs, databases, message queues), environment variables required, and flag any outdated or deprecated dependencies with recommended upgrades.

Reference specific files and line numbers from the repo, list your assumptions explicitly, and flag anything you're uncertain about that would change your recommendations.`,
        variables: [],
    },

    // Repo Analysis Templates - Technical Debt & Code Quality
    {
        id: 'technical-debt-inventory',
        title: 'Technical Debt Inventory',
        description: 'Produce a prioritized technical debt register',
        category: 'repo-analysis',
        aiModel: 'gpt-4',
        content: `Scan the attached repository and produce a prioritized technical debt register containing: code smells (god classes, long methods, duplicated logic), outdated patterns, missing abstractions, hardcoded values that should be configurable, inconsistent naming conventions, dead code, and TODO/FIXME/HACK comments—rank each by impact (high/medium/low) and estimated effort to fix.

Reference specific files and line numbers from the repo, list your assumptions explicitly, and flag anything you're uncertain about that would change your recommendations.`,
        variables: [],
    },
    {
        id: 'code-quality-audit',
        title: 'Code Quality Audit',
        description: 'Comprehensive code quality analysis with specific remediation steps',
        category: 'repo-analysis',
        aiModel: 'gpt-4',
        content: `Analyze the attached codebase for code quality issues including: test coverage gaps (identify untested critical paths), error handling inconsistencies, logging adequacy, type safety issues, circular dependencies, layer violations (e.g., UI calling DB directly), and missing input validation—provide specific file:line references and remediation suggestions for each.

Reference specific files and line numbers from the repo, list your assumptions explicitly, and flag anything you're uncertain about that would change your recommendations.`,
        variables: [],
    },
    {
        id: 'refactoring-roadmap',
        title: 'Refactoring Roadmap',
        description: 'Create a phased refactoring plan with priorities',
        category: 'repo-analysis',
        aiModel: 'gpt-4',
        content: `Based on the attached repo, create a phased refactoring plan that identifies the top 10 refactoring opportunities ranked by risk-reduction and developer velocity impact, with each item including: current state, target state, affected files, estimated effort, dependencies on other refactors, and a safe incremental approach with rollback checkpoints.

Reference specific files and line numbers from the repo, list your assumptions explicitly, and flag anything you're uncertain about that would change your recommendations.`,
        variables: [],
    },

    // Repo Analysis Templates - Security & Compliance
    {
        id: 'security-vulnerability-scan',
        title: 'Security Vulnerability Scan',
        description: 'Perform a comprehensive security audit of the codebase',
        category: 'repo-analysis',
        aiModel: 'gpt-4',
        content: `Perform a security audit of the attached repository checking for: hardcoded secrets/credentials, SQL injection vectors, XSS vulnerabilities, insecure deserialization, authentication/authorization gaps, insecure direct object references, missing rate limiting, sensitive data exposure in logs, and dependency vulnerabilities—output a risk-ranked findings table with CVSS-style severity and remediation steps.

Reference specific files and line numbers from the repo, list your assumptions explicitly, and flag anything you're uncertain about that would change your recommendations.`,
        variables: [],
    },
    {
        id: 'privacy-data-handling-review',
        title: 'Privacy & Data Handling Review',
        description: 'Analyze codebase for privacy compliance (GDPR/CCPA)',
        category: 'repo-analysis',
        aiModel: 'gpt-4',
        content: `Analyze the attached codebase for privacy compliance by identifying: all PII/sensitive data fields and their storage locations, data retention policies (or lack thereof), encryption at rest/in transit implementation, audit logging for data access, consent management flows, data deletion capabilities, and third-party data sharing—flag gaps against GDPR/CCPA requirements.

Reference specific files and line numbers from the repo, list your assumptions explicitly, and flag anything you're uncertain about that would change your recommendations.`,
        variables: [],
    },

    // Repo Analysis Templates - Feature Planning & Implementation
    {
        id: 'feature-impact-analysis',
        title: 'Feature Impact Analysis',
        description: 'Analyze the impact of implementing a new feature',
        category: 'repo-analysis',
        aiModel: 'gpt-4',
        content: `Given the attached repo, analyze the impact of implementing {{feature}} by identifying: all files/modules that would need modification, database schema changes required, API contract changes, potential breaking changes for clients, estimated complexity (low/medium/high) per component, integration points with existing features, and a suggested implementation sequence with dependencies.

Reference specific files and line numbers from the repo, list your assumptions explicitly, and flag anything you're uncertain about that would change your recommendations.`,
        variables: ['feature'],
    },
    {
        id: 'feature-implementation-blueprint',
        title: 'Feature Implementation Blueprint',
        description: 'Create a detailed implementation plan for a new feature',
        category: 'repo-analysis',
        aiModel: 'gpt-4',
        content: `Using the attached codebase as context, create a detailed implementation plan for {{feature}} including: architecture approach that fits existing patterns, new files/classes to create with their responsibilities, modifications to existing files (specify what changes), database migrations needed, API endpoints (request/response schemas), frontend components if applicable, and acceptance criteria with edge cases.

Reference specific files and line numbers from the repo, list your assumptions explicitly, and flag anything you're uncertain about that would change your recommendations.`,
        variables: ['feature'],
    },
    {
        id: 'backward-compatibility-plan',
        title: 'Backward Compatibility Plan',
        description: 'Design a backward-compatible implementation strategy',
        category: 'repo-analysis',
        aiModel: 'gpt-4',
        content: `Analyze the attached repo and design a backward-compatible implementation strategy for {{change}} that includes: versioning approach for APIs, database migration strategy (expand-contract pattern), feature flag implementation points, client communication timeline, deprecation warnings to add, rollback triggers and procedure, and a phased rollout schedule.

Reference specific files and line numbers from the repo, list your assumptions explicitly, and flag anything you're uncertain about that would change your recommendations.`,
        variables: ['change'],
    },

    // Repo Analysis Templates - Testing Strategy
    {
        id: 'test-strategy-document',
        title: 'Test Strategy Document',
        description: 'Generate a comprehensive test strategy from codebase analysis',
        category: 'repo-analysis',
        aiModel: 'gpt-4',
        content: `Review the attached repository's current test coverage and generate a comprehensive test strategy covering: unit test gaps (list specific untested functions/methods), integration test needs (service boundaries to test), e2e test scenarios for critical user journeys, performance test targets based on inferred SLOs, test data management approach, and recommended testing tools/frameworks that fit the existing stack.

Reference specific files and line numbers from the repo, list your assumptions explicitly, and flag anything you're uncertain about that would change your recommendations.`,
        variables: [],
    },
    {
        id: 'critical-path-test-plan',
        title: 'Critical Path Test Plan',
        description: 'Create test plans for critical business paths',
        category: 'repo-analysis',
        aiModel: 'gpt-4',
        content: `Identify the critical business paths in the attached codebase (auth, checkout, data mutations, etc.) and create a test plan for each including: happy path scenarios, edge cases, failure modes to simulate, mock/stub requirements, test data setup, assertions to verify, and regression risk areas—prioritize by business impact.

Reference specific files and line numbers from the repo, list your assumptions explicitly, and flag anything you're uncertain about that would change your recommendations.`,
        variables: [],
    },

    // Repo Analysis Templates - Performance & Scalability
    {
        id: 'performance-optimization-audit',
        title: 'Performance Optimization Audit',
        description: 'Analyze repository for performance issues and optimizations',
        category: 'repo-analysis',
        aiModel: 'gpt-4',
        content: `Analyze the attached repo for performance issues including: N+1 query patterns, missing database indexes (infer from query patterns), unbounded data fetches, synchronous operations that should be async, missing caching opportunities, memory leak risks, inefficient algorithms (O(n²) or worse), and large payload transfers—provide specific locations and optimization recommendations with expected impact.

Reference specific files and line numbers from the repo, list your assumptions explicitly, and flag anything you're uncertain about that would change your recommendations.`,
        variables: [],
    },
    {
        id: 'scalability-assessment',
        title: 'Scalability Assessment',
        description: 'Produce a scalability report with architectural recommendations',
        category: 'repo-analysis',
        aiModel: 'gpt-4',
        content: `Review the attached codebase and produce a scalability report covering: current bottlenecks (single points of failure, shared state, non-horizontal components), database scaling readiness, caching strategy adequacy, queue/async processing opportunities, stateless vs stateful components, and a roadmap to handle 10x current load with specific architectural changes needed.

Reference specific files and line numbers from the repo, list your assumptions explicitly, and flag anything you're uncertain about that would change your recommendations.`,
        variables: [],
    },

    // Repo Analysis Templates - Migration & Upgrade Planning
    {
        id: 'framework-upgrade-plan',
        title: 'Framework/Language Upgrade Plan',
        description: 'Create a migration plan for framework or language upgrades',
        category: 'repo-analysis',
        aiModel: 'gpt-4',
        content: `Analyze the attached repo and create a migration plan to upgrade from {{currentVersion}} to {{targetVersion}} including: breaking changes that affect this codebase, deprecated APIs currently in use, new features to adopt, file-by-file change list, suggested migration sequence (dependencies first), testing checkpoints, and rollback strategy.

Reference specific files and line numbers from the repo, list your assumptions explicitly, and flag anything you're uncertain about that would change your recommendations.`,
        variables: ['currentVersion', 'targetVersion'],
    },
    {
        id: 'database-migration-blueprint',
        title: 'Database Migration Blueprint',
        description: 'Design a zero-downtime database migration plan',
        category: 'repo-analysis',
        aiModel: 'gpt-4',
        content: `Based on the attached repository, design a zero-downtime database migration plan for {{schemaChange}} including: expand phase (add new structures), migrate phase (backfill data with script), contract phase (remove old structures), application code changes at each phase, rollback procedures, data validation queries, and estimated timeline with checkpoints.

Reference specific files and line numbers from the repo, list your assumptions explicitly, and flag anything you're uncertain about that would change your recommendations.`,
        variables: ['schemaChange'],
    },
    {
        id: 'monolith-decomposition',
        title: 'Monolith to Services Decomposition',
        description: 'Propose a service decomposition strategy for monolithic codebases',
        category: 'repo-analysis',
        aiModel: 'gpt-4',
        content: `Analyze the attached monolithic codebase and propose a service decomposition strategy identifying: bounded contexts and natural service boundaries, shared data that needs decoupling, synchronous calls to convert to async, suggested extraction sequence (lowest risk first), API contracts between new services, data ownership per service, and a phased migration plan maintaining the monolith as fallback.

Reference specific files and line numbers from the repo, list your assumptions explicitly, and flag anything you're uncertain about that would change your recommendations.`,
        variables: [],
    },

    // Repo Analysis Templates - Sprint & Milestone Planning
    {
        id: 'sprint-breakdown-generator',
        title: 'Sprint Breakdown Generator',
        description: 'Break down goals into a detailed sprint plan',
        category: 'repo-analysis',
        aiModel: 'gpt-4',
        content: `Using the attached repo for context, break down {{goal}} into a 2-week sprint plan with: daily task breakdown (max 4 hours per task), file-level scope for each task, dependencies between tasks, PR review checkpoints, risk buffer allocation, definition of done per task, and a day-by-day schedule assuming {{teamSize}} engineers.

Reference specific files and line numbers from the repo, list your assumptions explicitly, and flag anything you're uncertain about that would change your recommendations.`,
        variables: ['goal', 'teamSize'],
    },
    {
        id: 'milestone-dependency-graph',
        title: 'Milestone Dependency Graph',
        description: 'Produce a dependency graph for milestone planning',
        category: 'repo-analysis',
        aiModel: 'gpt-4',
        content: `Analyze what's needed to achieve {{milestone}} in the attached codebase and produce: a dependency graph of all required changes, critical path identification, parallelizable work streams, external dependencies/blockers, risk items with mitigations, go/no-go decision criteria, and a week-by-week timeline with deliverables.

Reference specific files and line numbers from the repo, list your assumptions explicitly, and flag anything you're uncertain about that would change your recommendations.`,
        variables: ['milestone'],
    },

    // Repo Analysis Templates - Documentation Generation
    {
        id: 'api-documentation-generator',
        title: 'API Documentation Generator',
        description: 'Generate comprehensive API documentation from codebase',
        category: 'repo-analysis',
        aiModel: 'gpt-4',
        content: `Parse the attached repository and generate comprehensive API documentation including: all endpoints with HTTP methods and paths, request/response schemas with examples, authentication requirements, rate limits if configured, error response formats, and usage examples—output in OpenAPI 3.0 YAML format plus a human-readable Markdown version.

Reference specific files and line numbers from the repo, list your assumptions explicitly, and flag anything you're uncertain about that would change your recommendations.`,
        variables: [],
    },
    {
        id: 'system-runbook-generator',
        title: 'System Runbook Generator',
        description: 'Create an operations runbook from codebase analysis',
        category: 'repo-analysis',
        aiModel: 'gpt-4',
        content: `Based on the attached codebase, create an operations runbook covering: deployment procedure (inferred from CI/CD configs), environment configuration, health check endpoints and expected responses, common failure scenarios and troubleshooting steps, log locations and key search patterns, scaling procedures, backup/restore processes, and incident response playbook.

Reference specific files and line numbers from the repo, list your assumptions explicitly, and flag anything you're uncertain about that would change your recommendations.`,
        variables: [],
    },

    // Repo Analysis Templates - Architecture Decision Records
    {
        id: 'adr-from-current-state',
        title: 'ADR from Current State',
        description: 'Reverse-engineer an Architecture Decision Record from existing code',
        category: 'repo-analysis',
        aiModel: 'gpt-4',
        content: `Analyze the attached repo's implementation of {{component}} and reverse-engineer an Architecture Decision Record documenting: the context and problem it solves, alternatives that were likely considered, tradeoffs of the chosen approach, consequences (positive and negative), and 'revisit when' triggers that would warrant reconsideration.

Reference specific files and line numbers from the repo, list your assumptions explicitly, and flag anything you're uncertain about that would change your recommendations.`,
        variables: ['component'],
    },
    {
        id: 'adr-for-proposed-change',
        title: 'ADR for Proposed Change',
        description: 'Create an Architecture Decision Record for a proposed change',
        category: 'repo-analysis',
        aiModel: 'gpt-4',
        content: `Given the attached codebase context, create an ADR for {{proposedChange}} with: current state summary, problem statement, three viable options with implementation sketches, tradeoff matrix (complexity/risk/performance/maintainability/cost), recommended option with justification, migration path from current state, and decision reversal triggers.

Reference specific files and line numbers from the repo, list your assumptions explicitly, and flag anything you're uncertain about that would change your recommendations.`,
        variables: ['proposedChange'],
    },

    // Academic Research Templates - AI-Assisted Academic Workflow
    {
        id: 'future-works-analysis',
        title: 'Future Works Analysis & Experiment Proposal',
        description: 'Analyze research papers to identify gaps and propose high-impact experiments',
        category: 'academic',
        aiModel: 'gpt-4',
        content: `ROLE: Act as a senior research scientist specializing in {{domain}} with expertise in identifying high-impact research directions.

TASK: Analyze the 'Future Works,' 'Limitations,' and 'Discussion' sections of these {{paperCount}} recent papers from {{venueTier}} conferences (2026 and later).

ANALYSIS FRAMEWORK:
1. Extract and categorize all mentioned limitations (methodological, dataset, scalability, generalizability)
2. Map recurring research gaps across papers using a frequency matrix
3. Identify contradictions or debates between papers
4. Note which gaps have since been addressed by newer work

OUTPUT REQUIREMENTS:
- Synthesize 3-5 concrete experiment proposals in this format:
  * Hypothesis: Falsifiable statement
  * Gap Addressed: Which papers mentioned this + citation count of those papers
  * Required Resources: Datasets, compute (GPU hours estimate), human annotation needs
  * Methodology Sketch: 2-3 sentence approach
  * Success Metrics: Primary and secondary evaluation criteria
  * Risk Assessment: What could invalidate results
  * Novelty Score: 1-5 with justification
  * Feasibility Score: 1-5 based on {{availableResources}}
  * Estimated Timeline: In researcher-weeks

RANKING: Prioritize by (Novelty × Feasibility × Citation Potential) and flag any "low-hanging fruit" opportunities.

CONTEXT: My expertise level is {{expertiseLevel}}, available compute is {{computeResources}}, and target venue is {{targetVenue}}.`,
        variables: ['domain', 'paperCount', 'venueTier', 'availableResources', 'expertiseLevel', 'computeResources', 'targetVenue'],
    },
    {
        id: 'experiment-code-generation',
        title: 'Experiment Code Generation',
        description: 'Generate production-quality ML experiment code with reproducibility standards',
        category: 'academic',
        aiModel: 'gpt-4',
        content: `ROLE: Act as a senior ML engineer with expertise in reproducible research and {{framework}}.

TASK: Generate production-quality code for {{experimentDescription}} targeting {{domainApplication}}.

CODE ARCHITECTURE REQUIREMENTS:
1. **Project Structure:**
   \`\`\`
   project/
   ├── configs/          # YAML hyperparameter configs with schema validation
   ├── src/
   │   ├── data/         # DataLoaders, preprocessing, augmentation pipelines
   │   ├── models/       # Modular architecture with clear forward() documentation
   │   ├── training/     # Training loop, callbacks, checkpointing
   │   ├── evaluation/   # Metrics, statistical tests, visualization
   │   └── utils/        # Reproducibility utils, logging, device management
   ├── scripts/          # Entry points for train/eval/inference
   ├── tests/            # Unit tests for critical components
   └── requirements.txt  # Pinned versions
   \`\`\`

2. **Reproducibility Requirements:**
   - Global seed management (Python, NumPy, PyTorch, CUDA)
   - Deterministic algorithm flags where applicable
   - Config hashing for experiment tracking
   - Git commit hash logging

3. **Code Quality Standards:**
   - Type hints throughout
   - Docstrings in NumPy format
   - Assertion checks for tensor shapes at critical points
   - Graceful error handling with informative messages
   - Compatible with {{experimentTracker}}

4. **Domain-Specific Requirements for {{domainApplication}}:**
   - Evaluation metrics: {{evaluationMetrics}}
   - Standard baselines to include: {{baselines}}
   - Dataset splits following {{splitProtocol}}

OUTPUT: Generate code incrementally—start with data pipeline, confirm correctness, then proceed to model, training, and evaluation modules.

MY ENVIRONMENT: Python {{pythonVersion}}, CUDA {{cudaVersion}}, {{gpuCount}} GPUs with {{gpuMemory}}GB VRAM each.`,
        variables: ['framework', 'experimentDescription', 'domainApplication', 'experimentTracker', 'evaluationMetrics', 'baselines', 'splitProtocol', 'pythonVersion', 'cudaVersion', 'gpuCount', 'gpuMemory'],
    },
    {
        id: 'results-interpretation',
        title: 'Results Interpretation & Analysis',
        description: 'Critical analysis of experimental results with statistical rigor',
        category: 'academic',
        aiModel: 'gpt-4',
        content: `ROLE: Act as a critical peer reviewer and statistician for {{targetVenue}} with expertise in {{domain}}.

INPUT DATA:
- Experimental results: {{experimentalResults}}
- Baseline methods: {{baselineMethods}}
- Dataset characteristics: {{datasetCharacteristics}}
- Compute budget used: {{computeBudget}}

ANALYSIS FRAMEWORK:

**A. Statistical Rigor Check:**
- Are improvements statistically significant? Apply appropriate tests (t-test, Wilcoxon, bootstrap CI)
- Report effect sizes, not just p-values
- Flag any results within noise margins
- Identify if sample sizes support claimed conclusions

**B. Comparative Analysis:**
- Performance delta vs. each baseline (absolute and relative %)
- Compute-normalized comparisons (performance per FLOP/parameter)
- Which specific test cases show largest gains/losses?

**C. Pattern Interpretation:**
- Hypothesize WHY improvements occur (with evidence from results)
- Identify failure modes and edge cases
- Connect findings to theoretical expectations

**D. Limitation Acknowledgment:**
- What can NOT be concluded from these results?
- Confounding variables not controlled for
- Generalization boundaries

**E. Publication Strategy:**
- Rank findings by publishability (novelty + strength of evidence)
- Suggest narrative framing for strongest results
- Identify which results need additional experiments to be convincing
- Recommend target venues based on contribution level

OUTPUT FORMAT: Structured report with executive summary, detailed analysis per section, and actionable next steps.`,
        variables: ['targetVenue', 'domain', 'experimentalResults', 'baselineMethods', 'datasetCharacteristics', 'computeBudget'],
    },
    {
        id: 'paper-drafting',
        title: 'Academic Paper Drafting',
        description: 'Draft conference/journal papers following venue-specific conventions',
        category: 'academic',
        aiModel: 'gpt-4',
        content: `ROLE: Act as an experienced academic writer with multiple publications at {{targetVenue}} in {{domain}}.

TASK: Draft a conference/journal paper following {{targetVenue}} formatting and style conventions.

PAPER METADATA:
- Target venue: {{targetVenue}} (submission deadline: {{submissionDeadline}})
- Page limit: {{pageLimit}} pages
- Our core contribution: {{coreContribution}}
- Differentiation from closest prior work: {{priorWorkDifferentiation}}

SECTION-BY-SECTION REQUIREMENTS:

**Abstract (150-250 words):**
- Problem → Gap → Approach → Results (with numbers) → Implication
- Front-load the contribution; avoid vague claims

**Introduction (1-1.5 pages):**
- Hook with motivating example or statistic
- Problem definition with scope boundaries
- Gap in existing solutions (cite 2-3 representative works)
- Our approach (1 paragraph, high-level)
- Contribution bullet points (3-4 specific, verifiable claims)
- Results preview with key numbers
- Paper organization paragraph

**Related Work (1-1.5 pages):**
- Organize by theme, not chronologically
- Position our work: "Unlike X which does Y, we do Z"
- Include recent preprints/concurrent work to demonstrate awareness
- End with clear differentiation statement

**Methodology ({{methodologyPages}} pages):**
- Problem formulation with notation table
- Method description with intuition before formalism
- Justify design choices (why this architecture/loss/etc.)
- Complexity analysis if relevant
- Figure illustrating overall pipeline

**Experiments ({{experimentsPages}} pages):**
- Research questions as subsection headers
- Datasets: statistics table, preprocessing details, split rationale
- Baselines: why these specifically, implementation details
- Ablation studies isolating each contribution component
- Qualitative examples (success AND failure cases)

**Results & Discussion:**
- Lead with main finding, then support
- Statistical significance indicators in all tables
- Analysis explaining why, not just what

**Conclusion (0.5 pages):**
- Restate contribution without copy-pasting
- Limitations (shows maturity)
- Future work (specific, not generic)

STYLE REQUIREMENTS:
- Active voice preferred
- Quantify claims wherever possible
- Define acronyms on first use
- Consistent terminology throughout
- {{venueSpecificConventions}}

OUTPUT: Draft each section sequentially, pausing for my feedback before proceeding to the next.`,
        variables: ['targetVenue', 'domain', 'submissionDeadline', 'pageLimit', 'coreContribution', 'priorWorkDifferentiation', 'methodologyPages', 'experimentsPages', 'venueSpecificConventions'],
    },
    {
        id: 'thesis-compilation',
        title: 'Thesis Compilation',
        description: 'Synthesize published papers into a cohesive thesis document',
        category: 'academic',
        aiModel: 'gpt-4',
        content: `ROLE: Act as a thesis advisor and academic editor for a {{thesisType}} thesis in {{department}} at a {{universityTier}} institution.

TASK: Synthesize {{paperCount}} published/submitted papers into a cohesive thesis document.

INPUT MATERIALS:
{{papersList}}

Connecting theme: {{connectingTheme}}

THESIS ARCHITECTURE:

**Chapter 1: Introduction (15-20 pages)**
- Grand challenge motivation in {{broaderField}}
- Thesis statement: single sentence encapsulating overarching contribution
- Research questions (map to each paper)
- Methodology overview (common threads)
- Contribution summary with chapter mapping
- Publications list with my role in each

**Chapter 2: Background & Literature Review (25-40 pages)**
- Unified literature review (not just concatenated paper related works)
- Identify intellectual lineage leading to your work
- Taxonomy of approaches in the field
- Gap analysis showing where your work fits
- Technical preliminaries needed for all papers

**Chapters 3-N: Technical Contributions (per-paper chapters)**
- Adapt each paper with:
  - Expanded methodology details (space no longer limited)
  - Additional experiments/ablations not in published version
  - Cross-references to other thesis chapters
  - Reflection on limitations discovered post-publication

**Synthesis & Discussion Chapter (10-15 pages)**
- How findings across papers interact/reinforce each other
- Meta-analysis of combined results
- Broader implications for the field
- What I would do differently in hindsight

**Conclusion & Future Directions (8-10 pages)**
- Thesis contributions revisited (mapped to research questions)
- Limitations of the overall research program
- Concrete future work agenda (enough for 2-3 more papers)
- Closing statement on field impact

**Appendices:**
- Extended proofs/derivations
- Additional experimental results
- Code/data availability statements

NARRATIVE REQUIREMENTS:
- Create coherent story arc, not stapled papers
- Consistent notation across all chapters (create mapping table)
- Thesis should be readable as standalone document
- Balance accessibility (for committee) with depth (for experts)

OUTPUT: Generate chapter-by-chapter outline first, then draft each section with transition paragraphs emphasized.

MY TIMELINE: Defense scheduled for {{defenseDate}}, need complete draft by {{draftDeadline}}.`,
        variables: ['thesisType', 'department', 'universityTier', 'paperCount', 'papersList', 'connectingTheme', 'broaderField', 'defenseDate', 'draftDeadline'],
    },

    // BMAD Method Templates - AI-Assisted Development Workflows
    {
        id: 'bmad-context',
        title: 'Project Discovery & Context Generation',
        description: 'Analyze a repository to generate a comprehensive project context document that governs future AI agent behavior',
        category: 'bmad-method',
        aiModel: 'gpt-4',
        content: `Analyze the entire repository file structure and content to identify the implicit and explicit technology stack, version constraints, architectural patterns, naming conventions, and testing strategies currently in use. Synthesize these findings into a comprehensive \`project-context.md\` file that acts as a strict constitution for future AI agents, documenting critical implementation rules, anti-patterns to avoid, and specific coding standards that must be adhered to, ensuring that all subsequent code generation aligns perfectly with the existing engineering culture and prevents regression or architectural drift.`,
        variables: [],
    },
    {
        id: 'bmad-planner',
        title: 'Product Requirements Definition',
        description: 'Transform a project vision into a high-density PRD with user journeys, FRs, NFRs, and MVP scoping',
        category: 'bmad-method',
        aiModel: 'gpt-4',
        content: `Act as an expert Product Manager to transform the initial project vision into a high-density Product Requirements Document (PRD) by iteratively defining the executive summary, success metrics, and target user personas, then mapping these into detailed narrative user journeys. Decompose these journeys into specific, testable Functional Requirements (FRs) and measurable Non-Functional Requirements (NFRs) that act as a strict capability contract, ensuring all features are traceable to user needs while identifying domain-specific compliance constraints (e.g., HIPAA, PCI) and defining a clear MVP scope versus future growth phases.`,
        variables: [],
    },
    {
        id: 'bmad-architect',
        title: 'Architectural Solutioning & Story Breakdown',
        description: 'Design system architecture from a PRD and decompose into prioritized Epics and User Stories',
        category: 'bmad-method',
        aiModel: 'gpt-4',
        content: `Analyze the provided Product Requirements Document (PRD) to design a complete system architecture that defines the technology stack, data models, API patterns, and component boundaries required to support the specified functional requirements. Based on these architectural decisions, break down the project into a prioritized list of independent, user-value-focused Epics, further decomposing each Epic into granular, implementable User Stories with specific acceptance criteria (Given/When/Then), ensuring complete traceability back to the PRD and verifying that no story has forward dependencies that would block immediate development.`,
        variables: [],
    },
    {
        id: 'bmad-builder',
        title: 'Implementation Execution',
        description: 'Execute User Story implementation following project context, architecture standards, and acceptance criteria',
        category: 'bmad-method',
        aiModel: 'gpt-4',
        content: `Execute the implementation of the specified User Story by first loading the project context and architecture standards to identify the exact files to modify and patterns to follow. Write the necessary code to satisfy all acceptance criteria, strictly adhering to the project's established styling and structural conventions, handle edge cases and error states, generate corresponding unit and integration tests to verify the new functionality, and finally update the story documentation to reflect the implementation details, changed files, and verification status.`,
        variables: [],
    },
    {
        id: 'bmad-critic',
        title: 'Adversarial Code Review',
        description: 'Conduct a break-it-mindset code review to find security, logic, and performance issues',
        category: 'bmad-method',
        aiModel: 'gpt-4',
        content: `Conduct an adversarial code review of the recent changes by adopting a cynical, 'break-it' mindset to proactively identify security vulnerabilities, logic gaps, performance bottlenecks, and deviations from the architectural standards. Systematically cross-reference the implementation against the story's acceptance criteria and the project's context rules, distinguishing between critical blockers and minor style nitpicks, and produce a structured review report that mandates specific fixes for actual issues while discarding hallucinations, ensuring the code is robust and production-ready before approval.`,
        variables: [],
    },
    {
        id: 'bmad-quick-flow',
        title: 'Rapid Feature Development',
        description: 'Quickly analyze, spec, implement, and self-audit a feature or bug fix with minimal overhead',
        category: 'bmad-method',
        aiModel: 'gpt-4',
        content: `Analyze the current codebase to understand the immediate context of the requested feature or bug fix, mapping out specific file locations, dependencies, and existing logic patterns to avoid regressions. Generate a lightweight technical specification that defines the problem, proposed solution, and exact verification steps, then immediately execute the implementation by modifying the necessary files, running local tests to confirm the fix, and performing a self-audit against the requirements to ensure the change is complete and does not introduce new technical debt.`,
        variables: [],
    },
    {
        id: 'bmad-tester',
        title: 'Automated QA Generation',
        description: 'Detect the testing framework and generate comprehensive automated test suites for APIs and UI flows',
        category: 'bmad-method',
        aiModel: 'gpt-4',
        content: `Analyze the source code to detect the project's existing testing framework (e.g., Playwright, Jest, Vitest) and identify the primary API endpoints and user interface flows. Generate a comprehensive suite of automated tests that includes API status/payload validation and end-to-end user journey assertions using semantic locators, ensuring coverage of both happy paths and critical error scenarios, and execute these tests to verify they pass within the current environment configuration without introducing flakiness.`,
        variables: [],
    },

    // Spec-Driven Templates - Specification-First Development Methodology
    {
        id: 'spec-constitution',
        title: 'The Constitution (Principles & Governance)',
        description: 'Establish foundational architectural principles and governance rules for all AI-generated artifacts',
        category: 'spec-driven',
        aiModel: 'gpt-4',
        content: `Analyze the project's intent and organizational requirements to establish a foundational Constitution that defines immutable architectural principles—specifically enforcing 'Library-First' modularity, 'CLI-First' observability, and 'Test-First' discipline—then generate a versioned markdown document that acts as the non-negotiable governance layer for all subsequent AI-generated specifications, plans, and code, ensuring every future artifact aligns with these core engineering standards and requires explicit justification for any complexity beyond the defined baseline.`,
        variables: [],
    },
    {
        id: 'spec-specification',
        title: 'The Specification (Intent & Requirements)',
        description: 'Transform feature descriptions into rigorous, technology-agnostic specifications with testable user stories',
        category: 'spec-driven',
        aiModel: 'gpt-4',
        content: `Transform the initial natural language feature description into a rigorous, technology-agnostic Feature Specification that focuses exclusively on user value and business logic, organizing the output into prioritized user stories with independent testability, measurable success criteria, and clear acceptance scenarios while explicitly excluding implementation details to ensure the requirement remains stable regardless of the underlying technology stack and serves as the primary source of truth for generation.`,
        variables: [],
    },
    {
        id: 'spec-clarification',
        title: 'The Clarification (De-risking & Coverage)',
        description: 'Identify ambiguities and missing edge cases in specifications via targeted clarification questions',
        category: 'spec-driven',
        aiModel: 'gpt-4',
        content: `Scan the current Feature Specification for ambiguities, missing edge cases, and underspecified behaviors across functional, data, and security domains, then generate a targeted sequence of up to five high-impact clarification questions to resolve these gaps, immediately encoding the user's answers back into the specification document to create a deterministic and robust input for the technical planning phase that prevents downstream rework due to assumptions.`,
        variables: [],
    },
    {
        id: 'spec-plan',
        title: 'The Plan (Architecture & Context)',
        description: 'Synthesize a Technical Implementation Plan mapping requirements to architecture and design artifacts',
        category: 'spec-driven',
        aiModel: 'gpt-4',
        content: `Ingest the finalized Feature Specification and valid Constitution to synthesize a comprehensive Technical Implementation Plan that maps business requirements to specific architectural decisions, technology stacks, and data models, automatically generating supporting artifacts like API contracts, schema definitions, and research documents while rigorously validating every technical choice against the project's constitutional governance rules to prevent over-engineering, ensure modularity, and define clear phase gates for the implementation.`,
        variables: [],
    },
    {
        id: 'spec-tasks',
        title: 'The Tasks (Decomposition & Dependency)',
        description: 'Decompose an implementation plan into granular, dependency-ordered tasks with test-first sequencing',
        category: 'spec-driven',
        aiModel: 'gpt-4',
        content: `Decompose the Technical Implementation Plan and design artifacts into a granular, dependency-ordered Task List organized strictly by user story to enable independent iterative delivery, marking parallelizable tasks to optimize execution speed and enforcing a 'Test-First' sequence where validation logic is implemented before core functionality, resulting in an executable checklist containing specific file paths and actions that an AI agent can autonomously follow to build the feature.`,
        variables: [],
    },
    {
        id: 'spec-analysis',
        title: 'The Analysis (Consistency & Auditing)',
        description: 'Perform a cross-artifact consistency audit to catch gaps, hallucinations, and principle violations',
        category: 'spec-driven',
        aiModel: 'gpt-4',
        content: `Perform a non-destructive, cross-artifact consistency audit by comparing the Specification, Implementation Plan, and Task List against one another and the project Constitution, identifying any logical gaps, hallucinations, scope creep, or violations of core principles (such as missing error handling or undefined data models), and producing a prioritized report of critical discrepancies and recommended remediations to ensure total alignment before any code is written.`,
        variables: [],
    },
    {
        id: 'spec-implementation',
        title: 'The Implementation (Execution & Validation)',
        description: 'Execute tasks in dependency order while enforcing architectural constraints and acceptance criteria',
        category: 'spec-driven',
        aiModel: 'gpt-4',
        content: `Execute the generated Task List by systematically implementing code, configuration, and tests for each item in dependency order, strictly adhering to the architectural constraints defined in the Plan and the governance rules of the Constitution, while continuously verifying progress against the defined acceptance criteria and ensuring all new code remains isolated, testable, and compliant with the project's established directory structure, ignore files, and style guidelines.`,
        variables: [],
    },
]

// Get templates by category
export function getTemplatesByCategory(category: string): PromptTemplate[] {
    return PROMPT_TEMPLATES.filter((t) => t.category === category)
}

// Search templates
export function searchTemplates(query: string): PromptTemplate[] {
    const q = query.toLowerCase()
    return PROMPT_TEMPLATES.filter(
        (t) =>
            t.title.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            t.category.toLowerCase().includes(q)
    )
}
