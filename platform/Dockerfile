FROM node:22-bookworm-slim
RUN npm install --global npm@12.0.2 \
    && npm install --global brace-expansion@5.0.9 ip-address@10.3.1 \
    && rm -rf /usr/local/lib/node_modules/npm/node_modules/brace-expansion /usr/local/lib/node_modules/npm/node_modules/ip-address \
    && cp -a /usr/local/lib/node_modules/brace-expansion /usr/local/lib/node_modules/npm/node_modules/brace-expansion \
    && cp -a /usr/local/lib/node_modules/ip-address /usr/local/lib/node_modules/npm/node_modules/ip-address \
    && npm --version \
    && npx --version
RUN groupadd --gid 10002 control12 && useradd --uid 10002 --gid 10002 --create-home control12
WORKDIR /app
COPY --chown=control12:control12 package.json ./
COPY --chown=control12:control12 src ./src
COPY --chown=control12:control12 dashboard ./dashboard
COPY --chown=control12:control12 policies ./policies
COPY --chown=control12:control12 schemas ./schemas
USER 10002:10002
ENV CONTROL12_PLATFORM_HOST=0.0.0.0 CONTROL12_PLATFORM_PORT=4400 CONTROL12_PLATFORM_ROOT=/state
EXPOSE 4400
VOLUME ["/state"]
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=6 CMD node -e "fetch('http://127.0.0.1:4400/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","src/server.mjs"]
