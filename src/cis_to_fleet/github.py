"""GitHub API client for fetching CIS benchmark data."""

import asyncio
from dataclasses import dataclass
from typing import Any

import httpx


@dataclass
class GitHubClient:
    """Client for interacting with GitHub API to fetch CIS benchmark data."""
    
    base_url: str = "https://api.github.com"
    repo_owner: str = "fleetdm"
    repo_name: str = "fleet"
    
    async def list_folders(self) -> list[str]:
        """List all directories under ee/cis/ in the Fleet repository.
        
        Returns:
            List of folder names sorted alphabetically, containing only directories.
            
        Raises:
            RuntimeError: If the API request fails or returns unexpected data.
        """
        url = f"{self.base_url}/repos/{self.repo_owner}/{self.repo_name}/contents/ee/cis"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()
            
            data: list[dict[str, Any]] = response.json()
            
            # Filter for directories only and extract names
            folder_names = [
                item["name"] 
                for item in data 
                if item.get("type") == "dir"
            ]
            
            return sorted(folder_names)


    async def fetch_yaml(self, folder: str) -> str:
        """Fetch the cis-policy-queries.yml file for a specific folder.
        
        Args:
            folder: The folder name under ee/cis/ to fetch YAML from.
            
        Returns:
            The raw YAML content as a string.
            
        Raises:
            RuntimeError: If the YAML file is not found (404) or other errors occur.
        """
        url = (
            f"https://raw.githubusercontent.com/{self.repo_owner}/{self.repo_name}/"
            f"refs/heads/main/ee/cis/{folder}/cis-policy-queries.yml"
        )
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            
            if response.status_code == 404:
                raise RuntimeError(f"YAML file not found for folder: {folder}")
            
            response.raise_for_status()
            return response.text


def list_folders_sync() -> list[str]:
    """Synchronous wrapper for list_folders().
    
    Returns:
        List of folder names sorted alphabetically.
    """
    client = GitHubClient()
    return asyncio.run(client.list_folders())


def fetch_yaml_sync(folder: str) -> str:
    """Synchronous wrapper for fetch_yaml().
    
    Args:
        folder: The folder name under ee/cis/ to fetch YAML from.
        
    Returns:
        The raw YAML content as a string.
    """
    client = GitHubClient()
    return asyncio.run(client.fetch_yaml(folder))