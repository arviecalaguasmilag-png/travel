FROM node:24-alpine
WORKDIR /app
COPY package.json server.mjs rates.mjs ./
COPY public ./public
ENV NODE_ENV=production
USER node
CMD ["node", "server.mjs"]
