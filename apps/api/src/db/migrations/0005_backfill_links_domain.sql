UPDATE links SET domain_id = (SELECT id FROM domains WHERE host = @shurl_legacy_host) WHERE domain_id IS NULL;
