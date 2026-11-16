# Imaging gateway (0.3-S4, throwaway). The build context is prepared by the stack harness
# (stack/src/build.ts): src/, package.json and a flattened production node_modules. Node runs the
# TypeScript sources with its built-in type stripping.
FROM node:24.22.3-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54
WORKDIR /app
COPY . .
ENV NODE_ENV=production
USER node
EXPOSE 8080
CMD ["node", "src/main.ts"]
