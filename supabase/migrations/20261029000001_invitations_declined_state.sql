-- ==============================================================================
-- StockSentinel AI — Migration 5: Add DECLINED Status to Invitations Check Constraint
-- File: supabase/migrations/20261029000001_invitations_declined_state.sql
-- Date: 2026-10-29
--
-- Description:
-- Idempotently updates the check constraint on public.invitations to support the
-- 'DECLINED' terminal state alongside 'PENDING', 'ACCEPTED', 'EXPIRED', and 'REVOKED'.
-- Non-destructive and safe for staging and production execution.
-- ==============================================================================

DO $$
BEGIN
    -- Drop old check constraint if present
    ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_status_check;

    -- Re-create constraint with DECLINED included
    ALTER TABLE public.invitations ADD CONSTRAINT invitations_status_check
        CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED', 'DECLINED'));
END $$;

