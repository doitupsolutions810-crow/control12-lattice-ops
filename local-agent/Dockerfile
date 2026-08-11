FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates curl jq procps socat tini zsh \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 control12 \
    && useradd --uid 10001 --gid 10001 --create-home --shell /usr/bin/zsh control12

ENV HOME=/home/control12 \
    CONTROL12_ROOT=/home/control12/.control12 \
    CONTROL12_PUBLIC_PORT=8080 \
    CONTROL12_MODEL_HOST=model \
    CONTROL12_MODEL_PORT=8080

WORKDIR /home/control12/.control12/app

COPY --chown=control12:control12 src/server.mjs src/cli.mjs ./
COPY scripts/apply-deterministic-quorum.mjs /usr/local/bin/apply-deterministic-quorum.mjs
COPY container/entrypoint.sh /usr/local/bin/control12-container-entrypoint
COPY container/bin/sw_vers /usr/local/bin/sw_vers
COPY container/bin/sysctl /usr/local/bin/sysctl

RUN node /usr/local/bin/apply-deterministic-quorum.mjs /home/control12/.control12/app/server.mjs \
    && node --check /home/control12/.control12/app/server.mjs \
    && chmod 0755 /usr/local/bin/control12-container-entrypoint /usr/local/bin/sw_vers /usr/local/bin/sysctl \
    && mkdir -p /home/control12/.control12/state /home/control12/.control12/logs /home/control12/.control12/run \
    && chown -R control12:control12 /home/control12/.control12

USER 10001:10001
EXPOSE 8080
VOLUME ["/home/control12/.control12/state"]
HEALTHCHECK --interval=15s --timeout=5s --start-period=120s --retries=12 CMD curl -fsS http://127.0.0.1:8080/health >/dev/null || exit 1
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/control12-container-entrypoint"]
