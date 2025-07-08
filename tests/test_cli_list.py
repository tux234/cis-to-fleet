"""Tests for CLI list command."""

from unittest.mock import patch

import pytest
from typer.testing import CliRunner

from cis_to_fleet.__main__ import app


@patch("cis_to_fleet.__main__.list_folders_sync")
def test_list_command_success(mock_list_folders: pytest.Mock) -> None:
    """Test successful list command execution."""
    mock_list_folders.return_value = ["macos-14", "macos-15", "windows-11"]
    
    runner = CliRunner()
    result = runner.invoke(app, ["list"])
    
    assert result.exit_code == 0
    assert "macos-14" in result.stdout
    assert "macos-15" in result.stdout
    assert "windows-11" in result.stdout
    
    # Verify each platform is on its own line
    lines = result.stdout.strip().split('\n')
    assert len(lines) == 3
    assert lines[0] == "macos-14"
    assert lines[1] == "macos-15"
    assert lines[2] == "windows-11"


@patch("cis_to_fleet.__main__.list_folders_sync")
def test_list_command_empty_result(mock_list_folders: pytest.Mock) -> None:
    """Test list command with empty result."""
    mock_list_folders.return_value = []
    
    runner = CliRunner()
    result = runner.invoke(app, ["list"])
    
    assert result.exit_code == 0
    assert result.stdout.strip() == ""


@patch("cis_to_fleet.__main__.list_folders_sync")
def test_list_command_network_error(mock_list_folders: pytest.Mock) -> None:
    """Test list command when network request fails."""
    mock_list_folders.side_effect = RuntimeError("Network error")
    
    runner = CliRunner()
    result = runner.invoke(app, ["list"])
    
    assert result.exit_code == 1
    assert "Error fetching platform list: Network error" in result.stderr


@patch("cis_to_fleet.__main__.list_folders_sync")
def test_list_command_single_platform(mock_list_folders: pytest.Mock) -> None:
    """Test list command with single platform."""
    mock_list_folders.return_value = ["ubuntu-20"]
    
    runner = CliRunner()
    result = runner.invoke(app, ["list"])
    
    assert result.exit_code == 0
    assert result.stdout.strip() == "ubuntu-20"


def test_list_command_help() -> None:
    """Test list command help output."""
    runner = CliRunner()
    result = runner.invoke(app, ["list", "--help"])
    
    assert result.exit_code == 0
    assert "List all available CIS benchmark platforms" in result.stdout