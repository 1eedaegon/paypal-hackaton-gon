CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    seeded BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    paypal_invoice_id TEXT UNIQUE,
    number TEXT,
    recipient_name TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    items JSONB NOT NULL,
    total_cents BIGINT NOT NULL,
    due_date DATE NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    pay_url TEXT,
    reminder_count INT NOT NULL DEFAULT 0,
    last_reminded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS invoices_user_idx ON invoices(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS actions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    reasoning TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    executed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS actions_user_idx ON actions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS activity (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    actor TEXT NOT NULL,
    kind TEXT NOT NULL,
    summary TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_user_idx ON activity(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS policies (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    auto_send BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    agent_calls INT NOT NULL DEFAULT 0,
    invoices_sent INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- When an invoice or action was claimed for an in-flight PayPal call (see release_stale_claims).
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
