#!/bin/bash
set -e

echo "Building fleet-cis-tui..."

# Clean previous builds
rm -rf dist/ build/ *.egg-info/

# Build the package
python -m build

echo "Build completed successfully!"

# Smoke test with pipx run
echo "Running smoke test..."
WHEEL_FILE=$(ls dist/*.whl | head -1)

if [ -n "$WHEEL_FILE" ]; then
    echo "Testing wheel: $WHEEL_FILE"
    pipx run "$WHEEL_FILE" list
    echo "Smoke test passed!"
else
    echo "No wheel file found!"
    exit 1
fi

echo "Build and smoke test completed successfully!"