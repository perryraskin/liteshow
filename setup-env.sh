#!/bin/bash

# Interactive Environment Variable Setup Script for LiteShow
# This script helps you configure your .env file securely

set -e

ENV_FILE=".env"
ENV_EXAMPLE=".env.example"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   LiteShow Environment Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Create .env from example if it doesn't exist
if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$ENV_EXAMPLE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        echo -e "${GREEN}✓ Created .env from .env.example${NC}"
    else
        echo -e "${RED}✗ Error: .env.example not found${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Found existing .env file${NC}"
fi

echo ""

# Function to get current value (masked)
get_current_value() {
    local var_name=$1
    local value=$(grep "^${var_name}=" "$ENV_FILE" | cut -d'"' -f2)
    if [ -z "$value" ]; then
        echo "(not set)"
    elif [ ${#value} -gt 20 ]; then
        echo "${value:0:10}...${value: -5}"
    else
        echo "$value"
    fi
}

# Function to update env variable
update_env_var() {
    local var_name=$1
    local new_value=$2

    # Escape special characters for sed
    new_value=$(echo "$new_value" | sed 's/[\/&]/\\&/g')

    # Update the value in .env file
    sed -i "s|^${var_name}=\".*\"|${var_name}=\"${new_value}\"|" "$ENV_FILE"

    echo -e "${GREEN}✓ Updated ${var_name}${NC}"
}

# Main menu loop
while true; do
    echo ""
    echo -e "${BLUE}Current Configuration:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "1) DATABASE_URL         : $(get_current_value 'DATABASE_URL')"
    echo "2) GITHUB_CLIENT_ID     : $(get_current_value 'GITHUB_CLIENT_ID')"
    echo "3) GITHUB_CLIENT_SECRET : $(get_current_value 'GITHUB_CLIENT_SECRET')"
    echo "4) TURSO_API_TOKEN      : $(get_current_value 'TURSO_API_TOKEN')"
    echo "5) AUTH_SECRET          : $(get_current_value 'AUTH_SECRET')"
    echo "6) ANTHROPIC_API_KEY    : $(get_current_value 'ANTHROPIC_API_KEY')"
    echo ""
    echo -e "${YELLOW}Special Options:${NC}"
    echo "7) Generate random AUTH_SECRET"
    echo "8) View full .env file"
    echo ""
    echo "q) Quit"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    read -p "Select option (1-8 or q): " choice

    case $choice in
        1)
            echo ""
            echo -e "${BLUE}DATABASE_URL${NC}"
            echo "Examples:"
            echo "  • Neon:   postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
            echo "  • Docker: postgresql://liteshow:liteshow@localhost:5432/liteshow"
            echo ""
            read -p "Enter new value: " value
            if [ ! -z "$value" ]; then
                update_env_var "DATABASE_URL" "$value"
            fi
            ;;
        2)
            echo ""
            echo -e "${BLUE}GITHUB_CLIENT_ID${NC}"
            echo "Get this from: https://github.com/settings/developers"
            echo ""
            read -p "Enter new value: " value
            if [ ! -z "$value" ]; then
                update_env_var "GITHUB_CLIENT_ID" "$value"
            fi
            ;;
        3)
            echo ""
            echo -e "${BLUE}GITHUB_CLIENT_SECRET${NC}"
            echo "Get this from: https://github.com/settings/developers"
            echo ""
            read -sp "Enter new value (hidden): " value
            echo ""
            if [ ! -z "$value" ]; then
                update_env_var "GITHUB_CLIENT_SECRET" "$value"
            fi
            ;;
        4)
            echo ""
            echo -e "${BLUE}TURSO_API_TOKEN${NC}"
            echo "Get this by running: turso db tokens create liteshow"
            echo ""
            read -sp "Enter new value (hidden): " value
            echo ""
            if [ ! -z "$value" ]; then
                update_env_var "TURSO_API_TOKEN" "$value"
            fi
            ;;
        5)
            echo ""
            echo -e "${BLUE}AUTH_SECRET${NC}"
            echo "This should be a random string (at least 32 characters)"
            echo "Tip: Use option 7 to generate one automatically"
            echo ""
            read -sp "Enter new value (hidden): " value
            echo ""
            if [ ! -z "$value" ]; then
                update_env_var "AUTH_SECRET" "$value"
            fi
            ;;
        6)
            echo ""
            echo -e "${BLUE}ANTHROPIC_API_KEY${NC}"
            echo "Get this from: https://console.anthropic.com/"
            echo ""
            read -sp "Enter new value (hidden): " value
            echo ""
            if [ ! -z "$value" ]; then
                update_env_var "ANTHROPIC_API_KEY" "$value"
            fi
            ;;
        7)
            echo ""
            echo -e "${BLUE}Generating random AUTH_SECRET...${NC}"
            random_secret=$(openssl rand -base64 32)
            update_env_var "AUTH_SECRET" "$random_secret"
            echo "Generated: ${random_secret:0:10}...${random_secret: -5}"
            ;;
        8)
            echo ""
            echo -e "${BLUE}Current .env file contents:${NC}"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            cat "$ENV_FILE"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            read -p "Press Enter to continue..."
            ;;
        q|Q)
            echo ""
            echo -e "${GREEN}✓ Configuration complete!${NC}"
            echo ""
            echo "Next steps:"
            echo "  1. Run database migrations: cd packages/db && pnpm db:push"
            echo "  2. Start development servers: pnpm dev"
            echo ""
            echo "For detailed testing instructions, see: PHASE_1_TESTING.md"
            echo ""
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option. Please try again.${NC}"
            ;;
    esac
done
