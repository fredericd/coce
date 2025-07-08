#!/bin/bash

# Coce Test Runner Script
# Provides easy commands for running different test suites

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Ensure we have a config file
setup_config() {
    if [ ! -f "config.json" ]; then
        if [ -f "config.json.sample" ]; then
            cp config.json.sample config.json
            print_info "Created config.json from sample"
        elif [ -f "config.test.json" ]; then
            cp config.test.json config.json
            print_info "Created config.json from test config"
        else
            print_error "No configuration file found. Please create config.json"
            exit 1
        fi
    fi
}

# Install dependencies if needed
check_dependencies() {
    if [ ! -d "node_modules" ]; then
        print_info "Installing dependencies..."
        npm install
    fi
}

# Run specific test suite
run_tests() {
    local test_type=$1
    local description=$2
    
    print_header "$description"
    
    export NODE_ENV=test
    
    case $test_type in
        "unit")
            npx mocha test/unit/*.test.js --timeout 5000
            ;;
        "integration")
            npx mocha test/integration/*.test.js --timeout 10000
            ;;
        "all")
            npx mocha test/**/*.test.js --timeout 10000
            ;;
        "config")
            npx mocha test/unit/config.test.js
            ;;
        "fetcher")
            npx mocha test/unit/coce-fetcher.test.js
            ;;
        "app")
            npx mocha test/integration/app.test.js
            ;;
        "redis")
            npx mocha test/integration/redis.test.js
            ;;
        "performance")
            npx mocha test/integration/performance.test.js --timeout 20000
            ;;
        *)
            print_error "Unknown test type: $test_type"
            exit 1
            ;;
    esac
}

# Show usage
show_usage() {
    echo "Coce Test Runner"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  unit         - Run unit tests only"
    echo "  integration  - Run integration tests only"
    echo "  all          - Run all tests (default)"
    echo "  config       - Run configuration tests"
    echo "  fetcher      - Run CoceFetcher tests"
    echo "  app          - Run Express app tests"
    echo "  redis        - Run Redis integration tests"
    echo "  performance  - Run performance tests"
    echo "  lint         - Run linting"
    echo "  coverage     - Run tests with coverage"
    echo "  ci           - Run CI test suite"
    echo "  help         - Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 unit                    # Run unit tests"
    echo "  $0 integration            # Run integration tests"
    echo "  VERBOSE_TESTS=1 $0 all    # Run all tests with verbose output"
}

# Main execution
main() {
    local command=${1:-all}
    
    case $command in
        "help"|"-h"|"--help")
            show_usage
            exit 0
            ;;
        "lint")
            print_header "Running Linting"
            npm run lint
            ;;
        "coverage")
            print_header "Running Tests with Coverage"
            if command -v nyc >/dev/null 2>&1; then
                export NODE_ENV=test
                nyc mocha test/**/*.test.js --timeout 10000
            else
                print_error "nyc not found. Install with: npm install --save-dev nyc"
                exit 1
            fi
            ;;
        "ci")
            print_header "Running CI Test Suite"
            setup_config
            check_dependencies
            npm run lint
            run_tests "all" "All Tests"
            ;;
        "unit")
            setup_config
            check_dependencies
            run_tests "unit" "Unit Tests"
            ;;
        "integration")
            setup_config
            check_dependencies
            run_tests "integration" "Integration Tests"
            ;;
        "all")
            setup_config
            check_dependencies
            run_tests "all" "All Tests"
            ;;
        "config"|"fetcher"|"app"|"redis"|"performance")
            setup_config
            check_dependencies
            run_tests "$command" "$(echo $command | sed 's/.*/\u&/') Tests"
            ;;
        *)
            print_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
    
    if [ $? -eq 0 ]; then
        print_success "Tests completed successfully!"
    else
        print_error "Tests failed!"
        exit 1
    fi
}

# Run main function
main "$@"
