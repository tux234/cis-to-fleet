"""Tests for GitHub client fetch_yaml functionality."""

import pytest
from pytest_httpx import HTTPXMock

from cis_to_fleet.github import GitHubClient, fetch_yaml_sync


@pytest.mark.asyncio
async def test_fetch_yaml_success(httpx_mock: HTTPXMock) -> None:
    """Test successful YAML fetching from GitHub raw content."""
    mock_yaml_content = """
- name: "Test Policy"
  platform: "darwin"
  description: "Test description"
  query: "SELECT 1;"
"""
    
    httpx_mock.add_response(
        url="https://raw.githubusercontent.com/fleetdm/fleet/refs/heads/main/ee/cis/macos-15/cis-policy-queries.yml",
        text=mock_yaml_content,
    )
    
    client = GitHubClient()
    yaml_content = await client.fetch_yaml("macos-15")
    
    assert yaml_content == mock_yaml_content


def test_fetch_yaml_sync(httpx_mock: HTTPXMock) -> None:
    """Test synchronous wrapper for fetch_yaml."""
    mock_yaml_content = "yaml: true"
    
    httpx_mock.add_response(
        url="https://raw.githubusercontent.com/fleetdm/fleet/refs/heads/main/ee/cis/windows-11/cis-policy-queries.yml",
        text=mock_yaml_content,
    )
    
    yaml_content = fetch_yaml_sync("windows-11")
    assert yaml_content == mock_yaml_content


@pytest.mark.asyncio
async def test_fetch_yaml_404_error(httpx_mock: HTTPXMock) -> None:
    """Test handling of 404 errors when YAML file doesn't exist."""
    httpx_mock.add_response(
        url="https://raw.githubusercontent.com/fleetdm/fleet/refs/heads/main/ee/cis/nonexistent/cis-policy-queries.yml",
        status_code=404,
    )
    
    client = GitHubClient()
    with pytest.raises(RuntimeError, match="YAML file not found for folder: nonexistent"):
        await client.fetch_yaml("nonexistent")


@pytest.mark.asyncio
async def test_fetch_yaml_other_http_error(httpx_mock: HTTPXMock) -> None:
    """Test handling of other HTTP errors (e.g., 500)."""
    httpx_mock.add_response(
        url="https://raw.githubusercontent.com/fleetdm/fleet/refs/heads/main/ee/cis/macos-15/cis-policy-queries.yml",
        status_code=500,
    )
    
    client = GitHubClient()
    with pytest.raises(Exception):  # httpx.HTTPStatusError
        await client.fetch_yaml("macos-15")