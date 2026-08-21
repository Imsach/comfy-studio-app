FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

# Deliberately runs the Vite DEV server (`npm run dev`), not a production
# build. This app's ComfyUI reverse-proxy (`/comfyui-proxy` in
# vite.config.ts - needed so the browser doesn't make cross-origin requests
# straight to the GPU boxes) is implemented as a Vite dev-server middleware
# (`configureServer`), which does not run under `vite build` + a static
# file host or `vite preview` - that hook is dev-server-only per Vite's own
# plugin API. Do not "fix" this to `npm run build` + serve static; it would
# silently break the ComfyUI proxy.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
