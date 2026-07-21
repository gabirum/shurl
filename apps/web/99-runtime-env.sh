#!/bin/sh

set -e

runtime_env_path=/usr/share/nginx/html/shurl/runtime_env.js
runtime_env_path_tmp=$runtime_env_path.tmp

envsubst '${API_URL} ${OIDC_ISSUER} ${OIDC_CLIENT_ID}' < $runtime_env_path > $runtime_env_path_tmp
mv $runtime_env_path_tmp $runtime_env_path
