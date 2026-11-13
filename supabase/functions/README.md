Supabase Edge Functions skeleton for audited operations and thin RPC callers with zero client data.
Rule R5: Functions handling client data are pinned to Canada (ca-central-1) for data residency.
Rule R9: Caller identity is derived strictly from auth.uid() (never from request parameters; null is denied).
