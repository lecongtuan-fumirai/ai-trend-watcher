FROM node:20-alpine

WORKDIR /app

# Cài đặt tzdata để đồng bộ múi giờ
RUN apk add --no-cache tzdata
ENV TZ=Asia/Ho_Chi_Minh

# Copy package files và cài đặt production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy toàn bộ mã nguồn
COPY . .

# Đảm bảo thư mục cache tồn tại
RUN mkdir -p cache

# Lệnh khởi chạy mặc định khi container chạy
CMD ["node", "src/main.js"]
