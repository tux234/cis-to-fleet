"""Tests for GitHub client list_folders functionality."""

import pytest
from pytest_httpx import HTTPXMock

from cis_to_fleet.github import GitHubClient, list_folders_sync


@pytest.mark.asyncio
async def test_list_folders_success(httpx_mock: HTTPXMock) -> None:
    """Test successful folder listing from GitHub API."""
    mock_response = [
        {"name": "macos-14", "type": "dir"},
        {"name": "windows-11", "type": "dir"},
        {"name": "README.md", "type": "file"},  # This should be filtered out
        {"name": "linux-ubuntu-22", "type": "dir"},
    ]
    
    httpx_mock.add_response(
        url="https://api.github.com/repos/fleetdm/fleet/contents/ee/cis",
        json=mock_response,
    )
    
    client = GitHubClient()
    folders = await client.list_folders()
    
    # Should only return directories, sorted alphabetically
    assert folders == ["linux-ubuntu-22", "macos-14", "windows-11"]


def test_list_folders_sync(httpx_mock: HTTPXMock) -> None:
    """Test synchronous wrapper for list_folders."""
    mock_response = [
        {"name": "macos-14", "type": "dir"},
        {"name": "windows-11", "type": "dir"},
    ]
    
    httpx_mock.add_response(
        url="https://api.github.com/repos/fleetdm/fleet/contents/ee/cis",
        json=mock_response,
    )
    
    folders = list_folders_sync()
    assert folders == ["macos-14", "windows-11"]


@pytest.mark.asyncio
async def test_list_folders_http_error(httpx_mock: HTTPXMock) -> None:
    """Test handling of HTTP errors from GitHub API."""
    httpx_mock.add_response(
        url="https://api.github.com/repos/fleetdm/fleet/contents/ee/cis",
        status_code=404,
    )
    
    client = GitHubClient()
    with pytest.raises(Exception):  # httpx.HTTPStatusError
        await client.list_folders()


@pytest.mark.asyncio
async def test_list_folders_empty_response(httpx_mock: HTTPXMock) -> None:
    """Test handling of empty response from GitHub API."""
    httpx_mock.add_response(
        url="https://api.github.com/repos/fleetdm/fleet/contents/ee/cis",
        json=[],
    )
    
    client = GitHubClient()
    folders = await client.list_folders()
    assert folders == []