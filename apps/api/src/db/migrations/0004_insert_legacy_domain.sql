INSERT IGNORE INTO domains (host, scheme)
SELECT @shurl_legacy_host, @shurl_legacy_scheme FROM DUAL
WHERE @shurl_legacy_host IS NOT NULL AND EXISTS (SELECT 1 FROM links WHERE domain_id IS NULL);
