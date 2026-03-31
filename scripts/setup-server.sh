#!/bin/bash
# 리눅스 서버 원클릭 설치 스크립트 (Ubuntu 22.04)
# 사용법: curl -fsSL <raw_url> | bash
# 또는: chmod +x setup-server.sh && ./setup-server.sh

set -e

echo "========================================="
echo "  택시 앱 서버 자동 설치 스크립트"
echo "  Ubuntu 22.04 LTS"
echo "========================================="
echo ""

# 색상
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "\n${GREEN}[STEP]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# root 체크
if [ "$EUID" -eq 0 ]; then
  error "root로 실행하지 마세요. 일반 사용자로 실행 후 sudo 권한이 필요합니다."
fi

# 1. 시스템 업데이트 + 필수 패키지 (git 포함)
step "시스템 업데이트 및 필수 패키지 설치"
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget jq ufw openssl

# 2. Docker 설치
step "Docker 설치"
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker $USER
  echo "Docker 그룹에 추가됨. 새 세션에서 적용됩니다."
else
  echo "Docker 이미 설치됨: $(docker --version)"
fi

# 3. Nginx 설치
step "Nginx 설치"
sudo apt install -y nginx certbot python3-certbot-nginx

# 4. 방화벽 설정
step "방화벽 설정"
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# 5. 프로젝트 클론
step "프로젝트 클론"
APP_DIR="$HOME/taxi-call-app"
if [ -d "$APP_DIR" ]; then
  echo "기존 디렉토리 발견. git pull 실행..."
  cd "$APP_DIR" && git pull
else
  git clone https://github.com/surfsurfmasurf/taxi-call-app.git "$APP_DIR"
  cd "$APP_DIR"
fi

# 6. 환경변수 설정
step "환경변수 설정"
if [ ! -f server/.env ]; then
  cp server/.env.example server/.env

  JWT_SECRET=$(openssl rand -hex 32)
  JWT_REFRESH=$(openssl rand -hex 32)
  DB_PASS=$(openssl rand -hex 16)

  sed -i "s|your_jwt_secret_key_here|$JWT_SECRET|g" server/.env
  sed -i "s|your_refresh_secret_key_here|$JWT_REFRESH|g" server/.env
  sed -i "s|your_password|$DB_PASS|g" server/.env
  sed -i "s|DB_HOST=localhost|DB_HOST=postgres|g" server/.env
  sed -i "s|REDIS_HOST=localhost|REDIS_HOST=redis|g" server/.env
  sed -i "s|NODE_ENV=development|NODE_ENV=production|g" server/.env

  # docker-compose의 DB 비밀번호도 업데이트
  sed -i "s|POSTGRES_PASSWORD: postgres123|POSTGRES_PASSWORD: $DB_PASS|g" docker-compose.yml
  sed -i "s|DB_PASSWORD: postgres123|DB_PASSWORD: $DB_PASS|g" docker-compose.yml

  echo "환경변수가 자동 생성되었습니다."
  echo "JWT_SECRET: ${JWT_SECRET:0:10}..."
  echo "DB_PASSWORD: ${DB_PASS:0:10}..."
else
  echo "server/.env 이미 존재. 건너뜁니다."
fi

# 7. Docker Compose 실행
step "Docker Compose 실행"
sg docker -c "docker compose up -d --build" 2>/dev/null || sudo docker compose up -d --build

# 8. 헬스체크 대기
step "서버 시작 대기 중..."
for i in $(seq 1 30); do
  if curl -s http://localhost:3000/health | grep -q "ok"; then
    echo -e "${GREEN}서버가 정상 시작되었습니다!${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    error "서버 시작 실패. 'docker compose logs server'로 로그를 확인하세요."
  fi
  echo "대기 중... ($i/30)"
  sleep 2
done

# 9. Nginx 설정
step "Nginx 설정"
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "your-server-ip")

sudo tee /etc/nginx/sites-available/taxi-app > /dev/null << NGINX
upstream taxi_backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name $SERVER_IP;

    location /api/ {
        proxy_pass http://taxi_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /socket.io/ {
        proxy_pass http://taxi_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 86400;
    }

    location /health {
        proxy_pass http://taxi_backend;
    }

    # 웹 프론트엔드 (정적 파일 → Node.js에서 서빙)
    location / {
        proxy_pass http://taxi_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/taxi-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# 완료
echo ""
echo "========================================="
echo -e "  ${GREEN}설치 완료!${NC}"
echo "========================================="
echo ""
echo "  서버 주소: http://$SERVER_IP"
echo "  API:       http://$SERVER_IP/api"
echo "  헬스체크:  http://$SERVER_IP/health"
echo ""
echo "  테스트 실행:"
echo "    cd $APP_DIR"
echo "    bash scripts/test-api.sh http://$SERVER_IP"
echo ""
echo "  로그 확인:"
echo "    cd $APP_DIR && docker compose logs -f server"
echo ""
echo "  서비스 관리:"
echo "    docker compose ps       # 상태"
echo "    docker compose restart  # 재시작"
echo "    docker compose down     # 중지"
echo "========================================="
