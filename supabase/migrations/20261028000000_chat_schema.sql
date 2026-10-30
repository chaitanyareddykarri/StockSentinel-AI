-- ====================================================================
-- StockSentinel AI — PostgreSQL / Supabase Schema Migration
-- Migration: 20261028000000_chat_schema.sql
-- Description: Persistent conversational history for the inventory-aware
-- AI Assistant with strict multi-tenant Row-Level Security (RLS) enforcement.
-- ====================================================================

-- Enable pgcrypto for gen_random_uuid() if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------------
-- 1. Chat Conversations Table
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for retrieving a user's conversations ordered by most recently updated
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_updated
    ON public.chat_conversations(user_id, updated_at DESC);

-- --------------------------------------------------------------------
-- 2. Chat Messages Table
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for chronological message retrieval within a conversation
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created
    ON public.chat_messages(conversation_id, created_at ASC);

-- Index for user-scoped foreign key lookups and RLS evaluations
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id
    ON public.chat_messages(user_id);

-- --------------------------------------------------------------------
-- 3. Row-Level Security (RLS) Policies
-- Enforce strict data isolation: Users can ONLY access their own records
-- --------------------------------------------------------------------

-- Conversations RLS
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own chat conversations" ON public.chat_conversations;
CREATE POLICY "Users access own chat conversations" ON public.chat_conversations
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Messages RLS
-- Enforces:
-- 1. Message user_id must match authenticated user
-- 2. Associated conversation must also belong to authenticated user
-- 3. Prevents moving messages into another user's conversation or hijacking ownership
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own chat messages" ON public.chat_messages;
CREATE POLICY "Users access own chat messages" ON public.chat_messages
    FOR ALL TO authenticated
    USING (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.chat_conversations c
            WHERE c.id = chat_messages.conversation_id
              AND c.user_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.chat_conversations c
            WHERE c.id = chat_messages.conversation_id
              AND c.user_id = auth.uid()
        )
    );

-- --------------------------------------------------------------------
-- 4. Automated Timestamp Triggers
-- --------------------------------------------------------------------

-- Function to refresh updated_at on direct conversation updates
-- Hardened with explicit search_path = public
CREATE OR REPLACE FUNCTION public.handle_chat_conversation_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_chat_conversation_updated ON public.chat_conversations;
CREATE TRIGGER on_chat_conversation_updated
    BEFORE UPDATE ON public.chat_conversations
    FOR EACH ROW EXECUTE FUNCTION public.handle_chat_conversation_updated();

-- Function to bump conversation updated_at when a new message is inserted
-- Hardened with explicit search_path = public and strictly scoped to NEW.user_id
-- to prevent any cross-tenant or unprivileged conversation modifications.
CREATE OR REPLACE FUNCTION public.handle_chat_message_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.chat_conversations
    SET updated_at = NOW()
    WHERE id = NEW.conversation_id
      AND user_id = NEW.user_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_chat_message_inserted ON public.chat_messages;
CREATE TRIGGER on_chat_message_inserted
    AFTER INSERT ON public.chat_messages
    FOR EACH ROW EXECUTE FUNCTION public.handle_chat_message_inserted();

