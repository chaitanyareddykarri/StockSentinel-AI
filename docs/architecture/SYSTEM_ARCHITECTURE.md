# System Architecture: StockSentinel AI

**Platform**: StockSentinel AI  
**Version**: 2.0.0 Architecture  
**Document**: Technical System Architecture  

---

## 1. High-Level Architectural Diagram

```mermaid
graph TB
    subgraph Client Tier
        UI[Next.js 16 Web Dashboard<br/>React 19 + Tailwind CSS v4]
        Mobile[Associate Shelf-Walk Interface<br/>Mobile-Optimized Touch UI]
        Chat[Inventory AI Copilot<br/>Conversational Assistance]
    end

    subgraph Edge & API Gateway
        VercelEdge[Vercel Serverless Functions<br/>Next.js App Router]
        AuthGuard[ServerAuth & RBAC Middleware<br/>Session & Token Verification]
        RateLimiter[Request Throttling & Protection]
    end

    subgraph Service Layer
        DetectService[Detection Orchestrator<br/>/api/detect]
        AlertsService[Alert Management & Shelf Walks<br/>/api/alerts]
        MetricsService[Executive KPI & Trend Aggregator<br/>/api/metrics]
        ImportService[CSV Batch Ingestion & Validation<br/>/api/import]
        AssistantService[RAG Grounding & AI Reasoning<br/>/api/assistant]
    end

    subgraph Analytics & ML Engines
        TSBaseline[Deterministic Poisson Baseline<br/>src/lib/detector.ts]
        PyMLService[FastAPI ML Microservice<br/>apps/api/main.py]
        GeminiLLM[Google Gemini 2.5 Flash<br/>Grounding Engine]
    end

    subgraph Storage & Persistence Tier
        SupabaseDB[(Supabase PostgreSQL 15<br/>RLS Policies, Triggers, DDL)]
        LocalSession[(Zero-Config In-Memory Store<br/>data/store_state.json)]
    end

    UI --> VercelEdge
    Mobile --> VercelEdge
    Chat --> VercelEdge

    VercelEdge --> AuthGuard --> RateLimiter

    RateLimiter --> DetectService
    RateLimiter --> AlertsService
    RateLimiter --> MetricsService
    RateLimiter --> ImportService
    RateLimiter --> AssistantService

    DetectService --> PyMLService
    DetectService -.Fallback.-> TSBaseline
    AssistantService --> GeminiLLM

    AlertsService --> SupabaseDB
    MetricsService --> SupabaseDB
    ImportService --> SupabaseDB
    DetectService --> SupabaseDB

    AlertsService -.No Supabase Credentials.-> LocalSession
    MetricsService -.No Supabase Credentials.-> LocalSession
```

---

## 2. Multi-Tenant Role-Based Access Control (RBAC)

The system provides 5 discrete access states:
1. **`PLATFORM_ADMIN`**: Global governance across all companies and store chains.
2. **`COMPANY_MANAGER`**: Full authority across all stores within their corporate organization.
3. **`STORE_MANAGER`**: Locked to their single assigned store location; cannot view or modify data from other stores.
4. **`PENDING_ASSIGNMENT`**: New accounts awaiting corporate association.
5. **`SUSPENDED`**: Revoked access.

Access boundaries are enforced at three layers:
- **Client Route Guards** (`ProtectedRoute.tsx`)
- **Server-Side API Authorization** (`src/lib/auth/serverAuth.ts`)
- **Database Row-Level Security** (PostgreSQL RLS policies on tables)

---

## 3. Resilience and Failover Strategies

1. **Dual Detection Engine**: If the Python FastAPI microservice is offline or times out (>3.5s), Next.js immediately falls back to the built-in TypeScript Poisson baseline engine without user disruption.
2. **Dual Persistence Mode**: If Supabase PostgreSQL credentials are not set, the application operates in Demo Mode using an in-memory/JSON filesystem store pre-populated with realistic retail data.
3. **AI Provider Fallback**: If Google Gemini API is unavailable, the copilot can fall back to OpenAI GPT or report clear operational guidance grounded in local rules.

