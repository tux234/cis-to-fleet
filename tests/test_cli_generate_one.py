"""Tests for CLI generate command (single platform)."""

from pathlib import Path
from unittest.mock import patch

import pytest
from typer.testing import CliRunner

from cis_to_fleet.__main__ import app


@patch("cis_to_fleet.__main__.fetch_yaml_sync")
def test_generate_single_platform_success(mock_fetch_yaml: pytest.Mock, tmp_path: Path) -> None:
    """Test successful generation for a single platform."""
    # Mock YAML content
    mock_yaml_content = """
- name: "Test Policy"
  platform: "darwin"
  description: "Test description"
  resolution: "Fix it"
  query: "SELECT 1;"
  extra_field: "should be removed"
"""
    mock_fetch_yaml.return_value = mock_yaml_content
    
    runner = CliRunner()
    result = runner.invoke(app, ["generate", "macos-15", "--output", str(tmp_path)])
    
    assert result.exit_code == 0
    assert "Fetching YAML for macos-15..." in result.stdout
    assert f"Generated: {tmp_path / 'cis-benchmark-macos15.yml'}" in result.stdout
    
    # Verify file was created
    output_file = tmp_path / "cis-benchmark-macos15.yml"
    assert output_file.exists()
    
    # Verify content is sanitised
    content = output_file.read_text()
    assert "name: Test Policy" in content
    assert "platform: darwin" in content
    assert "extra_field" not in content


@patch("cis_to_fleet.__main__.fetch_yaml_sync")
def test_generate_file_exists_no_force(mock_fetch_yaml: pytest.Mock, tmp_path: Path) -> None:
    """Test generate command when file exists and force is not used."""
    mock_yaml_content = "- name: 'Test'"
    mock_fetch_yaml.return_value = mock_yaml_content
    
    # Create existing file
    output_file = tmp_path / "cis-benchmark-macos15.yml"
    output_file.write_text("existing content")
    
    runner = CliRunner()
    result = runner.invoke(app, ["generate", "macos-15", "--output", str(tmp_path)])
    
    assert result.exit_code == 1
    assert "already exists" in result.stderr
    assert "Use --force to overwrite" in result.stderr
    
    # Verify original content is preserved
    assert output_file.read_text() == "existing content"


@patch("cis_to_fleet.__main__.fetch_yaml_sync")
def test_generate_file_exists_with_force(mock_fetch_yaml: pytest.Mock, tmp_path: Path) -> None:
    """Test generate command with force flag overwrites existing file."""
    mock_yaml_content = """
- name: "New Policy"
  platform: "darwin"
  description: "New description"
  resolution: "New fix"
  query: "SELECT 2;"
"""
    mock_fetch_yaml.return_value = mock_yaml_content
    
    # Create existing file
    output_file = tmp_path / "cis-benchmark-macos15.yml"
    output_file.write_text("existing content")
    
    runner = CliRunner()
    result = runner.invoke(app, ["generate", "macos-15", "--output", str(tmp_path), "--force"])
    
    assert result.exit_code == 0
    assert f"Generated: {output_file}" in result.stdout
    
    # Verify file was overwritten
    content = output_file.read_text()
    assert "existing content" not in content
    assert "name: New Policy" in content


@patch("cis_to_fleet.__main__.fetch_yaml_sync")
def test_generate_platform_not_found(mock_fetch_yaml: pytest.Mock, tmp_path: Path) -> None:
    """Test generate command when platform YAML is not found."""
    mock_fetch_yaml.side_effect = RuntimeError("YAML file not found for folder: nonexistent")
    
    runner = CliRunner()
    result = runner.invoke(app, ["generate", "nonexistent", "--output", str(tmp_path)])
    
    assert result.exit_code == 1
    assert "Error processing nonexistent" in result.stderr
    assert "YAML file not found" in result.stderr


@patch("cis_to_fleet.__main__.fetch_yaml_sync")
def test_generate_network_error(mock_fetch_yaml: pytest.Mock, tmp_path: Path) -> None:
    """Test generate command when network request fails."""
    mock_fetch_yaml.side_effect = Exception("Network timeout")
    
    runner = CliRunner()
    result = runner.invoke(app, ["generate", "macos-15", "--output", str(tmp_path)])
    
    assert result.exit_code == 1
    assert "Unexpected error processing macos-15" in result.stderr
    assert "Network timeout" in result.stderr


@patch("cis_to_fleet.__main__.fetch_yaml_sync")
def test_generate_creates_output_directory(mock_fetch_yaml: pytest.Mock, tmp_path: Path) -> None:
    """Test that generate creates output directory if it doesn't exist."""
    mock_yaml_content = "- name: 'Test'\n  platform: 'darwin'"
    mock_fetch_yaml.return_value = mock_yaml_content
    
    # Use a nested directory that doesn't exist
    output_dir = tmp_path / "nested" / "output"
    
    runner = CliRunner()
    result = runner.invoke(app, ["generate", "macos-15", "--output", str(output_dir)])
    
    assert result.exit_code == 0
    assert output_dir.exists()
    assert (output_dir / "cis-benchmark-macos15.yml").exists()


@patch("cis_to_fleet.__main__.fetch_yaml_sync")
def test_generate_multiple_platforms(mock_fetch_yaml: pytest.Mock, tmp_path: Path) -> None:
    """Test generate command with multiple platforms."""
    mock_yaml_content = "- name: 'Test Policy'\n  platform: 'darwin'"
    mock_fetch_yaml.return_value = mock_yaml_content
    
    runner = CliRunner()
    result = runner.invoke(app, ["generate", "macos-15", "windows-11", "--output", str(tmp_path)])
    
    assert result.exit_code == 0
    assert "Fetching YAML for macos-15..." in result.stdout
    assert "Fetching YAML for windows-11..." in result.stdout
    
    # Verify both files were created
    assert (tmp_path / "cis-benchmark-macos15.yml").exists()
    assert (tmp_path / "cis-benchmark-windows11.yml").exists()


@patch("cis_to_fleet.__main__.list_folders_sync")
@patch("cis_to_fleet.__main__.fetch_yaml_sync")
def test_generate_all_platforms(
    mock_fetch_yaml: pytest.Mock, mock_list_folders: pytest.Mock, tmp_path: Path
) -> None:
    """Test generate command with --all flag."""
    mock_list_folders.return_value = ["macos-15", "windows-11"]
    mock_yaml_content = "- name: 'Test Policy'\n  platform: 'darwin'"
    mock_fetch_yaml.return_value = mock_yaml_content
    
    runner = CliRunner()
    result = runner.invoke(app, ["generate", "--all", "--output", str(tmp_path)])
    
    assert result.exit_code == 0
    assert "Found 2 platforms to process" in result.stdout
    assert "Fetching YAML for macos-15..." in result.stdout
    assert "Fetching YAML for windows-11..." in result.stdout
    
    # Verify both files were created
    assert (tmp_path / "cis-benchmark-macos15.yml").exists()
    assert (tmp_path / "cis-benchmark-windows11.yml").exists()


def test_generate_invalid_arguments() -> None:
    """Test generate command with invalid argument combinations."""
    runner = CliRunner()
    
    # Test both --all and platform names
    result = runner.invoke(app, ["generate", "macos-15", "--all"])
    assert result.exit_code == 1
    assert "Cannot specify both --all and platform names" in result.stderr
    
    # Test neither --all nor platform names
    result = runner.invoke(app, ["generate"])
    assert result.exit_code == 1
    assert "Must specify either platform names or --all flag" in result.stderr


@patch("cis_to_fleet.__main__.list_folders_sync")
def test_generate_all_platforms_list_error(mock_list_folders: pytest.Mock, tmp_path: Path) -> None:
    """Test generate --all when platform listing fails."""
    mock_list_folders.side_effect = RuntimeError("Network error")
    
    runner = CliRunner()
    result = runner.invoke(app, ["generate", "--all", "--output", str(tmp_path)])
    
    assert result.exit_code == 1
    assert "Error fetching platform list: Network error" in result.stderr


def test_generate_help() -> None:
    """Test generate command help output."""
    runner = CliRunner()
    result = runner.invoke(app, ["generate", "--help"])
    
    assert result.exit_code == 0
    assert "Generate Fleet-compatible YAML files" in result.stdout
    assert "--output" in result.stdout
    assert "--force" in result.stdout
    assert "--all" in result.stdout