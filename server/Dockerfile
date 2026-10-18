# Zero dependencies — server.js only uses Node built-ins, so this is just "copy and run".
FROM node:22-alpine
WORKDIR /app
COPY server.js ./
ENV BACKUP_DIR=/data
VOLUME /data
EXPOSE 8093
CMD ["node", "server.js"]
