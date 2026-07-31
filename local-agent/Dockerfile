FROM node:22-bookworm-slim
WORKDIR /home/control12/.control12/app
COPY src/server.mjs src/cli.mjs ./
EXPOSE 8080
CMD ["node", "server.mjs"]
