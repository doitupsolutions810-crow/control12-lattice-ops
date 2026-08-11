FROM node:22-bookworm-slim
RUN npm install --global npm@12.0.2 \
    && npm install --global brace-expansion@5.0.9 ip-address@10.3.1 \
    && rm -rf /usr/local/lib/node_modules/npm/node_modules/brace-expansion /usr/local/lib/node_modules/npm/node_modules/ip-address \
    && cp -a /usr/local/lib/node_modules/brace-expansion /usr/local/lib/node_modules/npm/node_modules/brace-expansion \
    && cp -a /usr/local/lib/node_modules/ip-address /usr/local/lib/node_modules/npm/node_modules/ip-address \
    && npm --version \
    && npx --version
WORKDIR /app
COPY package.json ./
COPY src ./src
USER 65532:65532
ENV CONTROL12_RESEARCH_HOST=0.0.0.0 CONTROL12_RESEARCH_PORT=4330 CONTROL12_RESEARCH_TOKEN_FILE=/run/secrets/control12-research-token
EXPOSE 4330
CMD ["node", "src/server.mjs"]
