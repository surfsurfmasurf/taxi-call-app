# Taxi App - 택시 호출 앱

우버/카카오택시와 유사한 실시간 택시 호출 서비스 풀스택 애플리케이션

## 아키텍처

```
├── server/          # Node.js + Express 백엔드
│   ├── src/
│   │   ├── config/       # DB, Redis 설정
│   │   ├── models/       # Sequelize 데이터 모델
│   │   ├── routes/       # REST API 라우트
│   │   ├── services/     # 비즈니스 로직 (요금, 매칭, 결제, 정산)
│   │   ├── middleware/   # 인증, 유효성 검사
│   │   ├── socket/       # Socket.IO 실시간 통신
│   │   └── index.js      # 서버 엔트리포인트
│   └── package.json
│
├── mobile/          # React Native (Expo) 모바일 앱
│   ├── src/
│   │   ├── screens/      # 화면 컴포넌트
│   │   │   ├── rider/    # 승객 화면 (홈, 운행, 결제, 내역)
│   │   │   └── driver/   # 기사 화면 (홈, 운행, 정산)
│   │   ├── context/      # React Context (Auth, Ride, Socket)
│   │   ├── services/     # API 클라이언트, Socket 서비스
│   │   └── navigation/   # 네비게이션 구성
│   └── App.js
│
└── docker-compose.yml
```

## 주요 기능

### Phase 1 - 핵심 기능
- [x] OTP 기반 회원가입/로그인
- [x] 지도 기반 출발지/목적지 설정
- [x] 실시간 기사 매칭 (거리+평점+수락률 기반 점수 산정)
- [x] 실시간 위치 추적 (Socket.IO + Redis GEO)
- [x] 카드 결제 연동 (토스페이먼츠 빌링키 방식)

### Phase 2 - 확장 기능
- [x] 간편결제 지원 (카카오페이, 네이버페이, 토스페이)
- [x] 서지 프라이싱 (수요/공급 기반 요금 변동)
- [x] 평점/리뷰 시스템
- [x] FCM 푸시 알림
- [x] SOS 긴급 호출

### Phase 3 - 고급 기능
- [x] 예약 호출
- [x] 경유지 추가
- [x] 쿠폰/프로모션 시스템
- [x] 기사 정산 시스템 (수수료 20%, 일일 정산)
- [x] 관리자 대시보드

## 기술 스택

| 영역 | 기술 |
|------|------|
| **Backend** | Node.js, Express, Socket.IO |
| **Database** | PostgreSQL (Sequelize ORM) |
| **Cache/GEO** | Redis (실시간 위치, 세션, OTP) |
| **Mobile** | React Native (Expo) |
| **Map** | Google Maps / Kakao Map API |
| **Payment** | 토스페이먼츠 (빌링키 자동결제) |
| **Push** | Firebase Cloud Messaging |
| **Auth** | JWT + OTP |

## 요금 체계

```
기본요금: 4,800원 (처음 1.6km)
거리요금: 131m당 100원
시간요금: 시속 15km 이하 시 30초당 100원
심야할증: 22:00~04:00 → 20%
서지 프라이싱: 수요/공급 비율에 따라 1.0x ~ 2.0x
```

## 시작하기

### 사전 요구사항

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (선택)

### Docker로 실행

```bash
# 인프라 (PostgreSQL + Redis) 실행
docker-compose up -d

# 서버 실행
cd server
cp .env.example .env  # 환경변수 설정
npm install
npm run dev

# 모바일 앱 실행
cd mobile
npm install
npm start
```

### 수동 설치

```bash
# 1. PostgreSQL DB 생성
createdb taxi_app

# 2. Redis 실행
redis-server

# 3. 서버
cd server
cp .env.example .env
# .env 파일에 DB, Redis, PG사 키 설정
npm install
npm run dev   # http://localhost:3000

# 4. 모바일
cd mobile
npm install
npx expo start
```

## API 엔드포인트

### 인증
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/auth/otp/send` | OTP 발송 |
| POST | `/api/auth/otp/verify` | OTP 인증 + 로그인 |
| POST | `/api/auth/refresh` | 토큰 갱신 |
| GET | `/api/auth/me` | 내 정보 |

### 운행
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/rides/estimate` | 요금 예상 |
| POST | `/api/rides` | 택시 호출 |
| GET | `/api/rides/:id` | 운행 상세 |
| GET | `/api/rides` | 내 운행 목록 |
| PATCH | `/api/rides/:id/status` | 상태 변경 |
| POST | `/api/rides/:id/review` | 리뷰 작성 |

### 기사
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/drivers/register` | 기사 등록 |
| PATCH | `/api/drivers/status` | 온/오프라인 |
| POST | `/api/drivers/location` | 위치 업데이트 |
| POST | `/api/drivers/respond` | 매칭 응답 |
| GET | `/api/drivers/settlement` | 정산 조회 |
| GET | `/api/drivers/dashboard` | 대시보드 |

### 결제
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/payments/methods` | 결제 수단 목록 |
| POST | `/api/payments/methods` | 결제 수단 등록 |
| POST | `/api/payments/methods/billing-key` | 빌링키 발급 |
| GET | `/api/payments/history` | 결제 내역 |
| POST | `/api/payments/:id/refund` | 환불 |

### 쿠폰
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/coupons/apply` | 쿠폰 등록 |
| GET | `/api/coupons/my` | 내 쿠폰 |

### 관리자
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/admin/dashboard` | 대시보드 |
| GET | `/api/admin/drivers` | 기사 관리 |
| PATCH | `/api/admin/drivers/:id/approve` | 기사 승인 |
| GET | `/api/admin/rides` | 전체 운행 |
| POST | `/api/admin/settlement` | 정산 실행 |

## Socket.IO 이벤트

### 기사 → 서버
| Event | 설명 |
|-------|------|
| `driver:update_location` | 위치 업데이트 |
| `driver:go_online` | 온라인 전환 |
| `driver:go_offline` | 오프라인 전환 |
| `driver:respond_ride` | 매칭 수락/거절 |

### 서버 → 클라이언트
| Event | 설명 |
|-------|------|
| `ride:request` | 기사에게 배차 요청 |
| `ride:matched` | 매칭 완료 |
| `ride:status_changed` | 운행 상태 변경 |
| `ride:completed` | 운행 완료 + 요금 |
| `driver:location` | 기사 위치 실시간 |
| `ride:no_driver` | 배차 실패 |

## 라이선스

MIT
