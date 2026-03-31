#!/bin/bash
# 택시 앱 API 전체 플로우 테스트 스크립트
# 사용법: ./test-api.sh [서버주소]
# 예시: ./test-api.sh http://localhost:3000

set -e

BASE_URL="${1:-http://localhost:3000}/api"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }
info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

TOTAL=0
PASSED=0

check() {
  TOTAL=$((TOTAL + 1))
  if [ $? -eq 0 ]; then
    PASSED=$((PASSED + 1))
    pass "$1"
  else
    fail "$1"
  fi
}

echo "================================"
echo "  택시 앱 API 테스트"
echo "  서버: $BASE_URL"
echo "================================"
echo ""

# 1. 헬스체크
info "1. 헬스체크"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL%/api}/health")
[ "$HEALTH" = "200" ]
check "서버 헬스체크 (HTTP $HEALTH)"
echo ""

# 2. OTP 발송
info "2. OTP 발송"
PHONE="010$(shuf -i 10000000-99999999 -n 1)"
OTP_RESULT=$(curl -s -X POST "$BASE_URL/auth/otp/send" \
  -H "Content-Type: application/json" \
  -d "{\"phone\": \"$PHONE\"}")
echo "$OTP_RESULT" | python3 -m json.tool 2>/dev/null || echo "$OTP_RESULT"
echo "$OTP_RESULT" | grep -q "success"
check "OTP 발송 ($PHONE)"
echo ""

# 3. OTP 인증 (개발환경에서는 서버 로그 확인 필요)
info "3. OTP 인증 (개발모드에서 로그 확인)"
echo "서버 로그에서 OTP를 확인하세요:"
echo "  Docker: docker compose logs server --tail 5 | grep OTP"
echo "  PM2:    pm2 logs taxi-server --lines 5 | grep OTP"
echo ""
read -p "OTP 코드를 입력하세요: " OTP_CODE

VERIFY_RESULT=$(curl -s -X POST "$BASE_URL/auth/otp/verify" \
  -H "Content-Type: application/json" \
  -d "{\"phone\": \"$PHONE\", \"code\": \"$OTP_CODE\", \"name\": \"테스트유저\"}")
echo "$VERIFY_RESULT" | python3 -m json.tool 2>/dev/null || echo "$VERIFY_RESULT"

TOKEN=$(echo "$VERIFY_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('accessToken', ''))" 2>/dev/null)
[ -n "$TOKEN" ]
check "OTP 인증 + 회원가입"
echo ""

if [ -z "$TOKEN" ]; then
  fail "토큰을 받지 못했습니다. 이후 테스트를 진행할 수 없습니다."
  exit 1
fi

info "토큰: ${TOKEN:0:30}..."
echo ""

# 4. 내 정보 조회
info "4. 내 정보 조회"
ME_RESULT=$(curl -s "$BASE_URL/auth/me" \
  -H "Authorization: Bearer $TOKEN")
echo "$ME_RESULT" | python3 -m json.tool 2>/dev/null || echo "$ME_RESULT"
echo "$ME_RESULT" | grep -q "user"
check "내 정보 조회"
echo ""

# 5. 요금 예상
info "5. 요금 예상 (서울시청 → 강남역)"
ESTIMATE_RESULT=$(curl -s -X POST "$BASE_URL/rides/estimate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "pickup_lat": 37.5665,
    "pickup_lng": 126.978,
    "dest_lat": 37.5133,
    "dest_lng": 127.0422
  }')
echo "$ESTIMATE_RESULT" | python3 -m json.tool 2>/dev/null || echo "$ESTIMATE_RESULT"
echo "$ESTIMATE_RESULT" | grep -q "fare"
check "요금 예상"
echo ""

# 6. 택시 호출
info "6. 택시 호출"
RIDE_RESULT=$(curl -s -X POST "$BASE_URL/rides" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "pickup_lat": 37.5665,
    "pickup_lng": 126.978,
    "pickup_address": "서울시청",
    "dest_lat": 37.5133,
    "dest_lng": 127.0422,
    "dest_address": "강남역"
  }')
echo "$RIDE_RESULT" | python3 -m json.tool 2>/dev/null || echo "$RIDE_RESULT"
echo "$RIDE_RESULT" | grep -q "ride"
check "택시 호출"

RIDE_ID=$(echo "$RIDE_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin).get('ride', {}).get('id', ''))" 2>/dev/null)
echo ""

# 7. 운행 목록 조회
info "7. 운행 목록 조회"
RIDES_RESULT=$(curl -s "$BASE_URL/rides?page=1" \
  -H "Authorization: Bearer $TOKEN")
echo "$RIDES_RESULT" | python3 -m json.tool 2>/dev/null || echo "$RIDES_RESULT"
echo "$RIDES_RESULT" | grep -q "rides"
check "운행 목록 조회"
echo ""

# 8. 결제 수단 목록
info "8. 결제 수단 목록"
PAY_RESULT=$(curl -s "$BASE_URL/payments/methods" \
  -H "Authorization: Bearer $TOKEN")
echo "$PAY_RESULT" | python3 -m json.tool 2>/dev/null || echo "$PAY_RESULT"
echo "$PAY_RESULT" | grep -q "methods"
check "결제 수단 목록"
echo ""

# 9. 결제 내역
info "9. 결제 내역"
PAY_HISTORY=$(curl -s "$BASE_URL/payments/history?page=1" \
  -H "Authorization: Bearer $TOKEN")
echo "$PAY_HISTORY" | python3 -m json.tool 2>/dev/null || echo "$PAY_HISTORY"
echo "$PAY_HISTORY" | grep -q "payments"
check "결제 내역"
echo ""

# 10. 쿠폰 목록
info "10. 쿠폰 목록"
COUPON_RESULT=$(curl -s "$BASE_URL/coupons/my" \
  -H "Authorization: Bearer $TOKEN")
echo "$COUPON_RESULT" | python3 -m json.tool 2>/dev/null || echo "$COUPON_RESULT"
echo "$COUPON_RESULT" | grep -q "coupons"
check "쿠폰 목록"
echo ""

# 11. 잘못된 토큰으로 접근
info "11. 인증 실패 테스트"
UNAUTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/auth/me" \
  -H "Authorization: Bearer invalid_token")
[ "$UNAUTH" = "401" ]
check "인증 실패 (HTTP $UNAUTH)"
echo ""

# 12. 잘못된 입력 검증
info "12. 입력 검증 테스트"
INVALID=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/auth/otp/send" \
  -H "Content-Type: application/json" \
  -d '{"phone": "invalid"}')
[ "$INVALID" = "400" ]
check "입력 검증 (HTTP $INVALID)"
echo ""

# 결과 요약
echo "================================"
echo "  테스트 결과: $PASSED / $TOTAL 통과"
echo "================================"

if [ "$PASSED" -eq "$TOTAL" ]; then
  echo -e "${GREEN}모든 테스트 통과!${NC}"
else
  echo -e "${RED}$((TOTAL - PASSED))개 실패${NC}"
fi
