# Stage 1: Build  
FROM node:20-alpine AS builder  
  
WORKDIR /app  
  
# Copiar archivos de dependencias  
COPY package*.json ./  
  
# Instalar dependencias  
RUN npm ci  
  
# Copiar el código fuente
COPY . .

# Build args para variables de entorno de Vite
ARG VITE_API_BASE
ARG VITE_PARENT_ORIGIN
# Optional, comma-separated extra parent origins. Leave empty in production;
# only for testing this image locally (e.g. http://localhost:3000)
ARG VITE_ALLOWED_ORIGINS=""
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_PARENT_ORIGIN=$VITE_PARENT_ORIGIN
ENV VITE_ALLOWED_ORIGINS=$VITE_ALLOWED_ORIGINS

# Build de producción
RUN npm run build
  
# Stage 2: Production  
FROM nginx:alpine  

# Who may embed the builder in an iframe (clickjacking protection). Only the
# parent apps; for a local test of this image add e.g. http://localhost:3000
ARG FRAME_ANCESTORS="https://flex.celcomlatam.com"
  
# Copiar archivos construidos  
COPY --from=builder /app/dist /usr/share/nginx/html  
  
# Configuración de Nginx para SPA + headers de seguridad (nginx/default.conf.template)
COPY nginx/default.conf.template /etc/nginx/conf.d/default.conf
RUN sed -i "s|__FRAME_ANCESTORS__|${FRAME_ANCESTORS}|" /etc/nginx/conf.d/default.conf

EXPOSE 80  
  
CMD ["nginx", "-g", "daemon off;"]