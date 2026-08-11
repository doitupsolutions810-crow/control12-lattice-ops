FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY src ./src
USER 65532:65532
ENV CONTROL12_CHAT_HOST=0.0.0.0 CONTROL12_CHAT_PORT=4320 CONTROL12_WORKSPACE_ROOT=/data/workspaces
EXPOSE 4320
CMD ["node", "src/server.mjs"]
