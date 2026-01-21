#!/bin/bash
# Check prerequisites for replicant-mcp
# Run this before using the MCP server to ensure all required tools are available

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

echo "Checking replicant-mcp prerequisites..."
echo "========================================"
echo ""

# Check Node.js
echo -n "Node.js (>=18): "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo -e "${GREEN}OK${NC} ($(node -v))"
    else
        echo -e "${RED}FAIL${NC} ($(node -v) - need v18+)"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}FAIL${NC} (not installed)"
    ERRORS=$((ERRORS + 1))
fi

# Check npm
echo -n "npm: "
if command -v npm &> /dev/null; then
    echo -e "${GREEN}OK${NC} ($(npm -v))"
else
    echo -e "${RED}FAIL${NC} (not installed)"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "Android SDK Tools:"
echo "------------------"

# Check ANDROID_HOME or ANDROID_SDK_ROOT
echo -n "ANDROID_HOME/ANDROID_SDK_ROOT: "
if [ -n "$ANDROID_HOME" ]; then
    echo -e "${GREEN}OK${NC} ($ANDROID_HOME)"
    SDK_ROOT="$ANDROID_HOME"
elif [ -n "$ANDROID_SDK_ROOT" ]; then
    echo -e "${GREEN}OK${NC} ($ANDROID_SDK_ROOT)"
    SDK_ROOT="$ANDROID_SDK_ROOT"
else
    echo -e "${YELLOW}WARN${NC} (not set - will rely on PATH)"
    WARNINGS=$((WARNINGS + 1))
    SDK_ROOT=""
fi

# Check adb
echo -n "adb: "
if command -v adb &> /dev/null; then
    ADB_VERSION=$(adb version 2>&1 | head -1)
    echo -e "${GREEN}OK${NC} ($ADB_VERSION)"
else
    echo -e "${RED}FAIL${NC} (not found in PATH)"
    ERRORS=$((ERRORS + 1))
fi

# Check emulator
echo -n "emulator: "
if command -v emulator &> /dev/null; then
    EMU_VERSION=$(emulator -version 2>&1 | head -1 || echo "installed")
    echo -e "${GREEN}OK${NC} ($EMU_VERSION)"
else
    echo -e "${RED}FAIL${NC} (not found in PATH)"
    ERRORS=$((ERRORS + 1))
fi

# Check avdmanager
echo -n "avdmanager: "
if command -v avdmanager &> /dev/null; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAIL${NC} (not found in PATH)"
    ERRORS=$((ERRORS + 1))
fi

# Check for existing AVDs
echo ""
echo "Available AVDs:"
echo "---------------"
if command -v avdmanager &> /dev/null; then
    AVD_LIST=$(avdmanager list avd 2>/dev/null | grep "Name:" | sed 's/.*Name: /  - /' || echo "  (none)")
    if [ "$AVD_LIST" = "  (none)" ]; then
        echo -e "${YELLOW}  No AVDs found${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo "$AVD_LIST"
    fi
else
    echo "  (avdmanager not available)"
fi

# Check for connected devices
echo ""
echo "Connected Devices:"
echo "------------------"
if command -v adb &> /dev/null; then
    DEVICES=$(adb devices 2>/dev/null | tail -n +2 | grep -v "^$" || echo "")
    if [ -z "$DEVICES" ]; then
        echo -e "${YELLOW}  No devices connected${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo "$DEVICES" | while read line; do
            echo "  - $line"
        done
    fi
else
    echo "  (adb not available)"
fi

# Check Gradle wrapper (optional - project specific)
echo ""
echo "Build Tools (optional):"
echo "-----------------------"
echo -n "gradle (system): "
if command -v gradle &> /dev/null; then
    echo -e "${GREEN}OK${NC} ($(gradle -v 2>&1 | grep "Gradle" | head -1))"
else
    echo -e "${YELLOW}WARN${NC} (not installed - will use gradlew)"
    WARNINGS=$((WARNINGS + 1))
fi

# Summary
echo ""
echo "========================================"
if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}FAILED${NC}: $ERRORS error(s), $WARNINGS warning(s)"
    echo ""
    echo "Please install missing tools before using replicant-mcp."
    echo "See: https://developer.android.com/studio/command-line"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}PASSED with warnings${NC}: $WARNINGS warning(s)"
    echo ""
    echo "replicant-mcp may work, but some features might be limited."
    exit 0
else
    echo -e "${GREEN}PASSED${NC}: All prerequisites met!"
    exit 0
fi
