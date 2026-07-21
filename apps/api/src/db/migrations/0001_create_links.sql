CREATE TABLE IF NOT EXISTS links (
  code            VARCHAR(32)       NOT NULL PRIMARY KEY,
  target_url      TEXT              NOT NULL,
  redirect_status SMALLINT UNSIGNED NOT NULL,
  owner           VARCHAR(255)      NOT NULL,
  access_count    BIGINT UNSIGNED   NOT NULL DEFAULT 0,
  created_at      TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_links_owner (owner),
  CONSTRAINT chk_links_redirect_status CHECK (redirect_status IN (302, 307, 308))
);
