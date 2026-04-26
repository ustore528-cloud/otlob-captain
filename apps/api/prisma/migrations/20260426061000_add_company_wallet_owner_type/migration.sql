-- Phase 2.1 additive migration: support company wallet owner type.
-- Safe additive enum extension; no destructive changes.
ALTER TYPE "WalletOwnerType" ADD VALUE IF NOT EXISTS 'COMPANY';
