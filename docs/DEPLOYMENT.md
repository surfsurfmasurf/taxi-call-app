# 리눅스 서버 배포 가이드

Ubuntu 22.04 LTS 기준. AWS EC2, GCP, 또는 온프레미스 서버에서 테스트 가능.

---

## 0. 원클릭 설치 (가장 빠른 방법)

서버에 SSH 접속 후 아래 한 줄만 실행하면 됩니다. git이 없어도 됩니다.

```bash
curl -fsSL https://raw.githubusercontent.com/surfsurfmasurf/taxi-call-app/master/scripts/setup-server.sh | bash
```

이 스크립트가 자동으로 수행하는 작업:
1. git, Docker, Nginx 등 필수 패키지 설치
2. 프로젝트 클론
3. JWT 시크릿, DB 비밀번호 자동 생성
4. Docker Compose로 PostgreSQL + Redis + API 서버 실행
5. Nginx 리버스 프록시 설정
6. 헬스체크 확인

설치 완료 후 테스트:
```bash
cd ~/taxi-call-app
bash scripts/test-api.sh http://$(curl -s ifconfig.me)
```

아래는 단계별 수동 설치 방법입니다.

---

## 1. 서버 요구사항

| 항목 | 최소 사양 | 권장 사양 |
|------|-----------|-----------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 2GB | 4GB |
| 디스크 | 20GB SSD | 40GB SSD |
| OS | Ubuntu 20.04+ | Ubuntu 22.04 LTS |
| 포트 | 80, 443, 3000 | 80, 443, 3000, 5432, 6379 |

---

## 2. 서버 초기 설정

### 2-1. 시스템 업데이트 및 기본 패키지

```bash
# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# 기본 도구 설치
sudo apt install -y curl wget git build-essential ufw
```

### 2-2. 방화벽 설정

```bash
# UFW 방화벽 활성화
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 3000/tcp  # API 서버 (테스트용, 운영시 nginx 뒤에 숨김)
sudo ufw enable
sudo ufw status
```

### 2-3. 전용 사용자 생성 (보안)

```bash
sudo adduser taxiapp --disabled-password
sudo usermod -aG sudo taxiapp
sudo su - taxiapp
```

---

## 3. 방법 A: Docker Compose로 배포 (권장)

가장 빠르고 간편한 방법. 모든 의존성이 컨테이너에 포함됨.

### 3-1. Docker 설치

```bash
# Docker 설치
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

# Docker Compose 확인
docker compose version
```

### 3-2. 프로젝트 클론

```bash
cd /home/taxiapp
git clone https://github.com/surfsurfmasurf/taxi-call-app.git
cd taxi-call-app
```

### 3-3. 환경변수 설정

```bash
cp server/.env.example server/.env
nano server/.env
```

**반드시 변경해야 할 항목:**
```env
# 보안 키 (랜덤 생성)
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)

# DB 비밀번호
DB_HOST=postgres
DB_PASSWORD=변경하세요_강력한_비밀번호

# Redis
REDIS_HOST=redis

# 서버 환경
NODE_ENV=production
PORT=3000
```

키 생성 명령어:
```bash
# JWT 시크릿 생성
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
```

### 3-4. docker-compose.yml 수정 (운영용)

```bash
nano docker-compose.yml
```

`DB_PASSWORD`를 .env와 일치하도록 수정:
```yaml
services:
  postgres:
    environment:
      POSTGRES_PASSWORD: 변경하세요_강력한_비밀번호  # ← 여기
```

### 3-5. 실행

```bash
# 빌드 및 실행
docker compose up -d --build

# 상태 확인
docker compose ps

# 로그 확인
docker compose logs -f server

# 헬스체크
curl http://localhost:3000/health
```

**예상 출력:**
```json
{"status":"ok","timestamp":"2026-03-31T..."}
```

### 3-6. 중지/재시작

```bash
docker compose down          # 중지
docker compose restart       # 재시작
docker compose up -d --build # 코드 변경 후 재빌드
```

---

## 4. 방법 B: 직접 설치 (수동)

Docker 없이 직접 설치하는 방법.

### 4-1. Node.js 18 설치

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node -v  # v18.x.x 확인
npm -v
```

### 4-2. PostgreSQL 16 설치

```bash
# PostgreSQL 공식 리포지토리 추가
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update
sudo apt install -y postgresql-16

# PostgreSQL 시작
sudo systemctl enable postgresql
sudo systemctl start postgresql

# DB 및 사용자 생성
sudo -u postgres psql <<EOF
CREATE USER taxiapp WITH PASSWORD 'your_strong_password';
CREATE DATABASE taxi_app OWNER taxiapp;
GRANT ALL PRIVILEGES ON DATABASE taxi_app TO taxiapp;
EOF

# 연결 테스트
psql -U taxiapp -d taxi_app -h localhost -c "SELECT 1;"
```

### 4-3. Redis 7 설치

```bash
sudo apt install -y redis-server

# Redis 설정 (메모리 제한, 비밀번호)
sudo nano /etc/redis/redis.conf
```

수정할 항목:
```conf
# bind 127.0.0.1 ::1      ← 로컬만 허용 (보안)
maxmemory 256mb
maxmemory-policy allkeys-lru
# requirepass your_redis_password  ← 필요시 비밀번호 설정
```

```bash
sudo systemctl restart redis
sudo systemctl enable redis

# 테스트
redis-cli ping  # PONG
```

### 4-4. 프로젝트 클론 및 설치

```bash
cd /home/taxiapp
git clone https://github.com/surfsurfmasurf/taxi-call-app.git
cd taxi-call-app/server

# 환경변수 설정
cp .env.example .env
nano .env
```

`.env` 설정:
```env
PORT=3000
NODE_ENV=production

DB_HOST=localhost
DB_PORT=5432
DB_NAME=taxi_app
DB_USER=taxiapp
DB_PASSWORD=your_strong_password

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=여기에_openssl_rand_hex_32_결과
JWT_REFRESH_SECRET=여기에_openssl_rand_hex_32_결과
```

```bash
# 의존성 설치
npm install --production

# DB 테이블 자동 생성 (최초 1회)
node -e "require('./src/models').sequelize.sync({ force: true }).then(() => { console.log('DB synced'); process.exit(); })"

# 서버 실행 테스트
node src/index.js
# → "Server running on port 3000" 확인 후 Ctrl+C
```

### 4-5. PM2로 프로세스 관리

```bash
# PM2 설치
sudo npm install -g pm2

# 서버 실행
pm2 start src/index.js --name taxi-server -i max

# PM2 명령어
pm2 status              # 상태 확인
pm2 logs taxi-server     # 로그 확인
pm2 restart taxi-server  # 재시작
pm2 stop taxi-server     # 중지

# 부팅 시 자동 실행
pm2 startup
pm2 save
```

PM2 ecosystem 파일 (선택):
```bash
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'taxi-server',
    script: 'src/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    max_memory_restart: '500M',
    error_file: '/home/taxiapp/logs/error.log',
    out_file: '/home/taxiapp/logs/out.log',
    merge_logs: true,
  }],
};
EOF

mkdir -p /home/taxiapp/logs
pm2 start ecosystem.config.js --env production
```

---

## 5. Nginx 리버스 프록시 + SSL

### 5-1. Nginx 설치

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

### 5-2. API 서버 프록시 설정

```bash
sudo nano /etc/nginx/sites-available/taxi-app
```

```nginx
upstream taxi_backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name your-domain.com;  # 도메인 또는 서버 IP

    # API 요청
    location /api/ {
        proxy_pass http://taxi_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO (WebSocket)
    location /socket.io/ {
        proxy_pass http://taxi_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;  # WebSocket 타임아웃 24시간
    }

    # 헬스체크
    location /health {
        proxy_pass http://taxi_backend;
    }
}
```

```bash
# 설정 활성화
sudo ln -s /etc/nginx/sites-available/taxi-app /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# 문법 검사 및 재시작
sudo nginx -t
sudo systemctl restart nginx
```

### 5-3. SSL 인증서 (Let's Encrypt)

도메인이 있는 경우:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com

# 자동 갱신 확인
sudo certbot renew --dry-run
```

IP로 테스트하는 경우 SSL 없이 HTTP로 사용.

---

## 6. API 테스트

### 6-1. 헬스체크

```bash
curl http://your-server-ip:3000/health
# 또는 Nginx 뒤
curl http://your-server-ip/health
```

### 6-2. OTP 발송 테스트

```bash
curl -X POST http://your-server-ip/api/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "01012345678"}'
```

예상 응답:
```json
{"success": true, "message": "인증번호가 발송되었습니다."}
```

서버 로그에서 OTP 확인:
```bash
# Docker
docker compose logs server | grep OTP

# PM2
pm2 logs taxi-server | grep OTP
```

### 6-3. OTP 인증 + 회원가입

```bash
curl -X POST http://your-server-ip/api/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"phone": "01012345678", "code": "서버로그의OTP", "name": "테스트유저"}'
```

예상 응답:
```json
{
  "success": true,
  "isNewUser": true,
  "user": {"id": "uuid...", "name": "테스트유저", "phone": "01012345678", ...},
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

### 6-4. 요금 예상 테스트

```bash
# 위에서 받은 accessToken 사용
TOKEN="eyJ..."

curl -X POST http://your-server-ip/api/rides/estimate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "pickup_lat": 37.5665,
    "pickup_lng": 126.978,
    "dest_lat": 37.5133,
    "dest_lng": 127.0422
  }'
```

### 6-5. 택시 호출 테스트

```bash
curl -X POST http://your-server-ip/api/rides \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "pickup_lat": 37.5665,
    "pickup_lng": 126.978,
    "pickup_address": "서울시청",
    "dest_lat": 37.5133,
    "dest_lng": 127.0422,
    "dest_address": "강남역"
  }'
```

### 6-6. 전체 API 시나리오 자동 테스트

```bash
#!/bin/bash
# test-api.sh - 전체 플로우 테스트 스크립트

BASE_URL="http://your-server-ip/api"

echo "=== 1. OTP 발송 ==="
curl -s -X POST $BASE_URL/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "01099998888"}' | jq .

echo ""
echo "서버 로그에서 OTP를 확인하세요."
read -p "OTP 코드 입력: " OTP_CODE

echo ""
echo "=== 2. 인증 + 로그인 ==="
RESULT=$(curl -s -X POST $BASE_URL/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d "{\"phone\": \"01099998888\", \"code\": \"$OTP_CODE\", \"name\": \"테스트\"}")
echo $RESULT | jq .

TOKEN=$(echo $RESULT | jq -r '.accessToken')
echo "Token: ${TOKEN:0:20}..."

echo ""
echo "=== 3. 내 정보 ==="
curl -s $BASE_URL/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 4. 요금 예상 ==="
curl -s -X POST $BASE_URL/rides/estimate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"pickup_lat":37.5665,"pickup_lng":126.978,"dest_lat":37.5133,"dest_lng":127.0422}' | jq .

echo ""
echo "=== 5. 결제 수단 목록 ==="
curl -s $BASE_URL/payments/methods \
  -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 6. 운행 내역 ==="
curl -s "$BASE_URL/rides?page=1" \
  -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 테스트 완료 ==="
```

```bash
chmod +x test-api.sh
./test-api.sh
```

---

## 7. Socket.IO 실시간 테스트

### 7-1. wscat으로 WebSocket 테스트

```bash
# wscat 설치
sudo npm install -g wscat

# 연결 테스트 (토큰 필요)
wscat -c "ws://your-server-ip:3000/socket.io/?EIO=4&transport=websocket" \
  --header "Authorization: Bearer YOUR_TOKEN"
```

### 7-2. 간단한 Socket.IO 클라이언트 테스트

```bash
cat > test-socket.js << 'SCRIPT'
const { io } = require("socket.io-client");

const TOKEN = process.argv[2] || "YOUR_TOKEN";
const URL = process.argv[3] || "http://localhost:3000";

const socket = io(URL, {
  auth: { token: TOKEN },
  transports: ["websocket"],
});

socket.on("connect", () => {
  console.log("Connected:", socket.id);

  // 기사 위치 업데이트 테스트
  socket.emit("driver:update_location", {
    lat: 37.5665, lng: 126.978, speed: 30, heading: 90,
  });
  console.log("Location update sent");
});

socket.on("ride:request", (data) => {
  console.log("New ride request:", data);
});

socket.on("disconnect", (reason) => {
  console.log("Disconnected:", reason);
});

socket.on("connect_error", (err) => {
  console.error("Connection error:", err.message);
});
SCRIPT

# 실행
cd /home/taxiapp/taxi-call-app/server
node test-socket.js "YOUR_ACCESS_TOKEN" "http://localhost:3000"
```

---

## 8. 모니터링

### 8-1. 서버 리소스 확인

```bash
# CPU, 메모리 확인
htop

# 디스크 확인
df -h

# 포트 확인
sudo ss -tlnp | grep -E '(3000|5432|6379|80|443)'
```

### 8-2. 서비스 상태 확인

```bash
# Docker 방식
docker compose ps
docker stats

# PM2 방식
pm2 monit
pm2 status
```

### 8-3. 로그 모니터링

```bash
# Docker
docker compose logs -f server --tail 100

# PM2
pm2 logs taxi-server --lines 100

# Nginx 액세스 로그
sudo tail -f /var/log/nginx/access.log

# PostgreSQL 로그
sudo tail -f /var/log/postgresql/postgresql-16-main.log
```

### 8-4. DB 상태 확인

```bash
# Docker
docker compose exec postgres psql -U postgres -d taxi_app -c "
  SELECT tablename FROM pg_tables WHERE schemaname = 'public';
"

# 직접 설치
psql -U taxiapp -d taxi_app -c "
  SELECT tablename FROM pg_tables WHERE schemaname = 'public';
"

# 테이블별 레코드 수
psql -U taxiapp -d taxi_app -c "
  SELECT 'users' as t, count(*) FROM users
  UNION ALL SELECT 'rides', count(*) FROM rides
  UNION ALL SELECT 'payments', count(*) FROM payments
  UNION ALL SELECT 'drivers', count(*) FROM drivers;
"
```

---

## 9. 트러블슈팅

### 문제: DB 연결 실패
```bash
# PostgreSQL 실행 확인
sudo systemctl status postgresql
# pg_hba.conf에서 로컬 접속 허용 확인
sudo cat /etc/postgresql/16/main/pg_hba.conf | grep -v "^#"
```

### 문제: Redis 연결 실패
```bash
redis-cli ping
sudo systemctl status redis
```

### 문제: 포트 충돌
```bash
sudo lsof -i :3000
# 프로세스 확인 후 필요시 종료
```

### 문제: Socket.IO 연결 안됨
```bash
# Nginx WebSocket 프록시 확인
curl -v -H "Upgrade: websocket" -H "Connection: Upgrade" \
  http://your-server-ip/socket.io/?EIO=4&transport=polling
```

### 문제: Docker 권한 오류
```bash
sudo usermod -aG docker $USER
newgrp docker
```

---

## 10. 운영 체크리스트

배포 전 반드시 확인:

- [ ] `.env`에 강력한 JWT_SECRET 설정 (32바이트 이상)
- [ ] DB 비밀번호 변경
- [ ] `NODE_ENV=production` 설정
- [ ] CORS origin을 실제 클라이언트 URL로 제한
- [ ] Rate limiting 활성화 확인
- [ ] Nginx SSL 설정 (운영환경)
- [ ] 방화벽 설정 (불필요 포트 차단)
- [ ] PM2 또는 Docker로 프로세스 관리
- [ ] 로그 모니터링 설정
- [ ] DB 백업 스케줄 설정

### DB 자동 백업 (cron)

```bash
# 매일 새벽 3시 백업
crontab -e
```

```cron
0 3 * * * pg_dump -U taxiapp taxi_app | gzip > /home/taxiapp/backups/taxi_$(date +\%Y\%m\%d).sql.gz
0 4 * * * find /home/taxiapp/backups -name "*.gz" -mtime +7 -delete
```

```bash
mkdir -p /home/taxiapp/backups
```
