# Stage 1: Build  
FROM node:18-alpine AS builder  
  
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
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_PARENT_ORIGIN=$VITE_PARENT_ORIGIN

# Build de producción
RUN npm run build
  
# Stage 2: Production  
FROM nginx:alpine  
  
# Copiar archivos construidos  
COPY --from=builder /app/dist /usr/share/nginx/html  
  
# Configuración de Nginx para SPA  
RUN echo 'server { \  
    listen 80; \  
    location / { \  
        root /usr/share/nginx/html; \  
        index index.html; \  
        try_files $uri $uri/ /index.html; \  
    } \  
}' > /etc/nginx/conf.d/default.conf  
  
EXPOSE 80  
  
CMD ["nginx", "-g", "daemon off;"]