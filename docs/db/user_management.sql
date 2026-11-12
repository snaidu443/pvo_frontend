-- =====================================================================
-- Policy Value Optimizer – User management schema (PostgreSQL 14+)
-- Derived from the React app: User Management page, Overview "Add User",
-- role rules (Admin / Editor / Viewer) and the activity log.
-- API mapping: see docs/API_SPEC.md (A, C5, C12, H1–H3, J1).
--
-- Security notes
--   * Sign-in is via enterprise SSO: no passwords are stored. If local
--     accounts are ever required, add an Argon2id hash column (never plain text).
--   * Invitation tokens are stored only as SHA-256 hashes.
--   * The API must authorize every request per asset using user_asset_access.
--   * Keep personal data to the minimum below (name, work email).
-- =====================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS pvo;
SET search_path = pvo, public;

-- ---------------------------------------------------------------------
-- 1. Roles  (UI: Admin, Editor, Viewer)
-- ---------------------------------------------------------------------
CREATE TABLE roles (
    role_code    varchar(20)  PRIMARY KEY,                 -- 'admin' | 'editor' | 'viewer'
    display_name varchar(40)  NOT NULL UNIQUE,              -- 'Admin' | 'Editor' | 'Viewer' (sent to the UI as user.role)
    description  varchar(300) NOT NULL,
    rank         smallint     NOT NULL UNIQUE               -- 1 = most privileged; used for "may grant up to" checks
);

-- ---------------------------------------------------------------------
-- 2. Permissions  (one row per capability the API checks)
-- ---------------------------------------------------------------------
CREATE TABLE permissions (
    permission_code varchar(60)  PRIMARY KEY,               -- e.g. 'asset.edit_inputs'
    description     varchar(300) NOT NULL
);

CREATE TABLE role_permissions (
    role_code       varchar(20) NOT NULL REFERENCES roles(role_code) ON DELETE CASCADE,
    permission_code varchar(60) NOT NULL REFERENCES permissions(permission_code) ON DELETE CASCADE,
    PRIMARY KEY (role_code, permission_code)
);

-- ---------------------------------------------------------------------
-- 3. Users  (UI: User Management table, Add/Edit user form)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    user_id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,   -- UI: user.id (integer)
    full_name      varchar(60)  NOT NULL CHECK (length(trim(full_name)) > 0),   -- UI max 60
    email          varchar(80)  NOT NULL CHECK (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'), -- UI max 80
    role_code      varchar(20)  NOT NULL REFERENCES roles(role_code),  -- UI: role
    status         varchar(10)  NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('active', 'inactive', 'pending')), -- UI: status (Active / Inactive / Pending)
    idp_subject    varchar(255) UNIQUE,                    -- SSO subject id; NULL until first sign-in
    last_login_at  timestamptz,
    last_active_at timestamptz,                            -- UI: "Last active"
    created_at     timestamptz  NOT NULL DEFAULT now(),
    created_by     bigint       REFERENCES users(user_id) ON DELETE SET NULL,
    updated_at     timestamptz  NOT NULL DEFAULT now(),
    updated_by     bigint       REFERENCES users(user_id) ON DELETE SET NULL,
    deactivated_at timestamptz,
    CONSTRAINT users_pending_has_no_login CHECK (status <> 'pending' OR last_login_at IS NULL)
);
-- Email is unique case-insensitively (the UI matches collaborators by lower(email)).
CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));
CREATE INDEX users_role_status_ix ON users (role_code, status);

-- ---------------------------------------------------------------------
-- 4. Assets (minimal reference; the full asset tables live with the assessment schema)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assets (
    asset_id        varchar(40)  PRIMARY KEY,               -- 'TAK-481', 'TEST-100', 'NEW-001'
    asset_code      varchar(80)  NOT NULL,
    asset_name      varchar(160) NOT NULL,
    owner_user_id   bigint       REFERENCES users(user_id) ON DELETE SET NULL, -- UI: "Submission owner"
    created_by_role varchar(20)  REFERENCES roles(role_code),                -- set only for user-added assets
    created_at      timestamptz  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS assets_code_lower_uq ON assets (lower(asset_code));

-- ---------------------------------------------------------------------
-- 5. Asset access  (UI: "Assigned assets", "Assign assets", Overview "Add User")
--    The user's global role decides WHAT they can do; this table decides WHICH assets.
--    Admins see every asset without rows here.
-- ---------------------------------------------------------------------
CREATE TABLE user_asset_access (
    user_id    bigint      NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    asset_id   varchar(40) NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    granted_by bigint      REFERENCES users(user_id) ON DELETE SET NULL,
    granted_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, asset_id)
);
CREATE INDEX user_asset_access_asset_ix ON user_asset_access (asset_id);

-- ---------------------------------------------------------------------
-- 6. Invitations  (UI: status "Pending", "Invite sent", "Resend invite")
-- ---------------------------------------------------------------------
CREATE TABLE user_invitations (
    invitation_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       bigint      NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_sha256  bytea       NOT NULL UNIQUE CHECK (length(token_sha256) = 32), -- hash only; raw token is emailed once
    invited_by    bigint      REFERENCES users(user_id) ON DELETE SET NULL,
    sent_at       timestamptz NOT NULL DEFAULT now(),
    expires_at    timestamptz NOT NULL,
    accepted_at   timestamptz,
    revoked_at    timestamptz,
    send_count    smallint    NOT NULL DEFAULT 1 CHECK (send_count BETWEEN 1 AND 10),
    CHECK (expires_at > sent_at)
);
-- At most one open invitation per user (resend = revoke old + insert new, or bump send_count).
CREATE UNIQUE INDEX user_invitations_open_uq ON user_invitations (user_id) WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- ---------------------------------------------------------------------
-- 7. Audit log  (UI: "Recent activity"; API C12 / J1)
--    Written by the server from the authenticated user and server time.
-- ---------------------------------------------------------------------
CREATE TABLE audit_log (
    audit_id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    occurred_at   timestamptz NOT NULL DEFAULT now(),
    actor_user_id bigint      REFERENCES users(user_id) ON DELETE SET NULL,
    actor_role    varchar(20) REFERENCES roles(role_code),
    action        varchar(60) NOT NULL,                     -- e.g. 'user.created', 'user.deactivated', 'asset.access_granted'
    entity_type   varchar(40) NOT NULL,                     -- 'user', 'asset', 'approval', 'rule', ...
    entity_id     varchar(80) NOT NULL,
    summary       varchar(300) NOT NULL,                    -- UI text: "Added Jordan Lee to TAK-481"
    before_data   jsonb,                                    -- changed fields only; no secrets or tokens
    after_data    jsonb
);
CREATE INDEX audit_log_time_ix   ON audit_log (occurred_at DESC);
CREATE INDEX audit_log_entity_ix ON audit_log (entity_type, entity_id);
CREATE INDEX audit_log_actor_ix  ON audit_log (actor_user_id, occurred_at DESC);

-- Audit rows are append-only: give the API's database role INSERT and SELECT only (role name is deployment-specific), e.g.
--   GRANT SELECT, INSERT ON pvo.audit_log TO pvo_api;
--   GRANT USAGE ON SEQUENCE pvo.audit_log_audit_id_seq TO pvo_api;
-- and never UPDATE or DELETE.

-- ---------------------------------------------------------------------
-- 8. Keep updated_at current
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$;

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 9. View in the exact shape the UI expects (API C5 / H1–H2 response: User)
-- ---------------------------------------------------------------------
CREATE VIEW v_user_list AS
SELECT
    u.user_id                                        AS id,
    u.full_name                                      AS name,
    u.email,
    r.display_name                                   AS role,
    CASE u.role_code WHEN 'admin' THEN 'super_admin' ELSE u.role_code END AS "roleCode",
    u.status,
    (u.status = 'active')                            AS active,
    u.last_active_at,                                -- API formats to the UI "last" text
    COALESCE(array_agg(a.asset_id ORDER BY a.asset_id) FILTER (WHERE a.asset_id IS NOT NULL), '{}') AS "assetIds",
    COALESCE(string_agg(a.asset_id, ', ' ORDER BY a.asset_id), '')                                 AS asset
FROM users u
JOIN roles r ON r.role_code = u.role_code
LEFT JOIN user_asset_access a ON a.user_id = u.user_id
GROUP BY u.user_id, r.display_name;

-- ---------------------------------------------------------------------
-- 10. Seed: roles and permissions (from the app's role rules)
-- ---------------------------------------------------------------------
INSERT INTO roles (role_code, display_name, description, rank) VALUES
 ('admin',  'Admin',  'Manages users and asset access, approves and publishes policy and rule changes.', 1),
 ('editor', 'Editor', 'Edits inputs, reviews and submits changes; cannot publish.',                      2),
 ('viewer', 'Viewer', 'Read-only.',                                                                       3);

INSERT INTO permissions (permission_code, description) VALUES
 ('asset.view',                 'See assigned assets and their assessments'),
 ('asset.view_all',             'See every asset without an assignment'),
 ('asset.create',               'Add a new product'),
 ('asset.edit_added',           'Edit or delete user-added assets'),
 ('asset.edit_inputs',          'Edit set-up, documents, indications, inputs and judgment answers'),
 ('asset.run_assessment',       'Run eligibility and impact analysis, start a new assessment'),
 ('asset.save_scenario',        'Save scenarios'),
 ('asset.add_collaborator',     'Add Editor/Viewer collaborators to an asset'),
 ('asset.grant_admin',          'Grant the Admin role when adding a collaborator'),
 ('users.view',                 'Open User Management (read-only)'),
 ('users.manage',               'Create, edit, activate/deactivate users, assign assets, resend invites'),
 ('governance.view',            'Open Policy Monitoring, Rules Engine and Approvals'),
 ('governance.review',          'Approve/reject/send back, comment, create rule drafts, classify deltas, create approvals'),
 ('governance.publish',         'Mark ready, publish, activate or retire rules, pause monitoring');

INSERT INTO role_permissions (role_code, permission_code) VALUES
 ('admin','asset.view'), ('admin','asset.view_all'), ('admin','asset.create'), ('admin','asset.edit_added'),
 ('admin','asset.edit_inputs'), ('admin','asset.run_assessment'), ('admin','asset.save_scenario'),
 ('admin','asset.add_collaborator'), ('admin','asset.grant_admin'), ('admin','users.view'), ('admin','users.manage'),
 ('admin','governance.view'), ('admin','governance.review'), ('admin','governance.publish'),

 ('editor','asset.view'), ('editor','asset.create'), ('editor','asset.edit_added'), ('editor','asset.edit_inputs'),
 ('editor','asset.run_assessment'), ('editor','asset.save_scenario'), ('editor','asset.add_collaborator'),
 ('editor','users.view'), ('editor','governance.view'), ('editor','governance.review'),

 ('viewer','asset.view');

COMMIT;

-- ---------------------------------------------------------------------
-- Typical authorization query (run by the API on every asset request):
--   May user :uid perform :perm on asset :aid ?
-- ---------------------------------------------------------------------
-- SELECT EXISTS (
--   SELECT 1
--   FROM users u
--   JOIN role_permissions rp ON rp.role_code = u.role_code AND rp.permission_code = :perm
--   WHERE u.user_id = :uid AND u.status = 'active'
--     AND ( EXISTS (SELECT 1 FROM role_permissions v WHERE v.role_code = u.role_code AND v.permission_code = 'asset.view_all')
--           OR EXISTS (SELECT 1 FROM user_asset_access x WHERE x.user_id = u.user_id AND x.asset_id = :aid) )
-- );
-- Always use bound parameters (:uid, :perm, :aid) – never string concatenation.
