"""Tests for transform.py sanitisation functionality."""

from pathlib import Path
from typing import Any

from cis_to_fleet.transform import sanitise, sanitise_all, to_yaml


def test_sanitise_removes_extra_keys() -> None:
    """Test that sanitise removes unwanted keys and preserves order."""
    input_item = {
        "name": "Test Policy",
        "platform": "darwin",
        "description": "Test description",
        "resolution": "Fix it",
        "query": "SELECT 1;",
        "tags": ["security", "cis"],  # Should be removed
        "contributors": ["author1"],  # Should be removed
        "purpose": "testing",  # Should be removed
    }
    
    result = sanitise(input_item)
    
    # Check that only allowed keys are present
    expected_keys = ["name", "platform", "description", "resolution", "query"]
    assert list(result.keys()) == expected_keys
    
    # Check values are preserved
    assert result["name"] == "Test Policy"
    assert result["platform"] == "darwin"
    assert result["description"] == "Test description"
    assert result["resolution"] == "Fix it"
    assert result["query"] == "SELECT 1;"


def test_sanitise_handles_missing_keys() -> None:
    """Test that sanitise handles missing keys gracefully."""
    input_item = {
        "name": "Test Policy",
        "platform": "darwin",
        # Missing description, resolution, query
        "extra_field": "should be removed",
    }
    
    result = sanitise(input_item)
    
    # Should only contain keys that were present
    assert list(result.keys()) == ["name", "platform"]
    assert result["name"] == "Test Policy"
    assert result["platform"] == "darwin"


def test_sanitise_all() -> None:
    """Test that sanitise_all processes multiple items."""
    input_items = [
        {
            "name": "Policy 1",
            "platform": "darwin",
            "description": "First policy",
            "resolution": "Fix 1",
            "query": "SELECT 1;",
            "tags": ["unwanted"],
        },
        {
            "name": "Policy 2",
            "platform": "windows",
            "description": "Second policy",
            "resolution": "Fix 2",
            "query": "SELECT 2;",
            "contributors": ["author"],
        },
    ]
    
    result = sanitise_all(input_items)
    
    assert len(result) == 2
    
    # Check first item
    assert "tags" not in result[0]
    assert result[0]["name"] == "Policy 1"
    
    # Check second item
    assert "contributors" not in result[1]
    assert result[1]["name"] == "Policy 2"


def test_to_yaml_format() -> None:
    """Test that to_yaml produces expected YAML format."""
    input_items = [
        {
            "name": "Test Policy",
            "platform": "darwin",
            "description": "A test policy with\nmultiple lines",
            "resolution": "Fix it",
            "query": "SELECT 1;",
        }
    ]
    
    result = to_yaml(input_items)
    
    # Check basic structure
    assert "- name: Test Policy" in result
    assert "platform: darwin" in result
    assert "query: SELECT 1;" in result
    
    # Check multiline handling
    assert "description:" in result
    assert "multiple lines" in result


def test_to_yaml_golden_file() -> None:
    """Test that to_yaml output matches expected golden file."""
    # Load the same data that was used to create the expected file
    fixture_path = Path(__file__).parent / "fixtures" / "sample_raw.yml"
    from cis_to_fleet.transform import raw_yaml_to_list
    
    yaml_content = fixture_path.read_text()
    raw_items = raw_yaml_to_list(yaml_content)
    sanitised_items = sanitise_all(raw_items)
    result = to_yaml(sanitised_items)
    
    # Load expected result
    expected_path = Path(__file__).parent / "fixtures" / "expected.yml"
    expected = expected_path.read_text()
    
    # Compare (allowing for some formatting differences)
    result_lines = [line.rstrip() for line in result.split('\n') if line.strip()]
    expected_lines = [line.rstrip() for line in expected.split('\n') if line.strip()]
    
    # Check that key content is the same
    assert len(result_lines) == len(expected_lines)
    for result_line, expected_line in zip(result_lines, expected_lines):
        # Allow for slight formatting differences but ensure content matches
        assert result_line.strip() == expected_line.strip() or result_line == expected_line