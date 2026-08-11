FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY src ./src
USER 65532:65532
ENV CONTROL12_RESEARCH_HOST=0.0.0.0 CONTROL12_RESEARCH_PORT=4330 CONTROL12_RESEARCH_TOKEN_FILE=/run/secrets/control12-research-token
EXPOSE 4330
CMD ["node", "src/server.mjs"]
