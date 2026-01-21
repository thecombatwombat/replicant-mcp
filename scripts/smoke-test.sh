#!/bin/bash
# End-to-End Smoke Test for replicant-mcp
# Tests what can be validated without a full MCP client

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=============================================="
echo "replicant-mcp End-to-End Smoke Test"
echo "=============================================="
echo ""

TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

pass() {
    echo -e "${GREEN}PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

fail() {
    echo -e "${RED}FAIL${NC}"
    echo "  $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

skip() {
    echo -e "${YELLOW}SKIPPED${NC} ($1)"
    TESTS_SKIPPED=$((TESTS_SKIPPED + 1))
}

# ============================================
# Build Verification
# ============================================
echo -e "${BLUE}=== Build Verification ===${NC}"

echo -n "TypeScript compilation... "
if npm run build >/dev/null 2>&1; then
    pass
else
    fail "Build failed"
fi

echo -n "Entry point exists... "
if [ -f "dist/index.js" ]; then
    pass
else
    fail "dist/index.js not found"
fi

echo -n "RTFM docs exist... "
if [ -f "docs/rtfm/index.md" ] && [ -f "docs/rtfm/build.md" ]; then
    pass
else
    fail "RTFM documentation missing"
fi

# ============================================
# Unit Tests
# ============================================
echo ""
echo -e "${BLUE}=== Unit Tests ===${NC}"

echo -n "Running unit tests... "
UNIT_OUTPUT=$(npm run test:unit 2>&1)
if echo "$UNIT_OUTPUT" | grep -q "passed"; then
    UNIT_RESULT=$(echo "$UNIT_OUTPUT" | grep "Tests" | head -1 | sed 's/\x1b\[[0-9;]*m//g')
    pass
    echo "  $UNIT_RESULT"
else
    fail "Unit tests failed"
fi

# ============================================
# Integration Tests
# ============================================
echo ""
echo -e "${BLUE}=== Integration Tests ===${NC}"

echo -n "MCP protocol tests... "
INT_OUTPUT=$(npm run test:integration 2>&1)
if echo "$INT_OUTPUT" | grep -q "passed"; then
    INT_RESULT=$(echo "$INT_OUTPUT" | grep "Tests" | head -1 | sed 's/\x1b\[[0-9;]*m//g')
    pass
    echo "  $INT_RESULT"
else
    fail "Integration tests failed"
fi

# ============================================
# Android SDK Tools (Optional)
# ============================================
echo ""
echo -e "${BLUE}=== Android SDK Verification ===${NC}"

echo -n "adb available... "
if command -v adb &> /dev/null; then
    ADB_VERSION=$(adb version 2>&1 | head -1)
    pass
    echo "  $ADB_VERSION"

    echo -n "adb devices... "
    DEVICES=$(adb devices 2>/dev/null | tail -n +2 | grep -v "^$" | wc -l | tr -d ' ')
    if [ "$DEVICES" -gt 0 ]; then
        pass
        echo "  Found $DEVICES device(s)"
    else
        skip "no devices connected"
    fi
else
    skip "not installed"
fi

echo -n "emulator available... "
if command -v emulator &> /dev/null; then
    pass
else
    skip "not installed"
fi

echo -n "avdmanager available... "
if command -v avdmanager &> /dev/null; then
    pass

    echo -n "AVDs configured... "
    AVD_COUNT=$(avdmanager list avd 2>/dev/null | grep -c "Name:" || echo "0")
    if [ "$AVD_COUNT" -gt 0 ]; then
        pass
        echo "  Found $AVD_COUNT AVD(s)"
    else
        skip "no AVDs configured"
    fi
else
    skip "not installed"
fi

# ============================================
# Gradle (Optional - requires Android project)
# ============================================
echo ""
echo -e "${BLUE}=== Gradle Verification ===${NC}"

echo -n "gradle wrapper... "
if [ -f "gradlew" ]; then
    pass
else
    skip "not in Android project"
fi

# ============================================
# Summary
# ============================================
echo ""
echo "=============================================="
echo "SUMMARY"
echo "=============================================="
echo -e "Passed:  ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed:  ${RED}$TESTS_FAILED${NC}"
echo -e "Skipped: ${YELLOW}$TESTS_SKIPPED${NC}"
echo ""

if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}Some tests failed!${NC}"
    echo ""
    echo "Note: Android SDK tools (adb, emulator, avdmanager) are optional"
    echo "but required for full functionality."
    exit 1
else
    echo -e "${GREEN}All required tests passed!${NC}"
    if [ $TESTS_SKIPPED -gt 0 ]; then
        echo ""
        echo "Note: Some optional tests were skipped."
        echo "Install Android SDK tools for full validation."
    fi
    exit 0
fi
