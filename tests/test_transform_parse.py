"""Tests for transform.py parsing functionality."""

from pathlib import Path

import pytest

from cis_to_fleet.transform import raw_yaml_to_list


def test_raw_yaml_to_list_success() -> None:
    """Test successful parsing of YAML string into list of dicts."""
    fixture_path = Path(__file__).parent / "fixtures" / "sample_raw.yml"
    yaml_content = fixture_path.read_text()
    
    result = raw_yaml_to_list(yaml_content)
    
    assert isinstance(result, list)
    assert len(result) == 2
    
    # Check first item structure
    first_item = result[0]
    assert "name" in first_item
    assert "platform" in first_item
    assert "description" in first_item
    assert "query" in first_item
    assert "resolution" in first_item
    
    assert first_item["name"] == "Ensure System Integrity Protection status"
    assert first_item["platform"] == "darwin"


def test_raw_yaml_to_list_invalid_format() -> None:
    """Test handling of YAML that doesn't contain a top-level list."""
    yaml_content = """
name: "Single Item"
platform: "darwin"
"""
    
    with pytest.raises(ValueError, match="Expected YAML to contain a top-level list"):
        raw_yaml_to_list(yaml_content)


def test_raw_yaml_to_list_empty_list() -> None:
    """Test handling of empty YAML list."""
    yaml_content = "[]"
    
    result = raw_yaml_to_list(yaml_content)
    assert result == []


def test_raw_yaml_to_list_invalid_yaml() -> None:
    """Test handling of malformed YAML."""
    yaml_content = """
- name: "Test"
  platform: "darwin"
  description: |
    Unclosed multiline string
  query: "SELECT 1;"
    resolution: "Fix it"  # This indentation is wrong
"""
    
    with pytest.raises(Exception):  # ruamel.yaml parsing error
        raw_yaml_to_list(yaml_content)