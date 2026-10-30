# Deployment & Containerization Guide: StockSentinel AI

This document provides deployment specifications for Docker Compose, Vercel, Railway, and Render.

---

## 1. Local Deployment with Docker Compose

StockSentinel AI includes a complete multi-container Docker Compose configuration running both the Next.js web application and the Python FastAPI ML microservice.

```bash
# Build and run containers
docker-compose up --build -d

# Check service logs
docker-compose logs -f

# Shut down services
docker-compose down
```

Services exposed:
- **Web Dashboard**: [http://localhost:3000](http://localhost:3000)
- **FastAPI Microservice**: [http://localhost:8000](http://localhost:8000) (Docs at `/docs`)

---

## 2. Cloud Deployment to Vercel (Recommended for Web)

1. Connect the GitHub repository to the [Vercel Dashboard](https://vercel.com).
2. Framework Preset: **Next.js**.
3. Configure Environment Variables:
   - `NEXT_PUBLIC_APP_URL`: Production domain.
   - `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key.
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role secret.
   - `DETECTION_SERVICE_URL`: (Optional) URL of deployed Python ML service.
   - `GEMINI_API_KEY`: (Optional) Google Gemini API key for conversational copilot.
4. Deploy.

---

## 3. Microservice Deployment to Render / Railway / Fly.io

1. Root Directory: `apps/api`.
2. Build Command: `pip install -r requirements.txt`.
3. Start Command: `uvicorn main:app --host 0.0.0.0 --port 8000`.
4. Copy the service URL into the Vercel `DETECTION_SERVICE_URL` variable.

